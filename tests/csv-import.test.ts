import { describe, expect, it } from 'vitest'
import { parseCsv } from '../src/domain/csv'
import { mapCsvRows } from '../src/domain/csv-import'

describe('mapCsvRows', () => {
	it('maps a ManaBox-style export', () => {
		const cells = parseCsv(
			[
				'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Condition',
				'Pikachu ex,SVI,Scarlet & Violet,45,normal,Rare,2,Near Mint',
				'Gyarados ex,SVI,Scarlet & Violet,45,foil,Rare,1,Lightly Played',
			].join('\n'),
		)
		const result = mapCsvRows(cells)
		expect(result.errors).toEqual([])
		expect(result.rows).toHaveLength(2)
		expect(result.rows[0]).toMatchObject({
			name: 'Pikachu ex',
			setCode: 'SVI',
			setName: 'Scarlet & Violet',
			number: '45',
			quantity: 2,
			variant: 'normal',
			condition: 'NM',
		})
		expect(result.rows[1]).toMatchObject({ variant: 'holo', condition: 'LP' })
	})

	it('maps a TCG Collector-style export with slashed numbers', () => {
		const cells = parseCsv(
			['Card Name,Set,Card Number,Qty,Printing', 'Charizard,Obsidian Flames,125/197,1,Reverse Holo'].join(
				'\n',
			),
		)
		const result = mapCsvRows(cells)
		expect(result.rows[0]).toMatchObject({
			name: 'Charizard',
			setName: 'Obsidian Flames',
			number: '125',
			variant: 'reverse-holo',
		})
	})

	it('defaults quantity to 1 and condition to NM when columns are missing', () => {
		const result = mapCsvRows(parseCsv('Name\nPikachu'))
		expect(result.rows[0]).toMatchObject({ quantity: 1, condition: 'NM', variant: 'normal' })
	})

	it('errors when there is no recognizable name column', () => {
		const result = mapCsvRows(parseCsv('Foo,Bar\n1,2'))
		expect(result.rows).toEqual([])
		expect(result.errors).toHaveLength(1)
	})

	it('reports rows with invalid quantity or empty name', () => {
		const result = mapCsvRows(parseCsv('Name,Quantity\nPikachu,0\n,3'))
		expect(result.rows).toEqual([])
		expect(result.errors.map((e) => e.line)).toEqual([2, 3])
	})
})
