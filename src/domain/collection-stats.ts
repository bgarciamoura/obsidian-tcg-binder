import type { CollectionEntry } from '../types'

export interface CollectionStats {
	totalCards: number
	uniqueCards: number
}

/**
 * Pure aggregation over collection entries — unit-testable, view-agnostic.
 * Zero-quantity entries are checklist rows (set tracking), not owned cards,
 * so they count toward neither total.
 */
export function computeCollectionStats(entries: CollectionEntry[]): CollectionStats {
	const uniqueIds = new Set<string>()
	let totalCards = 0
	for (const entry of entries) {
		if (entry.quantity <= 0) continue
		totalCards += entry.quantity
		uniqueIds.add(entry.card.cardId)
	}
	return { totalCards, uniqueCards: uniqueIds.size }
}
