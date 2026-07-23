import { describe, expect, it } from 'vitest'
import { parseCardList } from '../src/domain/card-list'

describe('parseCardList', () => {
	it('parses a full TCG Live export with section headers', () => {
		const text = [
			'Pokémon: 8',
			'4 Pikachu ex SVI 45',
			'4 Charmander PAF 7',
			'Trainer: 34',
			"4 Professor's Research SVI 189",
			'Energy: 18',
			'18 Lightning Energy SVE 4',
			'Total Cards: 60',
		].join('\n')

		const result = parseCardList(text)
		expect(result.errors).toEqual([])
		expect(result.entries).toHaveLength(4)
		expect(result.entries[0]).toEqual({
			quantity: 4,
			name: 'Pikachu ex',
			setCode: 'SVI',
			number: '45',
			line: 2,
		})
		expect(result.entries[2].name).toBe("Professor's Research")
		expect(result.entries[3].quantity).toBe(18)
	})

	it('tolerates RK9 star prefixes and "x" quantity suffixes', () => {
		const result = parseCardList('* 1 Bidoof BRS 120\n4x Pikachu SVI 45')
		expect(result.errors).toEqual([])
		expect(result.entries.map((e) => e.quantity)).toEqual([1, 4])
	})

	it('skips blank lines and normalizes set code case and leading zeros', () => {
		const result = parseCardList('\n\n2 Gyarados ex svi 045\n')
		expect(result.entries).toEqual([
			{ quantity: 2, name: 'Gyarados ex', setCode: 'SVI', number: '45', line: 3 },
		])
	})

	it('supports letter-prefixed collector numbers like TG12', () => {
		const result = parseCardList('1 Rayquaza VMAX TG20 TG20')
		expect(result.errors).toEqual([])
		expect(result.entries[0].number).toBe('TG20')
	})

	it('reports unparseable lines with their line numbers', () => {
		const result = parseCardList('4 Pikachu ex SVI 45\nnot a card line\n0 Snorlax SVI 143')
		expect(result.entries).toHaveLength(1)
		expect(result.errors).toEqual([
			{ line: 2, text: 'not a card line' },
			{ line: 3, text: '0 Snorlax SVI 143' },
		])
	})

	it('returns nothing for empty input', () => {
		expect(parseCardList('')).toEqual({ entries: [], errors: [] })
	})
})
