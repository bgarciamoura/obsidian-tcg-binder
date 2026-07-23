import { describe, expect, it } from 'vitest'
import { POKEMON_DECK_RULES, countCards, isBasicEnergy, validateDeck } from '../src/domain/deck-rules'
import type { DeckEntry } from '../src/types'

function entry(name: string, quantity: number, copyLimitExempt = false): DeckEntry {
	return {
		card: { game: 'pokemon', cardId: `test-${name}-${copyLimitExempt ? 'e' : 'n'}`, name },
		quantity,
		copyLimitExempt,
	}
}

function legalDeck(): DeckEntry[] {
	// 15 distinct names × 4 copies = 60 cards
	return Array.from({ length: 15 }, (_, i) => entry(`Card ${i}`, 4))
}

describe('countCards', () => {
	it('sums quantities across entries', () => {
		expect(countCards([entry('A', 4), entry('B', 2)])).toBe(6)
	})
})

describe('isBasicEnergy', () => {
	it('recognizes the nine basic energies, with or without the "Basic" prefix', () => {
		expect(isBasicEnergy('Energy', 'Fighting Energy')).toBe(true)
		expect(isBasicEnergy('Energy', 'Basic Lightning Energy')).toBe(true)
		expect(isBasicEnergy('Energy', 'Darkness Energy')).toBe(true)
	})

	it('rejects special energies and non-energy cards', () => {
		expect(isBasicEnergy('Energy', 'Jet Energy')).toBe(false)
		expect(isBasicEnergy('Energy', 'Double Turbo Energy')).toBe(false)
		expect(isBasicEnergy('Trainer', 'Fighting Energy')).toBe(false)
		expect(isBasicEnergy(null, 'Fighting Energy')).toBe(false)
	})
})

describe('validateDeck', () => {
	it('accepts a legal 60-card deck', () => {
		expect(validateDeck(legalDeck())).toEqual([])
	})

	it('flags a deck that is not exactly 60 cards', () => {
		const issues = validateDeck([entry('A', 4)])
		expect(issues.map((i) => i.code)).toContain('deck-size')
	})

	it('flags more than 4 copies of the same name', () => {
		const deck = [...legalDeck().slice(0, 13), entry('Pikachu', 5), entry('Filler', 3)]
		const issues = validateDeck(deck)
		expect(issues.map((i) => i.code)).toContain('copy-limit')
	})

	it('aggregates copies across different printings of the same name', () => {
		const printings = [
			{ card: { game: 'pokemon' as const, cardId: 'sv1-25', name: 'Pikachu' }, quantity: 3 },
			{ card: { game: 'pokemon' as const, cardId: 'sv2-52', name: 'Pikachu' }, quantity: 2 },
		]
		const deck = [...legalDeck().slice(0, 13), ...printings, entry('Filler', 3)]
		const issues = validateDeck(deck)
		expect(issues.map((i) => i.code)).toContain('copy-limit')
	})

	it('exempts basic energy from the copy limit', () => {
		const deck = [...legalDeck().slice(0, 10), entry('Basic Lightning Energy', 20, true)]
		expect(validateDeck(deck)).toEqual([])
	})

	it('flags non-positive and non-integer quantities', () => {
		const issues = validateDeck([entry('A', 0), entry('B', 2.5)])
		const codes = issues.map((i) => i.code)
		expect(codes.filter((c) => c === 'invalid-quantity')).toHaveLength(2)
	})

	it('respects a custom rule set', () => {
		const issues = validateDeck([entry('A', 2)], { deckSize: 2, maxCopies: 1 })
		expect(issues.map((i) => i.code)).toEqual(['copy-limit'])
		expect(POKEMON_DECK_RULES.deckSize).toBe(60)
	})
})
