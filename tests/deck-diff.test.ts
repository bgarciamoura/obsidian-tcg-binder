import { describe, expect, it } from 'vitest'
import { diffDecklists } from '../src/domain/deck-diff'

describe('diffDecklists', () => {
	it('reports quantity changes, additions and removals per printing', () => {
		const from = [
			{ id: 'sv07-114', qty: 3 },
			{ id: 'me05-012', qty: 4 },
		]
		const to = [
			{ id: 'sv07-114', qty: 2 },
			{ id: 'sv08.5-077', qty: 1 },
			{ id: 'me05-012', qty: 4 },
		]
		expect(diffDecklists(from, to)).toEqual([
			{ id: 'sv07-114', delta: -1 },
			{ id: 'sv08.5-077', delta: 1 },
		])
	})

	it('returns empty for identical lists', () => {
		const lines = [{ id: 'a-1', qty: 4 }]
		expect(diffDecklists(lines, lines)).toEqual([])
	})

	it('merges duplicate lines of the same id before comparing', () => {
		expect(
			diffDecklists(
				[
					{ id: 'a-1', qty: 2 },
					{ id: 'a-1', qty: 2 },
				],
				[{ id: 'a-1', qty: 4 }],
			),
		).toEqual([])
	})
})
