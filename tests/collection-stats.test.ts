import { describe, expect, it } from 'vitest'
import { computeCollectionStats } from '../src/domain/collection-stats'
import type { CollectionEntry } from '../src/types'

function collectionEntry(cardId: string, quantity: number): CollectionEntry {
	return {
		card: { game: 'pokemon', cardId, name: cardId },
		quantity,
		variant: 'normal',
		condition: 'NM',
	}
}

describe('computeCollectionStats', () => {
	it('returns zeros for an empty collection', () => {
		expect(computeCollectionStats([])).toEqual({ totalCards: 0, uniqueCards: 0 })
	})

	it('counts totals and unique cards across variants of the same card', () => {
		const entries = [
			collectionEntry('sv1-25', 3),
			collectionEntry('sv1-25', 1),
			collectionEntry('sv2-52', 2),
		]
		expect(computeCollectionStats(entries)).toEqual({ totalCards: 6, uniqueCards: 2 })
	})

	it('ignores zero-quantity checklist rows', () => {
		const entries = [collectionEntry('sv1-25', 0), collectionEntry('sv2-52', 1)]
		expect(computeCollectionStats(entries)).toEqual({ totalCards: 1, uniqueCards: 1 })
	})
})
