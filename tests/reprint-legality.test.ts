import { describe, expect, it } from 'vitest'
import { legalitiesByFunctionalName } from '../src/domain/deck-rules'

describe('legalitiesByFunctionalName', () => {
	it('unions legalities across printings of the same name', () => {
		const map = legalitiesByFunctionalName([
			{ id: 'sv1-196', name: 'Ultra Ball', nameEn: 'Ultra Ball', legalities: ['expanded', 'unlimited'] },
			{ id: 'me1-131', name: 'Ultra Ball', nameEn: 'Ultra Ball', legalities: ['standard', 'expanded', 'unlimited'] },
		])
		const key = [...map.keys()][0]
		expect(map.size).toBe(1)
		expect([...map.get(key)!]).toEqual(expect.arrayContaining(['standard', 'expanded', 'unlimited']))
	})

	it('matches localized printings through the canonical English name', () => {
		const map = legalitiesByFunctionalName([
			{ id: 'sv1-196', name: 'Ultra Bola', nameEn: 'Ultra Ball', legalities: ['expanded'] },
			{ id: 'me1-131', name: 'Ultra Ball', nameEn: null, legalities: ['standard'] },
		])
		// nameEn falls back to name for the English note — both share one key.
		expect(map.size).toBe(1)
		expect([...map.values()][0].has('standard')).toBe(true)
	})

	it('keeps different cards separate and skips unknown legalities', () => {
		const map = legalitiesByFunctionalName([
			{ id: 'a-1', name: 'Rare Candy', nameEn: 'Rare Candy', legalities: ['expanded'] },
			{ id: 'b-2', name: 'Switch', nameEn: 'Switch', legalities: ['standard'] },
			{ id: 'c-3', name: 'Manual Card', nameEn: null, legalities: null },
		])
		expect(map.size).toBe(2)
	})

	it('falls back to the card id when no name is known', () => {
		const map = legalitiesByFunctionalName([
			{ id: 'x-9', name: null, nameEn: null, legalities: ['standard'] },
		])
		expect(map.size).toBe(1)
	})
})
