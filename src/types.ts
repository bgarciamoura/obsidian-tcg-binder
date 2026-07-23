/** Games the plugin can manage. Adding a new TCG starts here. */
export type GameId = 'pokemon'

/** Kinds of vault notes managed by the plugin (value of the marker frontmatter key). */
export type BinderFileType = 'collection' | 'deck' | 'card'

export const CARD_VARIANTS = ['normal', 'holo', 'reverse-holo', 'promo'] as const
export type CardVariant = (typeof CARD_VARIANTS)[number]

/** TCG grading shorthand: Near Mint, Lightly/Moderately/Heavily Played, Damaged. */
export const CARD_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
export type CardCondition = (typeof CARD_CONDITIONS)[number]

export function isCardVariant(value: unknown): value is CardVariant {
	return typeof value === 'string' && (CARD_VARIANTS as readonly string[]).includes(value)
}

export function isCardCondition(value: unknown): value is CardCondition {
	return typeof value === 'string' && (CARD_CONDITIONS as readonly string[]).includes(value)
}

export interface CardRef {
	game: GameId
	/** Stable id from the card data source, e.g. "sv1-25". */
	cardId: string
	name: string
}

export interface CollectionEntry {
	card: CardRef
	quantity: number
	variant: CardVariant
	condition: CardCondition
}

export type DeckFormat = 'standard' | 'expanded' | 'unlimited'

export interface DeckEntry {
	card: CardRef
	quantity: number
	/** Exempt from the copy limit (basic energy in Pokémon). Data-driven, never name-matched. */
	copyLimitExempt?: boolean
}

export interface DeckConfig {
	name: string
	game: GameId
	format: DeckFormat
	entries: DeckEntry[]
}
