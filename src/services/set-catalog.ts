import { App } from 'obsidian'
import type { CardDataSource, SetInfo } from './card-data/card-data-source'

interface SetCache {
	fetchedAt: number
	sets: SetInfo[]
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // sets rarely change — refresh weekly

/**
 * Disk-cached set catalog. The plugin must keep working when the API is
 * down or the user is offline, so a stale cache always beats an error.
 */
export class SetCatalog {
	private sets: SetInfo[] | null = null
	/** Source the in-memory catalog was loaded for — set ids differ per source. */
	private loadedFor: string | null = null

	constructor(
		private readonly app: App,
		private readonly sourceRef: () => CardDataSource,
		/** File inside the plugin's config dir, e.g. `<plugin-dir>/sets-cache-<source>.json`. */
		private readonly cacheFilePath: () => string,
	) {}

	async load(): Promise<SetInfo[]> {
		const source = this.sourceRef()
		if (this.sets && this.loadedFor === source.id) return this.sets

		const cached = await this.readCache()
		if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
			this.sets = cached.sets
			this.loadedFor = source.id
			return this.sets
		}

		try {
			const sets = await source.getSets()
			this.sets = sets
			await this.writeCache({ fetchedAt: Date.now(), sets })
		} catch (error) {
			// Offline or API down — stale cache beats nothing.
			console.error('[TCG Binder] set catalog fetch failed, using cached sets', error)
			this.sets = cached?.sets ?? []
		}
		this.loadedFor = source.id
		return this.sets
	}

	/** Resolves a full set name ("Scarlet & Violet") to its set, case-insensitively. */
	findByName(name: string): SetInfo | null {
		if (!this.sets) return null
		const wanted = name.trim().toLowerCase()
		return this.sets.find((set) => set.name.toLowerCase() === wanted) ?? null
	}

	/** Resolves a decklist set code ("SVI") or set id ("sv1") to its set. */
	findByCode(code: string): SetInfo | null {
		if (!this.sets) return null
		const upper = code.toUpperCase()
		return (
			this.sets.find((set) => set.code?.toUpperCase() === upper || set.id.toUpperCase() === upper) ??
			null
		)
	}

	private async readCache(): Promise<SetCache | null> {
		try {
			const adapter = this.app.vault.adapter
			const path = this.cacheFilePath()
			if (!(await adapter.exists(path))) return null
			const parsed = JSON.parse(await adapter.read(path)) as SetCache
			return Array.isArray(parsed.sets) ? parsed : null
		} catch {
			return null // corrupted cache — refetch
		}
	}

	private async writeCache(cache: SetCache): Promise<void> {
		try {
			await this.app.vault.adapter.write(this.cacheFilePath(), JSON.stringify(cache))
		} catch {
			// Cache is best-effort; failing to persist it is not an error.
		}
	}
}
