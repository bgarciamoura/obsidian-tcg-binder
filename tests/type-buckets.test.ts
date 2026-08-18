import { describe, expect, it } from 'vitest'
import { bucketFor, canonicalPokemonType } from '../src/domain/type-buckets'

describe('canonicalPokemonType', () => {
	it('maps localized TCGdex type names to canonical types', () => {
		expect(canonicalPokemonType('Planta')).toBe('grass')
		expect(canonicalPokemonType('Elétrico')).toBe('lightning')
		expect(canonicalPokemonType('Sombrio')).toBe('darkness')
		expect(canonicalPokemonType('Lutador')).toBe('fighting')
		expect(canonicalPokemonType('Fire')).toBe('fire')
		expect(canonicalPokemonType('Incolor')).toBe('colorless')
	})

	it('treats the videogame name Normal as the TCG Colorless', () => {
		expect(canonicalPokemonType('Normal')).toBe('colorless')
	})

	it('matches without accents and via extra aliases', () => {
		expect(canonicalPokemonType('Eletrico')).toBe('lightning')
		expect(canonicalPokemonType('ELÉTRICO')).toBe('lightning')
		expect(canonicalPokemonType('Aço')).toBe('metal')
		expect(canonicalPokemonType('Escuridão')).toBe('darkness')
		expect(canonicalPokemonType('Dark')).toBe('darkness')
		expect(canonicalPokemonType('Steel')).toBe('metal')
		expect(canonicalPokemonType('Electric')).toBe('lightning')
	})

	it('returns null for unknown values', () => {
		expect(canonicalPokemonType('???')).toBeNull()
		expect(canonicalPokemonType(null)).toBeNull()
	})
})

describe('bucketFor', () => {
	it('buckets Pokémon by their first energy type', () => {
		expect(
			bucketFor({ supertype: 'Pokémon', subtypes: null, types: ['Planta'], name: 'Tarountula', nameEn: null }),
		).toBe('pokemon-grass')
		expect(
			bucketFor({ supertype: 'Pokémon', subtypes: null, types: ['Dragon'], name: 'Dragapult ex', nameEn: null }),
		).toBe('pokemon-dragon')
	})

	it('falls back to the plain Pokémon bucket without a known type', () => {
		expect(
			bucketFor({ supertype: 'Pokémon', subtypes: null, types: null, name: 'Missingno', nameEn: null }),
		).toBe('pokemon')
	})

	it('buckets trainers by localized subtype', () => {
		const base = { supertype: 'Trainer', types: null, name: 'X', nameEn: null }
		expect(bucketFor({ ...base, subtypes: ['Apoiador'] })).toBe('supporters')
		expect(bucketFor({ ...base, subtypes: ['Estádio'] })).toBe('stadiums')
		expect(bucketFor({ ...base, subtypes: ['Ferramenta'] })).toBe('tools')
		expect(bucketFor({ ...base, subtypes: ['Item'] })).toBe('items')
		expect(bucketFor({ ...base, subtypes: ['Supporter'] })).toBe('supporters')
		expect(bucketFor({ ...base, subtypes: null })).toBe('trainers')
	})

	it('splits energies by the fixed basic-energy names, not the energyType flag', () => {
		expect(
			bucketFor({
				supertype: 'Energy',
				subtypes: ['Normal'],
				types: null,
				name: 'Energia de Raios',
				nameEn: 'Lightning Energy',
			}),
		).toBe('energy-basic')
		// TCGdex mislabels some special energies as "Normal" — the name decides.
		expect(
			bucketFor({
				supertype: 'Energy',
				subtypes: ['Normal'],
				types: null,
				name: 'Energia Psychic Telepática',
				nameEn: 'Telepathic Psychic Energy',
			}),
		).toBe('energy-special')
	})

	it('returns null for cards without a known supertype', () => {
		expect(bucketFor({ supertype: null, subtypes: null, types: null, name: 'Manual', nameEn: null })).toBeNull()
	})
})
