import { describe, expect, it } from 'vitest'
import { parseCardList, serializeCardList } from '../src/domain/card-list'

describe('serializeCardList', () => {
	it('groups by supertype with counts and a total footer', () => {
		const text = serializeCardList([
			{ quantity: 4, name: 'Pikachu ex', setCode: 'SVI', number: '45', supertype: 'Pokémon' },
			{ quantity: 4, name: "Professor's Research", setCode: 'SVI', number: '189', supertype: 'Trainer' },
			{ quantity: 12, name: 'Lightning Energy', setCode: 'SVE', number: '4', supertype: 'Energy' },
		])
		expect(text).toBe(
			[
				'Pokémon: 4',
				'4 Pikachu ex SVI 45',
				'',
				'Trainer: 4',
				"4 Professor's Research SVI 189",
				'',
				'Energy: 12',
				'12 Lightning Energy SVE 4',
				'',
				'Total Cards: 20',
			].join('\n'),
		)
	})

	it('buckets unknown supertypes under Trainer and omits missing set data', () => {
		const text = serializeCardList([
			{ quantity: 1, name: 'Mystery card', setCode: null, number: null, supertype: null },
		])
		expect(text).toBe('Trainer: 1\n1 Mystery card\n\nTotal Cards: 1')
	})

	it('round-trips through parseCardList', () => {
		const cards = [
			{ quantity: 4, name: 'Pikachu ex', setCode: 'SVI', number: '45', supertype: 'Pokémon' },
			{ quantity: 2, name: 'Iono', setCode: 'PAL', number: '185', supertype: 'Trainer' },
		]
		const parsed = parseCardList(serializeCardList(cards))
		expect(parsed.errors).toEqual([])
		expect(parsed.entries.map((e) => ({ quantity: e.quantity, name: e.name, setCode: e.setCode, number: e.number }))).toEqual(
			cards.map(({ supertype: _supertype, ...rest }) => rest),
		)
	})
})
