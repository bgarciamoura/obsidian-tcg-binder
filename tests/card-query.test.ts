import { describe, expect, it } from 'vitest'
import { parseCardQuery } from '../src/domain/card-query'

describe('parseCardQuery', () => {
	it('treats plain text as a name query', () => {
		expect(parseCardQuery('Pikachu')).toEqual({ name: 'Pikachu' })
		expect(parseCardQuery('Mew ex')).toEqual({ name: 'Mew ex' })
		expect(parseCardQuery("N's Zoroark")).toEqual({ name: "N's Zoroark" })
	})

	it('parses set code + number', () => {
		expect(parseCardQuery('SVI 45')).toEqual({ setCode: 'SVI', number: '45' })
		expect(parseCardQuery('svi-45')).toEqual({ setCode: 'SVI', number: '45' })
		expect(parseCardQuery('svi/45')).toEqual({ setCode: 'SVI', number: '45' })
	})

	it('strips leading zeros from numbers', () => {
		expect(parseCardQuery('PAL 045')).toEqual({ setCode: 'PAL', number: '45' })
		expect(parseCardQuery('045')).toEqual({ number: '45' })
	})

	it('parses collector-number-only queries', () => {
		expect(parseCardQuery('45/198')).toEqual({ number: '45' })
		expect(parseCardQuery('45')).toEqual({ number: '45' })
	})

	it('keeps suffixed numbers like "TG12"-style promos intact', () => {
		expect(parseCardQuery('SVP 45a')).toEqual({ setCode: 'SVP', number: '45a' })
	})

	it('parses word + number as set code — callers must validate against the catalog', () => {
		expect(parseCardQuery('Iono 185')).toEqual({ setCode: 'IONO', number: '185' })
	})

	it('trims surrounding whitespace', () => {
		expect(parseCardQuery('  Charizard  ')).toEqual({ name: 'Charizard' })
	})
})
