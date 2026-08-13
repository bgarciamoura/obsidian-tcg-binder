import { describe, expect, it } from 'vitest'
import { parseQuickEntries } from '../src/domain/quick-entry'

describe('parseQuickEntries', () => {
	it('parses a plain collector number', () => {
		expect(parseQuickEntries('45')).toEqual([{ raw: '45', number: '45', qty: 1, variant: null }])
	})

	it('parses a quantity suffix', () => {
		expect(parseQuickEntries('45x3')).toEqual([{ raw: '45x3', number: '45', qty: 3, variant: null }])
	})

	it('parses variant flags', () => {
		expect(parseQuickEntries('45r')[0]).toMatchObject({ number: '45', variant: 'reverse-holo' })
		expect(parseQuickEntries('45h')[0]).toMatchObject({ number: '45', variant: 'holo' })
		expect(parseQuickEntries('45p')[0]).toMatchObject({ number: '45', variant: 'promo' })
	})

	it('parses qty and variant in either order', () => {
		expect(parseQuickEntries('45x3r')[0]).toMatchObject({ number: '45', qty: 3, variant: 'reverse-holo' })
		expect(parseQuickEntries('45rx3')[0]).toMatchObject({ number: '45', qty: 3, variant: 'reverse-holo' })
	})

	it('is case-insensitive on flags', () => {
		expect(parseQuickEntries('45R')[0]).toMatchObject({ number: '45', variant: 'reverse-holo' })
		expect(parseQuickEntries('45X2')[0]).toMatchObject({ number: '45', qty: 2 })
	})

	it('splits batches on whitespace, commas and newlines', () => {
		const entries = parseQuickEntries('45 67,112x2\n8r')
		expect(entries.map((e) => e.number)).toEqual(['45', '67', '112', '8'])
		expect(entries[2].qty).toBe(2)
		expect(entries[3].variant).toBe('reverse-holo')
	})

	it('keeps alphanumeric collector numbers intact', () => {
		expect(parseQuickEntries('TG12')[0]).toMatchObject({ number: 'TG12', variant: null })
		expect(parseQuickEntries('SWSH039')[0]).toMatchObject({ number: 'SWSH039', variant: null })
		expect(parseQuickEntries('TG12x2')[0]).toMatchObject({ number: 'TG12', qty: 2 })
	})

	it('only strips a flag when preceded by a digit', () => {
		// "45a" is a plausible printed number, 'a' is not a flag anyway;
		// a trailing flag letter after another letter is part of the number.
		expect(parseQuickEntries('45a')[0]).toMatchObject({ number: '45a', variant: null })
		expect(parseQuickEntries('xyr')[0]).toMatchObject({ number: 'xyr', variant: null })
	})

	it('keeps the raw token for literal-number fallback', () => {
		expect(parseQuickEntries('20h')[0]).toMatchObject({ raw: '20h', number: '20', variant: 'holo' })
	})

	it('clamps quantity to at least 1 and ignores empty tokens', () => {
		expect(parseQuickEntries('45x0')[0]).toMatchObject({ qty: 1 })
		expect(parseQuickEntries('  ,  ')).toEqual([])
		expect(parseQuickEntries('')).toEqual([])
	})

	it('leaves a qty-like token without a number unresolved rather than guessing', () => {
		expect(parseQuickEntries('x3')[0]).toMatchObject({ number: 'x3', qty: 1 })
	})
})
