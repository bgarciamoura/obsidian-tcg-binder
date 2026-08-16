import { App, TFile, normalizePath } from 'obsidian'
import { FRONTMATTER_TYPE_KEY } from '../constants'
import type { BinderFileType, DeckFormat, GameId } from '../types'
import { ensureFolder, findAvailablePath, listMarkdownFilesIn } from '../utils/vault'

/**
 * Vault persistence layer. Domain data never goes through loadData/saveData —
 * every collection, deck and card is a Markdown note with frontmatter, so the
 * user's data stays readable, syncable and linkable without the plugin.
 */
export class BinderStore {
	constructor(
		private readonly app: App,
		/** Read lazily so settings changes apply immediately. */
		private readonly rootFolder: () => string,
	) {}

	getFileType(file: TFile): BinderFileType | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const type: unknown = frontmatter?.[FRONTMATTER_TYPE_KEY]
		return type === 'collection' || type === 'deck' || type === 'card' ? type : null
	}

	listFiles(type: BinderFileType): TFile[] {
		// Scoped to the binder folder — the plugin never enumerates the vault.
		return listMarkdownFilesIn(this.app, this.rootFolder()).filter(
			(file) => this.getFileType(file) === type,
		)
	}

	/** Optional role of a collection, e.g. "wishlist". */
	getRole(file: TFile): string | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const role: unknown = frontmatter?.role
		return typeof role === 'string' && role.length > 0 ? role : null
	}

	/** The tracked set of a set collection, or null for regular collections. */
	getSetId(file: TFile): string | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const setId: unknown = frontmatter?.['set-id']
		return typeof setId === 'string' && setId.length > 0 ? setId : null
	}

	/** Raw cover image ref (remote URL or vault path) of a collection/deck. */
	getCover(file: TFile): string | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const cover: unknown = frontmatter?.cover
		return typeof cover === 'string' && cover.length > 0 ? cover : null
	}

	async setCover(file: TFile, cover: string): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.cover = cover
		})
	}

	/** Vertical crop position of the cover art (0 = top, 100 = bottom). */
	getCoverPosition(file: TFile): number {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const pos: unknown = frontmatter?.['cover-pos']
		return typeof pos === 'number' && pos >= 0 && pos <= 100 ? pos : 22
	}

	async setCoverPosition(file: TFile, pos: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm['cover-pos'] = Math.max(0, Math.min(100, Math.round(pos)))
		})
	}

	async removeCover(file: TFile): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			delete fm.cover
			delete fm['cover-pos']
		})
	}

	createCollection(
		name: string,
		game: GameId = 'pokemon',
		role?: 'wishlist',
		extra?: Record<string, unknown>,
	): Promise<TFile> {
		return this.createMarkedNote('collections', name, {
			[FRONTMATTER_TYPE_KEY]: 'collection',
			game,
			...(role ? { role } : {}),
			...(extra ?? {}),
		})
	}

	createDeck(name: string, format: DeckFormat = 'standard', game: GameId = 'pokemon'): Promise<TFile> {
		return this.createMarkedNote('decks', name, {
			[FRONTMATTER_TYPE_KEY]: 'deck',
			game,
			format,
		})
	}

	private async createMarkedNote(
		subfolder: string,
		name: string,
		frontmatter: Record<string, unknown>,
	): Promise<TFile> {
		const folder = normalizePath(`${this.rootFolder()}/${subfolder}`)
		await ensureFolder(this.app, folder)
		const file = await this.app.vault.create(findAvailablePath(this.app, folder, name), '')
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			Object.assign(fm, frontmatter)
		})
		return file
	}
}
