import { isBasicEnergy } from './deck-rules'

/**
 * Buckets for splitting a mixed collection by card type: trainers by their
 * subtype, energies by basic/special, Pokémon by their (first) energy type.
 */
export type TypeBucket =
	| 'items'
	| 'supporters'
	| 'stadiums'
	| 'tools'
	| 'trainers'
	| 'energy-basic'
	| 'energy-special'
	| 'pokemon'
	| `pokemon-${PokemonType}`

export type PokemonType =
	| 'grass'
	| 'fire'
	| 'water'
	| 'lightning'
	| 'psychic'
	| 'fighting'
	| 'darkness'
	| 'metal'
	| 'dragon'
	| 'colorless'
	| 'fairy'

/** TCGdex localizes `types` — map every known locale back to canonical. */
const POKEMON_TYPES: Record<string, PokemonType> = {
	// en / pt / es / fr / de / it (unknown values fall back to plain "pokemon")
	grass: 'grass', planta: 'grass', plante: 'grass', pflanze: 'grass', erba: 'grass',
	fire: 'fire', fogo: 'fire', fuego: 'fire', feu: 'fire', feuer: 'fire', fuoco: 'fire',
	water: 'water', água: 'water', agua: 'water', eau: 'water', wasser: 'water', acqua: 'water',
	lightning: 'lightning', elétrico: 'lightning', rayo: 'lightning', électrique: 'lightning', elektro: 'lightning', lampo: 'lightning',
	psychic: 'psychic', psíquico: 'psychic', psy: 'psychic', psycho: 'psychic', psico: 'psychic',
	fighting: 'fighting', lutador: 'fighting', lucha: 'fighting', combat: 'fighting', kampf: 'fighting', lotta: 'fighting',
	darkness: 'darkness', sombrio: 'darkness', oscuridad: 'darkness', obscurité: 'darkness', finsternis: 'darkness', oscurità: 'darkness',
	metal: 'metal', metálico: 'metal', métal: 'metal', metall: 'metal', metallo: 'metal',
	dragon: 'dragon', dragão: 'dragon', dragón: 'dragon', drache: 'dragon', drago: 'dragon',
	colorless: 'colorless', incolor: 'colorless', incoloro: 'colorless', incolore: 'colorless', farblos: 'colorless',
	fairy: 'fairy', fada: 'fairy', hada: 'fairy', fée: 'fairy', fee: 'fairy', folletto: 'fairy',
}

/** TCGdex localizes `trainerType` too ("Apoiador", "Estádio", ...). */
const TRAINER_BUCKETS: Record<string, TypeBucket> = {
	item: 'items', objet: 'items', objeto: 'items', strumento: 'items',
	supporter: 'supporters', apoiador: 'supporters', partidario: 'supporters', unterstützer: 'supporters', aiutante: 'supporters',
	stadium: 'stadiums', estádio: 'stadiums', estadio: 'stadiums', stade: 'stadiums', stadion: 'stadiums',
	tool: 'tools', ferramenta: 'tools', herramienta: 'tools', outil: 'tools', oggetto: 'tools',
}

export function canonicalPokemonType(value: string | null | undefined): PokemonType | null {
	if (!value) return null
	return POKEMON_TYPES[value.trim().toLowerCase()] ?? null
}

export interface BucketCard {
	/** Canonical supertype (readCardMeta normalizes localized values). */
	supertype: string | null
	subtypes: string[] | null
	types: string[] | null
	name: string
	nameEn: string | null
}

/**
 * The bucket a card belongs to, or null when the type is unknown (manual
 * note without a supertype) — those stay in the source collection.
 *
 * Basic vs special energy goes by the nine fixed basic-energy NAMES, not by
 * the source's energyType flag — TCGdex mislabels some special energies as
 * "Normal" (seen live: Telepathic Psychic Energy), and names cannot lie.
 */
export function bucketFor(card: BucketCard): TypeBucket | null {
	if (card.supertype === 'Pokémon') {
		const type = canonicalPokemonType(card.types?.[0])
		return type ? `pokemon-${type}` : 'pokemon'
	}
	if (card.supertype === 'Energy') {
		return isBasicEnergy('Energy', card.nameEn ?? card.name) ? 'energy-basic' : 'energy-special'
	}
	if (card.supertype === 'Trainer') {
		for (const subtype of card.subtypes ?? []) {
			const bucket = TRAINER_BUCKETS[subtype.trim().toLowerCase()]
			if (bucket) return bucket
		}
		return 'trainers'
	}
	return null
}
