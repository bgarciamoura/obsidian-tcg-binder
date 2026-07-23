import type { CardData, CardDataSource, CardSearchQuery, SetInfo } from './card-data-source'
import { requestJson } from './http'

const API_BASE = 'https://api.pokemontcg.io/v2'
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const SEARCH_CACHE_MAX = 50

interface ApiCard {
	id: string
	name: string
	number: string
	supertype: string
	subtypes?: string[]
	rarity?: string
	set: { id: string; name: string; ptcgoCode?: string }
	images?: { small?: string; large?: string }
	legalities?: Record<string, string>
	tcgplayer?: { prices?: Record<string, { market?: number | null } | undefined> }
}

interface ApiSet {
	id: string
	name: string
	series: string
	ptcgoCode?: string
	total: number
	releaseDate: string
	images?: { symbol?: string; logo?: string }
}

/**
 * pokemontcg.io adapter. Since the Scrydex acquisition an API key is paid,
 * and the keyless tier is heavily rate limited — TCGdex is the default
 * source; this one remains for users who own a key.
 */
export class PokemonTcgSource implements CardDataSource {
	readonly game = 'pokemon' as const
	readonly id = 'pokemontcg-io'

	/** Short-lived query cache — retyping the same search must not spend quota. */
	private readonly searchCache = new Map<string, { at: number; cards: CardData[] }>()

	constructor(private readonly getApiKey: () => string) {}

	async searchCards(query: CardSearchQuery): Promise<CardData[]> {
		const filters: string[] = []
		if (query.name) filters.push(`name:"${query.name}*"`)
		// NOTE: the API 500s on set.ptcgoCode filters — set codes must be
		// resolved to a set id first (see SetCatalog.findByCode).
		if (query.setId) filters.push(`set.id:${query.setId}`)
		if (query.number) filters.push(`number:${query.number}`)

		const params = new URLSearchParams()
		if (filters.length > 0) params.set('q', filters.join(' '))
		params.set('page', String(query.page ?? 1))
		params.set('pageSize', String(query.pageSize ?? 30))
		params.set('orderBy', '-set.releaseDate')

		const path = `/cards?${params.toString()}`
		const cached = this.searchCache.get(path)
		if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) return cached.cards

		const body = await this.request(path)
		const cards = ((body as { data?: ApiCard[] }).data ?? []).map((card) => this.toCardData(card))

		this.searchCache.set(path, { at: Date.now(), cards })
		if (this.searchCache.size > SEARCH_CACHE_MAX) {
			// Maps iterate in insertion order — the first key is the oldest entry.
			for (const oldest of this.searchCache.keys()) {
				this.searchCache.delete(oldest)
				break
			}
		}
		return cards
	}

	async getCard(id: string): Promise<CardData | null> {
		try {
			const body = await this.request(`/cards/${encodeURIComponent(id)}`)
			const card = (body as { data?: ApiCard }).data
			return card ? this.toCardData(card) : null
		} catch {
			return null
		}
	}

	async getSets(): Promise<SetInfo[]> {
		const body = await this.request('/sets?pageSize=250&orderBy=-releaseDate')
		const sets = (body as { data?: ApiSet[] }).data ?? []
		return sets.map((set) => ({
			id: set.id,
			game: this.game,
			name: set.name,
			series: set.series,
			code: set.ptcgoCode ?? null,
			total: set.total,
			releaseDate: set.releaseDate,
			symbolUrl: set.images?.symbol ?? null,
		}))
	}

	async getSetCards(setId: string): Promise<CardData[]> {
		const pageSize = 250
		const cards: CardData[] = []
		for (let page = 1; ; page++) {
			const batch = await this.searchCards({ setId, page, pageSize })
			cards.push(...batch)
			if (batch.length < pageSize) break
		}
		return cards
	}

	private request(path: string): Promise<unknown> {
		const headers: Record<string, string> = {}
		const apiKey = this.getApiKey()
		if (apiKey) headers['X-Api-Key'] = apiKey
		return requestJson(`${API_BASE}${path}`, { headers })
	}

	private toCardData(card: ApiCard): CardData {
		const subtypes = card.subtypes ?? []
		return {
			id: card.id,
			game: this.game,
			name: card.name,
			setId: card.set.id,
			setCode: card.set.ptcgoCode ?? null,
			setName: card.set.name,
			number: card.number,
			supertype: card.supertype,
			subtypes,
			rarity: card.rarity ?? null,
			imageSmall: card.images?.small ?? null,
			imageLarge: card.images?.large ?? card.images?.small ?? null,
			marketPrice: this.extractMarketPrice(card),
			legalities: Object.entries(card.legalities ?? {})
				.filter(([, status]) => status === 'Legal')
				.map(([format]) => format.toLowerCase()),
			copyLimitExempt: card.supertype === 'Energy' && subtypes.includes('Basic'),
		}
	}

	private extractMarketPrice(card: ApiCard): number | null {
		const prices = card.tcgplayer?.prices
		if (!prices) return null
		// Prefer the plainest finish so the price matches the "default" card.
		const preferred = ['normal', 'holofoil', 'reverseHolofoil', '1stEditionNormal', '1stEditionHolofoil']
		for (const finish of preferred) {
			const market = prices[finish]?.market
			if (typeof market === 'number') return market
		}
		for (const finish of Object.values(prices)) {
			if (typeof finish?.market === 'number') return finish.market
		}
		return null
	}
}
