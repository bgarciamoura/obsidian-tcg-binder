import { App, normalizePath } from 'obsidian'
import type { CardData, CardDataSource } from './card-data/card-data-source'
import { stripLeadingZeros } from '../domain/card-list'

interface SetCardsFile {
	fetchedAt: number
	cards: CardData[]
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Per-set card list cache (memory + disk). Fetching a whole set once and
 * matching locally turns a 500-line CSV import from 500 API calls into a
 * handful, and it is what powers cost-to-completion.
 */
export class SetCardsCache {
	private readonly memory = new Map<string, CardData[]>()

	constructor(
		private readonly app: App,
		private readonly sourceRef: () => CardDataSource,
		/** Directory for cache files, e.g. the plugin's config dir. */
		private readonly cacheDir: () => string,
	) {}

	/** All cards of a set. `force` refetches (used by price updates). */
	async getSetCards(setId: string, force = false): Promise<CardData[]> {
		const source = this.sourceRef()
		const memoryKey = `${source.id}:${setId}`
		if (!force) {
			const inMemory = this.memory.get(memoryKey)
			if (inMemory) return inMemory
		}

		const cached = await this.readCache(setId)
		if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
			this.memory.set(memoryKey, cached.cards)
			return cached.cards
		}

		try {
			const cards = await source.getSetCards(setId)
			this.memory.set(memoryKey, cards)
			await this.writeCache(setId, { fetchedAt: Date.now(), cards })
			return cards
		} catch (error) {
			if (cached) {
				this.memory.set(memoryKey, cached.cards)
				return cached.cards // stale beats nothing
			}
			throw error
		}
	}

	findByNumber(cards: CardData[], number: string): CardData | undefined {
		const wanted = stripLeadingZeros(number).toLowerCase()
		return cards.find((card) => stripLeadingZeros(card.number).toLowerCase() === wanted)
	}

	private cachePath(setId: string): string {
		// Card ids/set ids are source-specific — never share cache files across sources.
		return normalizePath(`${this.cacheDir()}/set-cards-${this.sourceRef().id}-${setId}.json`)
	}

	private async readCache(setId: string): Promise<SetCardsFile | null> {
		try {
			const adapter = this.app.vault.adapter
			const path = this.cachePath(setId)
			if (!(await adapter.exists(path))) return null
			const parsed = JSON.parse(await adapter.read(path)) as SetCardsFile
			return Array.isArray(parsed.cards) ? parsed : null
		} catch {
			return null
		}
	}

	private async writeCache(setId: string, data: SetCardsFile): Promise<void> {
		try {
			await this.app.vault.adapter.write(this.cachePath(setId), JSON.stringify(data))
		} catch {
			// Cache is best-effort.
		}
	}
}
