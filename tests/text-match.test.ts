import { describe, expect, it } from 'vitest'
import { matchesAllTokens, normalizeForMatch, searchAnchor } from '../src/domain/text-match'

describe('normalizeForMatch', () => {
	it('strips diacritics and lowercases', () => {
		expect(normalizeForMatch('Substituição')).toBe('substituicao')
		expect(normalizeForMatch('Pokémon')).toBe('pokemon')
	})
})

describe('matchesAllTokens', () => {
	it('matches printed abbreviations against full names', () => {
		expect(matchesAllTokens('Rocky Fighting Energy', 'Rocky F Energy')).toBe(true)
		expect(matchesAllTokens('Rocky Fighting Energy', 'rocky energy')).toBe(true)
	})

	it('matches regardless of accents in either side', () => {
		expect(matchesAllTokens('Substituição', 'substituicao')).toBe(true)
		expect(matchesAllTokens('Substituicao', 'Substituição')).toBe(true)
	})

	it('rejects names missing a token', () => {
		expect(matchesAllTokens('Rocky Fighting Energy', 'Rocky W Energy')).toBe(false)
		expect(matchesAllTokens('Switch', 'Switch Cart')).toBe(false)
	})
})

describe('searchAnchor', () => {
	it('avoids generic TCG words as the anchor', () => {
		expect(searchAnchor('Rocky F Energy')).toBe('Rocky')
		expect(searchAnchor('Pikachu ex')).toBe('Pikachu')
		expect(searchAnchor('Energia Fighting Rochosa')).toBe('Fighting')
	})

	it('falls back to the longest token when everything is generic', () => {
		expect(searchAnchor('Basic Energy')).toBe('Energy')
	})

	it('handles single-word and empty queries', () => {
		expect(searchAnchor('Substituição')).toBe('Substituição')
		expect(searchAnchor('  ')).toBe('')
	})
})
