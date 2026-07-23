import { App, TFile } from 'obsidian'
import type { CardCondition, CardVariant } from '../types'
import { isCardCondition, isCardVariant } from '../types'
import { isRecord } from '../utils/value-guards'

/** One line of a collection: a card in a specific variant + condition. */
export interface StoredEntry {
	id: string
	/** Wikilink to the card note, e.g. "[[Pikachu ex (SVI 45)]]". */
	link: string
	qty: number
	variant: CardVariant
	condition: CardCondition
}

export interface EntryKey {
	id: string
	variant: CardVariant
	condition: CardCondition
}

/**
 * Reads/writes the `entries` array in a collection note's frontmatter.
 * Entries are keyed by (card id, variant, condition) — adding the same
 * key again merges quantities instead of duplicating lines.
 */
export class CollectionStore {
	constructor(private readonly app: App) {}

	readEntries(file: TFile): StoredEntry[] {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const raw: unknown = frontmatter?.entries
		if (!Array.isArray(raw)) return []

		return raw.flatMap((item: unknown): StoredEntry[] => {
			if (!isRecord(item)) return []
			const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : null
			// qty 0 is valid: set-tracking collections list every card as a
			// checklist row before any copy is owned.
			const qty =
				typeof item.qty === 'number' && Number.isInteger(item.qty) && item.qty >= 0 ? item.qty : null
			if (!id || qty === null) return []
			return [
				{
					id,
					qty,
					link: typeof item.link === 'string' ? item.link : '',
					variant: isCardVariant(item.variant) ? item.variant : 'normal',
					condition: isCardCondition(item.condition) ? item.condition : 'NM',
				},
			]
		})
	}

	async addEntry(
		file: TFile,
		cardId: string,
		cardLink: string,
		qty: number,
		variant: CardVariant,
		condition: CardCondition,
		/** Insert the new line right after this entry instead of appending (variant splits). */
		afterKey?: EntryKey,
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => matchesKey(item, { id: cardId, variant, condition }))
			if (index >= 0 && isRecord(list[index])) {
				const current = list[index]
				const currentQty = typeof current.qty === 'number' ? current.qty : 0
				list[index] = { ...current, qty: currentQty + qty }
			} else {
				const entry = { id: cardId, link: cardLink, qty, variant, condition }
				const anchor = afterKey ? list.findIndex((item) => matchesKey(item, afterKey)) : -1
				if (anchor >= 0) {
					list.splice(anchor + 1, 0, entry)
				} else {
					list.push(entry)
				}
			}
			fm.entries = list
		})
	}

	/** Sets the quantity of an entry, clamping at 0 — the row stays as a checklist line. */
	async setQuantity(file: TFile, key: EntryKey, qty: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => matchesKey(item, key))
			if (index < 0 || !isRecord(list[index])) return
			list[index] = { ...list[index], qty: Math.max(0, qty) }
			fm.entries = list
		})
	}

	/**
	 * Re-keys an entry to a new variant/condition. If a line with the target
	 * key already exists, quantities merge into it and the original line is
	 * removed — two paths to the same physical pile must not coexist.
	 */
	async updateEntryKey(
		file: TFile,
		key: EntryKey,
		variant: CardVariant,
		condition: CardCondition,
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => matchesKey(item, key))
			if (index < 0 || !isRecord(list[index])) return

			const targetKey: EntryKey = { id: key.id, variant, condition }
			const target = list.findIndex((item, i) => i !== index && matchesKey(item, targetKey))
			if (target >= 0 && isRecord(list[target])) {
				const sourceQty = typeof list[index].qty === 'number' ? list[index].qty : 0
				const targetQty = typeof list[target].qty === 'number' ? list[target].qty : 0
				list[target] = { ...list[target], qty: targetQty + sourceQty }
				list.splice(index, 1)
			} else {
				list[index] = { ...list[index], variant, condition }
			}
			fm.entries = list
		})
	}

	/** Deletes an entry line entirely (the explicit ×, as opposed to qty 0). */
	async removeEntry(file: TFile, key: EntryKey): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => matchesKey(item, key))
			if (index < 0) return
			list.splice(index, 1)
			fm.entries = list
		})
	}

	/** Replaces the whole entries array in one write — used by set-collection creation. */
	async setEntries(file: TFile, entries: StoredEntry[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.entries = entries.map((entry) => ({
				id: entry.id,
				link: entry.link,
				qty: entry.qty,
				variant: entry.variant,
				condition: entry.condition,
			}))
		})
	}
}

function matchesKey(item: unknown, key: EntryKey): boolean {
	if (!isRecord(item)) return false
	const variant = isCardVariant(item.variant) ? item.variant : 'normal'
	const condition = isCardCondition(item.condition) ? item.condition : 'NM'
	return item.id === key.id && variant === key.variant && condition === key.condition
}
