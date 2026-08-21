import { App, TFile } from 'obsidian'
import type { DeckFormat } from '../types'
import { isRecord } from '../utils/value-guards'
import { localIsoDateTime } from '../utils/date'

/** One decklist line: a card and how many copies. Printing-specific by card id. */
export interface DeckStoredEntry {
	id: string
	/** Wikilink to the card note. */
	link: string
	qty: number
	/**
	 * Copies bought/assigned specifically to THIS deck (via the missing
	 * list's add-to-collection button). They are guaranteed to this deck in
	 * the missing math and reserved from other decks even while the deck is
	 * not assembled. Never exceeds qty.
	 */
	allocated: number
	/**
	 * Copies bought but not yet in hand ("on the way"). NOT ownership: they
	 * never count as collection copies or reserve anything — they only stop
	 * the missing list from telling the user to buy them again. Registering
	 * the arrival (the missing list's + button) burns them down. Never
	 * exceeds qty.
	 */
	ordered: number
}

/** Deck lifecycle: physically built, actively being hunted, or just a list. */
export type DeckStatus = 'assembled' | 'building' | 'list'

/** A saved snapshot of the decklist, stored in the deck's own frontmatter. */
export interface DeckRevision {
	/** Local date-time the snapshot was taken ("2026-08-19 15:30"). */
	saved: string
	/** Optional user label ("pre-regionals", "before restore", ...). */
	label: string
	format: DeckFormat
	entries: { id: string; link: string; qty: number }[]
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
			const allocated =
				typeof item.allocated === 'number' && Number.isInteger(item.allocated) && item.allocated > 0
					? Math.min(item.allocated, qty)
					: 0
			const ordered =
				typeof item.ordered === 'number' && Number.isInteger(item.ordered) && item.ordered > 0
					? Math.min(item.ordered, qty)
					: 0
			return [{ id, qty, allocated, ordered, link: typeof item.link === 'string' ? item.link : '' }]
		})
	}

	/**
	 * Adjusts the "bought, on the way" count of a line by `delta`, clamped
	 * to [0, qty]. Positive when the user marks a purchase, negative when
	 * the cards arrive and get registered.
	 */
	async bumpOrdered(file: TFile, cardId: string, delta: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => isRecord(item) && item.id === cardId)
			if (index < 0 || !isRecord(list[index])) return
			const current = list[index]
			const qty = typeof current.qty === 'number' ? current.qty : 0
			const ordered = typeof current.ordered === 'number' ? current.ordered : 0
			const next = Math.max(0, Math.min(qty, ordered + delta))
			const entry: Record<string, unknown> = { ...current }
			if (next > 0) entry.ordered = next
			else delete entry.ordered
			list[index] = entry
			fm.entries = list
		})
	}

	/**
	 * Raises the copies allocated to this deck by `delta`, clamped to the
	 * line's quantity — used when the user adds missing cards to a collection
	 * FROM this deck's screen, so the new copies belong here.
	 */
	async bumpAllocated(file: TFile, cardId: string, delta: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.entries
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			const index = list.findIndex((item) => isRecord(item) && item.id === cardId)
			if (index < 0 || !isRecord(list[index])) return
			const current = list[index]
			const qty = typeof current.qty === 'number' ? current.qty : 0
			const allocated = typeof current.allocated === 'number' ? current.allocated : 0
			const next = Math.max(0, Math.min(qty, allocated + delta))
			const entry: Record<string, unknown> = { ...current }
			if (next > 0) entry.allocated = next
			else delete entry.allocated
			list[index] = entry
			fm.entries = list
		})
	}

	readRevisions(file: TFile): DeckRevision[] {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const raw: unknown = frontmatter?.revisions
		if (!Array.isArray(raw)) return []
		return raw.flatMap((item: unknown): DeckRevision[] => {
			if (!isRecord(item) || typeof item.saved !== 'string' || !Array.isArray(item.entries)) return []
			const entries = (item.entries as unknown[]).flatMap((line) => {
				if (!isRecord(line)) return []
				const id = typeof line.id === 'string' && line.id.length > 0 ? line.id : null
				const qty =
					typeof line.qty === 'number' && Number.isInteger(line.qty) && line.qty > 0 ? line.qty : null
				if (!id || !qty) return []
				return [{ id, qty, link: typeof line.link === 'string' ? line.link : '' }]
			})
			const format: DeckFormat =
				item.format === 'standard' || item.format === 'expanded' || item.format === 'unlimited'
					? item.format
					: 'standard'
			return [{ saved: item.saved, label: typeof item.label === 'string' ? item.label : '', format, entries }]
		})
	}

	/** Builds a revision object snapshotting the CURRENT decklist. */
	snapshotRevision(file: TFile, label: string): DeckRevision {
		return {
			saved: localIsoDateTime(),
			label: label.trim(),
			format: this.readFormat(file),
			entries: this.readEntries(file).map((entry) => ({
				id: entry.id,
				link: entry.link,
				qty: entry.qty,
			})),
		}
	}

	/** Appends a revision to the deck's chronological revisions array. */
	async addRevision(file: TFile, revision: DeckRevision): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.revisions
			const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : []
			list.push({
				saved: revision.saved,
				...(revision.label.length > 0 ? { label: revision.label } : {}),
				format: revision.format,
				entries: revision.entries,
			})
			fm.revisions = list
		})
	}

	/** Removes one revision by position in the stored (chronological) array. */
	async removeRevision(file: TFile, index: number): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const raw: unknown = fm.revisions
			if (!Array.isArray(raw) || index < 0 || index >= raw.length) return
			const list = [...(raw as unknown[])]
			list.splice(index, 1)
			if (list.length > 0) fm.revisions = list
			else delete fm.revisions
		})
	}

	/** Replaces the whole decklist — used by revision restore. */
	async setEntries(file: TFile, entries: { id: string; link: string; qty: number }[]): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm.entries = entries.map((entry) => ({ id: entry.id, link: entry.link, qty: entry.qty }))
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

	/**
	 * Lifecycle of a deck:
	 * - 'assembled': physically built — reserves every copy it lists.
	 * - 'building': the user is actively hunting its cards — flagged on the
	 *   dashboard; reserves only the copies bought for it (allocated).
	 * - 'list': just an idea/reference — reserves only allocated copies too.
	 *
	 * Default is 'assembled' (legacy behavior); the pre-status boolean
	 * `assembled: false` reads as 'building' (users unticked exactly the
	 * decks they were completing).
	 */
	readStatus(file: TFile): DeckStatus {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter
		const status: unknown = frontmatter?.status
		if (status === 'assembled' || status === 'building' || status === 'list') return status
		return frontmatter?.assembled === false ? 'building' : 'assembled'
	}

	async setStatus(file: TFile, status: DeckStatus): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			// 'assembled' is the default — keep the frontmatter clean.
			if (status === 'assembled') delete fm.status
			else fm.status = status
			delete fm.assembled // legacy boolean, superseded by status
		})
	}

	/** Only assembled decks hold (and therefore reserve) their full list. */
	readAssembled(file: TFile): boolean {
		return this.readStatus(file) === 'assembled'
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
