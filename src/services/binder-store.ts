import { App, TFile, normalizePath } from 'obsidian'
import { FRONTMATTER_TYPE_KEY } from '../constants'
import type { BinderFileType, DeckFormat, GameId } from '../types'
import { ensureFolder, findAvailablePath } from '../utils/vault'

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
		return this.app.vault.getMarkdownFiles().filter((file) => this.getFileType(file) === type)
	}

	/** Optional role of a collection, e.g. "wishlist". */
	getRole(file: TFile): string | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const role: unknown = frontmatter?.role
		return typeof role === 'string' && role.length > 0 ? role : null
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
