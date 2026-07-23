import { App, TFile } from 'obsidian'
import type { DeckFormat } from '../types'
import { isRecord } from '../utils/value-guards'

/** One decklist line: a card and how many copies. Printing-specific by card id. */
export interface DeckStoredEntry {
	id: string
	/** Wikilink to the card note. */
	link: string
	qty: number
}

/** Reads/writes the `entries` array and `format` in a deck note's frontmatter. */
export class DeckStore {
	constructor(private readonly app: App) {}

	readEntries(file: TFile): DeckStoredEntry[] {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const raw: unknown = frontmatter?.entries
		if (!Array.isArray(raw)) return []

		return raw.flatMap((item: unknown): DeckStoredEntry[] => {
			if (!isRecord(item)) return []
			const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : null
			const qty = typeof item.qty === 'number' && Number.isInteger(item.qty) && item.qty > 0 ? item.qty : null
			if (!id || !qty) return []
			return [{ id, qty, link: typeof item.link === 'string' ? item.link : '' }]
		})
	}

	readFormat(file: TFile): DeckFormat {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const format: unknown = frontmatter?.format
		return format === 'standard' || format === 'expanded' || format === 'unlimited' ? format : 'standard'
	}

	async setFormat(file: TFile, format: DeckFormat): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.format = format
		})
	}

	async addEntry(file: TFile, cardId: string, cardLink: string, qty: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => isRecord(item) && item.id === cardId)
			if (index >= 0 && isRecord(list[index])) {
				const current = list[index]
				const currentQty = typeof current.qty === 'number' ? current.qty : 0
				list[index] = { ...current, qty: currentQty + qty }
			} else {
				list.push({ id: cardId, link: cardLink, qty })
			}
			fm.entries = list
		})
	}

	/** Sets the quantity of a card in the deck; zero or less removes the line. */
	async setQuantity(file: TFile, cardId: string, qty: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => isRecord(item) && item.id === cardId)
			if (index < 0) return
			if (qty <= 0) {
				list.splice(index, 1)
			} else if (isRecord(list[index])) {
				list[index] = { ...list[index], qty }
			}
			fm.entries = list
		})
	}
}
