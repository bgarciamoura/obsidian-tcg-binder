import { describe, expect, it } from 'vitest'
import { computeSetProgress } from '../src/domain/set-progress'

describe('computeSetProgress', () => {
	it('computes owned/total and a floored percent', () => {
		expect(computeSetProgress(50, 198)).toEqual({ owned: 50, total: 198, percent: 25 })
	})

	it('caps at 100% even when owning more uniques than the set total reports', () => {
		expect(computeSetProgress(210, 198).percent).toBe(100)
	})

	it('handles unknown set totals without dividing by zero', () => {
		expect(computeSetProgress(3, 0)).toEqual({ owned: 3, total: 0, percent: 0 })
	})

	it('reports 100% for a completed set', () => {
		expect(computeSetProgress(198, 198).percent).toBe(100)
	})
})
