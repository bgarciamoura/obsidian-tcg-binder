import type { GameId } from '../../types'

/** The card API refused the request due to rate limiting (HTTP 429). */
export class RateLimitError extends Error {
	constructor() {
		super('Card API rate limit reached')
	}
}

export interface CardAbility {
	name: string
	text: string
}

export interface CardAttack {
	name: string
	/** Energy cost as type names, e.g. ["Lightning", "Colorless"]. */
	cost: string[]
	damage: string | null
	text: string | null
}

/**
 * Full card text, only present on cards fetched from a detail endpoint
 * (search resumes and older disk caches don't carry it). Localized to the
 * configured card language where the source supports it.
 */
export interface CardDetails {
	hp: string | null
	types: string[]
	evolvesFrom: string | null
	abilities: CardAbility[]
	attacks: CardAttack[]
	/** Trainer/Special Energy effect and rule-box paragraphs. */
	rules: string[]
	retreat: number | null
	flavorText: string | null
	illustrator: string | null
}

/** Normalized card shape shared by every data source, regardless of game. */
export interface CardData {
	id: string
	game: GameId
	name: string
	setId: string
	/** Short set abbreviation used in decklists (PTCGO code), e.g. "SVI". */
	setCode: string | null
	setName: string
	number: string
	supertype: string
	subtypes: string[]
	rarity: string | null
	imageSmall: string | null
	imageLarge: string | null
	/** Market price in USD (TCGplayer) at fetch time, if available. */
	marketPrice: number | null
	/** Canonical English name — the cross-language, cross-printing identity key. */
	nameEn: string | null
	/** Formats where the card is currently legal, e.g. ["standard", "expanded"]. */
	legalities: string[]
	/** Exempt from deck copy limits (e.g. Pokémon basic energy). */
	copyLimitExempt: boolean
	/** Full card text — see CardDetails. Absent on partial results. */
	details?: CardDetails
}

/** Normalized set/expansion shape. */
export interface SetInfo {
	id: string
	game: GameId
	name: string
	series: string
	/** Decklist abbreviation (PTCGO code), e.g. "SVI". Not every set has one. */
	code: string | null
	total: number
	/** The printed denominator on cards ("…/198") — excludes secret rares. */
	printedTotal: number
	releaseDate: string
	symbolUrl: string | null
}

export interface CardSearchQuery {
	name?: string
	setId?: string
	number?: string
	page?: number
	pageSize?: number
}

/**
 * Adapter interface for card databases. One implementation per game/API
 * (Pokémon today; MTG, One Piece, ... later) — the rest of the plugin only
 * ever talks to this interface.
 */
export interface CardDataSource {
	readonly game: GameId
	/** Stable source identifier ("tcgdex", "pokemontcg-io") — card ids are only meaningful within one source. */
	readonly id: string
	/**
	 * Extra cache-segmentation key for state that varies beyond the source id
	 * (e.g. TCGdex card language). Undefined when the source has no such axis.
	 */
	readonly cacheQualifier?: string
	searchCards(query: CardSearchQuery): Promise<CardData[]>
	getCard(id: string): Promise<CardData | null>
	getSets(): Promise<SetInfo[]>
	/** Every card of a set, with prices — powers CSV import and cost-to-completion. */
	getSetCards(setId: string): Promise<CardData[]>
	/**
	 * localId → canonical (English) name for a set. Sources whose names are
	 * already canonical may omit this.
	 */
	getCanonicalNames?(setId: string): Promise<Map<string, string>>
}
