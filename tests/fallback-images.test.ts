import { describe, expect, it } from 'vitest'
import {
	pokemonTcgIoImageCandidates,
	pokemonTcgIoSetIdCandidates,
} from '../src/services/card-data/fallback-images'

describe('pokemonTcgIoSetIdCandidates', () => {
	it('drops zero padding', () => {
		expect(pokemonTcgIoSetIdCandidates('sv01')).toEqual(['sv1'])
		expect(pokemonTcgIoSetIdCandidates('me01')).toEqual(['me1'])
	})

	it('keeps unpadded ids untouched', () => {
		expect(pokemonTcgIoSetIdCandidates('bw4')).toEqual(['bw4'])
		expect(pokemonTcgIoSetIdCandidates('mep')).toEqual(['mep'])
		expect(pokemonTcgIoSetIdCandidates('sve')).toEqual(['sve'])
	})

	it('offers both half-set conventions, SV-style first', () => {
		expect(pokemonTcgIoSetIdCandidates('sv06.5')).toEqual(['sv6pt5', 'sv65'])
		expect(pokemonTcgIoSetIdCandidates('sm3.5')).toEqual(['sm3pt5', 'sm35'])
		expect(pokemonTcgIoSetIdCandidates('me02.5')).toEqual(['me2pt5', 'me25'])
	})
})

describe('pokemonTcgIoImageCandidates', () => {
	it('builds hires URLs from the candidates', () => {
		expect(pokemonTcgIoImageCandidates('sve', '4')).toEqual([
			'https://images.pokemontcg.io/sve/4_hires.png',
		])
		expect(pokemonTcgIoImageCandidates('sv06.5', '61')).toEqual([
			'https://images.pokemontcg.io/sv6pt5/61_hires.png',
			'https://images.pokemontcg.io/sv65/61_hires.png',
		])
	})
})
