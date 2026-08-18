import { describe, expect, it } from 'vitest'
import { localIsoDate } from '../src/utils/date'

describe('localIsoDate', () => {
	it('formats using local calendar fields, not UTC', () => {
		// 23:30 local on Dec 31st — toISOString() would already say Jan 1st
		// in any timezone west of Greenwich.
		const date = new Date(2026, 11, 31, 23, 30, 0)
		expect(localIsoDate(date)).toBe('2026-12-31')
	})

	it('zero-pads month and day', () => {
		expect(localIsoDate(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05')
	})
})
