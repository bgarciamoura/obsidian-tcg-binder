import { App, TFile, normalizePath } from 'obsidian'
import { FRONTMATTER_TYPE_KEY } from '../constants'
import type { CardData } from './card-data/card-data-source'
import { ensureFolder, findAvailablePath } from '../utils/vault'
import { sanitizeFileName } from '../utils/file-name'
import { isBasicEnergy } from '../domain/deck-rules'

/** Card note frontmatter, resolved for display. */
export interface CardMeta {
	file: TFile
	cardId: string
	name: string
	setId: string | null
	setCode: string | null
	setName: string | null
	number: string | null
	supertype: string | null
	rarity: string | null
	image: string | null
	priceMarket: number | null
	priceUpdated: string | null
	legalities: string[] | null
	copyLimitExempt: boolean
}

/**
 * Card notes: one Markdown note per unique card, created on demand.
 * The frontmatter is the plugin's record; the body belongs to the user
 * (personal notes, trade memories). A note hand-written with the right
 * frontmatter is just as valid as a generated one — that is how users
 * add cards missing from the API database.
 */
export class CardNotes {
	constructor(
		private readonly app: App,
		private readonly rootFolder: () => string,
	) {}

	/** Index of every card note in the vault, keyed by card id. */
	buildIndex(): Map<string, CardMeta> {
		const index = new Map<string, CardMeta>()
		for (const file of this.app.vault.getMarkdownFiles()) {
			const meta = this.readCardMeta(file)
			if (meta) index.set(meta.cardId, meta)
		}
		return index
	}

	readCardMeta(file: TFile): CardMeta | null {
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter
		if (!fm || fm[FRONTMATTER_TYPE_KEY] !== 'card') return null
		const cardId = typeof fm['card-id'] === 'string' ? fm['card-id'] : file.path
		const name = typeof fm.name === 'string' ? fm.name : file.basename
		const supertype = stringOrNull(fm.supertype)
		return {
			file,
			cardId,
			name,
			setId: stringOrNull(fm['set-id']),
			setCode: stringOrNull(fm['set-code']),
			setName: stringOrNull(fm['set-name']),
			number: stringOrNull(fm.number) ?? numberAsString(fm.number),
			supertype,
			rarity: stringOrNull(fm.rarity),
			image: stringOrNull(fm.image),
			priceMarket: typeof fm['price-market'] === 'number' ? fm['price-market'] : null,
			priceUpdated: stringOrNull(fm['price-updated']),
			legalities: stringArrayOrNull(fm.legalities),
			// Name fallback repairs notes created before sources flagged basics correctly.
			copyLimitExempt: fm['copy-limit-exempt'] === true || isBasicEnergy(supertype, name),
		}
	}

	findCardNote(cardId: string): TFile | null {
		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
			if (!frontmatter) continue
			if (frontmatter[FRONTMATTER_TYPE_KEY] === 'card' && frontmatter['card-id'] === cardId) {
				return file
			}
		}
		return null
	}

	async ensureCardNote(card: CardData): Promise<TFile> {
		const existing = this.findCardNote(card.id)
		if (existing) return existing
		return this.createCardNote(card)
	}

	/**
	 * Batch variant for whole sets: builds the note index once instead of
	 * scanning the vault per card (O(n) instead of O(n²)).
	 */
	async ensureCardNotes(
		cards: CardData[],
		onProgress?: (done: number, total: number) => void,
	): Promise<TFile[]> {
		const index = this.buildIndex()
		const files: TFile[] = []
		for (const [i, card] of cards.entries()) {
			const existing = index.get(card.id)?.file
			files.push(existing ?? (await this.createCardNote(card)))
			onProgress?.(i + 1, cards.length)
		}
		return files
	}

	private async createCardNote(card: CardData): Promise<TFile> {
		const folder = normalizePath(`${this.rootFolder()}/cards`)
		await ensureFolder(this.app, folder)

		const title = sanitizeFileName(`${card.name} (${card.setCode ?? card.setId} ${card.number})`)
		const body = card.imageLarge ? `![${card.name}](${card.imageLarge})\n` : ''
		const file = await this.app.vault.create(findAvailablePath(this.app, folder, title), body)

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[FRONTMATTER_TYPE_KEY] = 'card'
			fm.name = card.name
			fm.game = card.game
			fm['card-id'] = card.id
			fm['set-id'] = card.setId
			fm['set-code'] = card.setCode
			fm['set-name'] = card.setName
			fm.number = card.number
			fm.supertype = card.supertype
			if (card.subtypes.length > 0) fm.subtypes = card.subtypes
			if (card.rarity) fm.rarity = card.rarity
			if (card.legalities.length > 0) fm.legalities = card.legalities
			if (card.copyLimitExempt) fm['copy-limit-exempt'] = true
			if (card.imageLarge) fm.image = card.imageLarge
			if (card.marketPrice !== null) {
				fm['price-market'] = card.marketPrice
				fm['price-updated'] = new Date().toISOString().slice(0, 10)
			}
		})
		return file
	}

	/** Refreshes the market price stamped on a card note. */
	async updatePrice(file: TFile, price: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm['price-market'] = price
			fm['price-updated'] = new Date().toISOString().slice(0, 10)
		})
	}
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null
}

/** YAML turns numeric collector numbers ("45") into numbers — normalize back. */
function numberAsString(value: unknown): string | null {
	return typeof value === 'number' ? String(value) : null
}

function stringArrayOrNull(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null
	const strings = value.filter((item): item is string => typeof item === 'string')
	return strings.length > 0 ? strings : null
}
