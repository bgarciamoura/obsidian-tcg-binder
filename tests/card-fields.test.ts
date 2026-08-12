import { describe, expect, it } from 'vitest'
import { canonicalSupertype } from '../src/domain/card-fields'

describe('canonicalSupertype', () => {
	it('keeps canonical values unchanged', () => {
		expect(canonicalSupertype('Pokémon')).toBe('Pokémon')
		expect(canonicalSupertype('Trainer')).toBe('Trainer')
		expect(canonicalSupertype('Energy')).toBe('Energy')
	})

	it('normalizes the unaccented English "Pokemon" from TCGdex', () => {
		expect(canonicalSupertype('Pokemon')).toBe('Pokémon')
	})

	it('normalizes Portuguese categories (the reported bug)', () => {
		expect(canonicalSupertype('Energia')).toBe('Energy')
		expect(canonicalSupertype('Treinador')).toBe('Trainer')
	})

	it('normalizes the other supported TCGdex locales', () => {
		// es / fr / de / it / ja
		expect(canonicalSupertype('Energía')).toBe('Energy')
		expect(canonicalSupertype('Énergie')).toBe('Energy')
		expect(canonicalSupertype('Energie')).toBe('Energy')
		expect(canonicalSupertype('Entrenador')).toBe('Trainer')
		expect(canonicalSupertype('Dresseur')).toBe('Trainer')
		expect(canonicalSupertype('Allenatore')).toBe('Trainer')
		expect(canonicalSupertype('エネルギー')).toBe('Energy')
		expect(canonicalSupertype('トレーナー')).toBe('Trainer')
		expect(canonicalSupertype('ポケモン')).toBe('Pokémon')
	})

	it('is case- and whitespace-tolerant', () => {
		expect(canonicalSupertype('  energia ')).toBe('Energy')
		expect(canonicalSupertype('ENERGY')).toBe('Energy')
	})

	it('passes unknown values through unchanged (manual notes)', () => {
		expect(canonicalSupertype('Stadium')).toBe('Stadium')
		expect(canonicalSupertype('')).toBe('')
		expect(canonicalSupertype(null)).toBeNull()
	})
})
