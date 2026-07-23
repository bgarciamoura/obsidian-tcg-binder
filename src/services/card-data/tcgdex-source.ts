import type { CardData, CardDataSource, CardSearchQuery, SetInfo } from './card-data-source'
import { requestJson } from './http'
import { stripLeadingZeros } from '../../domain/card-list'

const REST_BASE = 'https://api.tcgdex.net/v2/en'
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const SEARCH_CACHE_MAX = 50
const HYDRATE_CONCURRENCY = 8

interface TdxResume {
	id: string
	localId: string
	name: string
	image?: string
}

interface TdxCard extends TdxResume {
	category?: string
	rarity?: string
	energyType?: string
	trainerType?: string
	stage?: string
	suffix?: string
	legal?: { standard?: boolean; expanded?: boolean }
	set?: { id: string; name: string }
	pricing?: {
		tcgplayer?: Record<string, unknown>
	}
}

interface TdxSetResume {
	id: string
	name: string
	symbol?: string
	cardCount?: { official?: number; total?: number }
}

interface TdxSetDetail {
	releaseDate?: string
	serie?: { name?: string }
	/** The TCG Live code ("SVI") — REST-only; GraphQL's `tcgOnline` is null for modern sets. */
	abbreviation?: { official?: string }
}

/**
 * TCGdex adapter — free, no API key, no published rate limit. GraphQL is
 * used only for the set catalog (the REST list omits the TCG Live codes,
 * exposed in GraphQL as the legacy `tcgOnline` field); everything else is
 * REST. Search returns partial CardData (no price/legality — the resume
 * endpoints don't carry them); callers hydrate via getCard before persisting.
 */
export class TcgdexSource implements CardDataSource {
	readonly game = 'pokemon' as const
	readonly id = 'tcgdex'

	private sets: SetInfo[] | null = null
	private readonly searchCache = new Map<string, { at: number; cards: CardData[] }>()

	async searchCards(query: CardSearchQuery): Promise<CardData[]> {
		const cacheKey = JSON.stringify(query)
		const cached = this.searchCache.get(cacheKey)
		if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return cached.cards

		let cards: CardData[]
		if (query.setId && query.number) {
			const resumes = await this.getSetResumes(query.setId)
			const wanted = stripLeadingZeros(query.number).toLowerCase()
			const match = resumes.find(
				(resume) => stripLeadingZeros(resume.localId).toLowerCase() === wanted,
			)
			const full = match ? await this.getCard(match.id) : null
			cards = full ? [full] : []
		} else if (query.setId) {
			await this.ensureSets()
			const resumes = await this.getSetResumes(query.setId)
			cards = resumes.map((resume) => this.resumeToCard(resume, query.setId ?? ''))
			if (query.name) {
				const name = query.name.toLowerCase()
				cards = cards.filter((card) => card.name.toLowerCase().includes(name))
			}
		} else {
			await this.ensureSets()
			const params = new URLSearchParams()
			params.set('name', `like:${query.name ?? ''}`)
			params.set('pagination:page', String(query.page ?? 1))
			params.set('pagination:itemsPerPage', String(query.pageSize ?? 30))
			const body = await requestJson(`${REST_BASE}/cards?${params.toString()}`)
			const resumes = Array.isArray(body) ? (body as TdxResume[]) : []
			cards = resumes.map((resume) => this.resumeToCard(resume, resume.id.split('-')[0]))
		}

		this.searchCache.set(cacheKey, { at: Date.now(), cards })
		if (this.searchCache.size > SEARCH_CACHE_MAX) {
			for (const oldest of this.searchCache.keys()) {
				this.searchCache.delete(oldest)
				break
			}
		}
		return cards
	}

	async getCard(id: string): Promise<CardData | null> {
		try {
			const body = await requestJson(`${REST_BASE}/cards/${encodeURIComponent(id)}`)
			return this.toCardData(body as TdxCard)
		} catch {
			return null
		}
	}

	/**
	 * The set list resume carries no TCG Live codes (and GraphQL's legacy
	 * `tcgOnline` is null for every modern set), so each set's detail is
	 * fetched to read `abbreviation.official`. ~160 requests, but only on
	 * catalog refresh — SetCatalog keeps the result on disk for a week.
	 */
	async getSets(): Promise<SetInfo[]> {
		const body = await requestJson(`${REST_BASE}/sets`)
		const resumes = Array.isArray(body) ? (body as TdxSetResume[]) : []
		const details = await mapConcurrent(resumes, HYDRATE_CONCURRENCY, async (resume) => {
			try {
				return (await requestJson(
					`${REST_BASE}/sets/${encodeURIComponent(resume.id)}`,
				)) as TdxSetDetail
			} catch (error) {
				console.error(`[TCG Binder] failed to hydrate set ${resume.id}`, error)
				return null
			}
		})
		this.sets = resumes.map((resume, i) => ({
			id: resume.id,
			game: this.game,
			name: resume.name,
			series: details[i]?.serie?.name ?? '',
			code: details[i]?.abbreviation?.official ?? null,
			total: resume.cardCount?.total ?? resume.cardCount?.official ?? 0,
			releaseDate: details[i]?.releaseDate ?? '',
			symbolUrl: resume.symbol ?? null,
		}))
		return this.sets
	}

	/**
	 * Set resumes carry no prices/legality, so every card is hydrated via
	 * getCard with limited concurrency. Slow on first fetch for a big set
	 * (~30s for 250 cards) — SetCardsCache keeps it on disk for a week.
	 */
	async getSetCards(setId: string): Promise<CardData[]> {
		const resumes = await this.getSetResumes(setId)
		const hydrated = await mapConcurrent(resumes, HYDRATE_CONCURRENCY, (resume) =>
			this.getCard(resume.id),
		)
		return hydrated.filter((card): card is CardData => card !== null)
	}

	private async getSetResumes(setId: string): Promise<TdxResume[]> {
		const body = await requestJson(`${REST_BASE}/sets/${encodeURIComponent(setId)}`)
		const cards = (body as { cards?: TdxResume[] }).cards
		return Array.isArray(cards) ? cards : []
	}

	private async ensureSets(): Promise<void> {
		if (this.sets) return
		try {
			await this.getSets()
		} catch (error) {
			console.error('[TCG Binder] TCGdex set catalog fetch failed', error)
			this.sets = []
		}
	}

	private resumeToCard(resume: TdxResume, setId: string): CardData {
		const set = this.sets?.find((s) => s.id === setId)
		return {
			id: resume.id,
			game: this.game,
			name: resume.name,
			setId,
			setCode: set?.code ?? null,
			setName: set?.name ?? setId,
			number: stripLeadingZeros(resume.localId),
			supertype: '',
			subtypes: [],
			rarity: null,
			imageSmall: resume.image ? `${resume.image}/low.webp` : null,
			imageLarge: resume.image ? `${resume.image}/high.webp` : null,
			marketPrice: null,
			legalities: [],
			copyLimitExempt: false,
		}
	}

	private toCardData(card: TdxCard): CardData {
		const setId = card.set?.id ?? card.id.split('-')[0]
		const subtypes = [card.stage, card.suffix, card.trainerType, card.energyType].filter(
			(value): value is string => typeof value === 'string' && value.length > 0,
		)
		const legalities = card.legal
			? [
					...(card.legal.standard ? ['standard'] : []),
					...(card.legal.expanded ? ['expanded'] : []),
					'unlimited',
				]
			: []
		return {
			id: card.id,
			game: this.game,
			name: card.name,
			setId,
			setCode: this.sets?.find((s) => s.id === setId)?.code ?? null,
			setName: card.set?.name ?? setId,
			number: stripLeadingZeros(card.localId),
			supertype: card.category === 'Pokemon' ? 'Pokémon' : (card.category ?? ''),
			subtypes,
			rarity: card.rarity ?? null,
			imageSmall: card.image ? `${card.image}/low.webp` : null,
			imageLarge: card.image ? `${card.image}/high.webp` : null,
			marketPrice: this.extractMarketPrice(card),
			legalities,
			// TCGdex marks basic energies as energyType "Normal" (vs "Special").
			copyLimitExempt:
				card.category === 'Energy' && (card.energyType === 'Normal' || card.energyType === 'Basic'),
		}
	}

	/** pricing.tcgplayer mixes metadata (unit/updated) with per-finish objects. */
	private extractMarketPrice(card: TdxCard): number | null {
		const tcgplayer = card.pricing?.tcgplayer
		if (!tcgplayer) return null
		const preferred = ['normal', 'holofoil', 'reverseHolofoil', '1stEditionNormal', '1stEditionHolofoil']
		const marketOf = (value: unknown): number | null => {
			if (typeof value !== 'object' || value === null) return null
			const market = (value as { marketPrice?: unknown }).marketPrice
			return typeof market === 'number' ? market : null
		}
		for (const finish of preferred) {
			const market = marketOf(tcgplayer[finish])
			if (market !== null) return market
		}
		for (const value of Object.values(tcgplayer)) {
			const market = marketOf(value)
			if (market !== null) return market
		}
		return null
	}
}

async function mapConcurrent<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array<R>(items.length)
	let next = 0
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++
			results[index] = await fn(items[index])
		}
	})
	await Promise.all(workers)
	return results
}
