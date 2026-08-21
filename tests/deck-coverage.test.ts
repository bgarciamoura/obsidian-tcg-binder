import { describe, expect, it } from 'vitest'
import { coverLines } from '../src/domain/deck-coverage'

describe('coverLines', () => {
	it('covers lines in order until the pool runs out', () => {
		expect(coverLines([{ qty: 2 }, { qty: 1 }, { qty: 3 }], 4)).toEqual([2, 1, 1])
	})

	it('covers everything when the pool is large enough', () => {
		expect(coverLines([{ qty: 2 }, { qty: 2 }], 10)).toEqual([2, 2])
	})

	it('covers nothing with an empty or negative pool', () => {
		expect(coverLines([{ qty: 3 }], 0)).toEqual([0])
		expect(coverLines([{ qty: 3 }], -2)).toEqual([0])
	})
})
