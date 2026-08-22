import { describe, expect, it } from 'vitest'
import { moveItem } from '../src/domain/reorder'

describe('moveItem', () => {
	it('moves an item forward', () => {
		expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
	})

	it('moves an item backward', () => {
		expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
	})

	it('moving onto itself keeps the order', () => {
		expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
	})

	it('ignores out-of-range indexes', () => {
		expect(moveItem(['a', 'b'], -1, 1)).toEqual(['a', 'b'])
		expect(moveItem(['a', 'b'], 0, 2)).toEqual(['a', 'b'])
	})

	it('does not mutate the input', () => {
		const input = ['a', 'b', 'c']
		moveItem(input, 0, 2)
		expect(input).toEqual(['a', 'b', 'c'])
	})
})
