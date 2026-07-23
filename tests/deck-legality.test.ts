import { describe, expect, it } from 'vitest'
import { validateDeckLegality } from '../src/domain/deck-rules'

describe('validateDeckLegality', () => {
	const legalCard = { name: 'Pikachu ex', legalities: ['standard', 'expanded', 'unlimited'] }
	const expandedOnly = { name: 'Shaymin-EX', legalities: ['expanded', 'unlimited'] }
	const unknown = { name: 'Custom proxy', legalities: null }

	it('accepts decks where every card is legal in the format', () => {
		expect(validateDeckLegality([legalCard, expandedOnly], 'expanded')).toEqual([])
	})

	it('flags cards not legal in standard', () => {
		const issues = validateDeckLegality([legalCard, expandedOnly], 'standard')
		expect(issues).toHaveLength(1)
		expect(issues[0].code).toBe('illegal-card')
		expect(issues[0].message).toContain('Shaymin-EX')
	})

	it('surfaces unknown legality instead of guessing', () => {
		const issues = validateDeckLegality([unknown], 'standard')
		expect(issues.map((i) => i.code)).toEqual(['unknown-legality'])
	})

	it('does not restrict unlimited decks', () => {
		expect(validateDeckLegality([expandedOnly, unknown], 'unlimited')).toEqual([])
	})
})
