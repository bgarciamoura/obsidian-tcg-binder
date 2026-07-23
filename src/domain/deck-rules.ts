import type { DeckEntry } from '../types'

/**
 * Construction rules for a deck. Kept as data so other games/formats
 * (MTG Commander, Expanded bans, ...) can plug in their own rule set.
 */
export interface DeckRules {
	deckSize: number
	maxCopies: number
}

export const POKEMON_DECK_RULES: DeckRules = {
	deckSize: 60,
	maxCopies: 4,
}

export type DeckIssueCode =
	| 'deck-size'
	| 'copy-limit'
	| 'invalid-quantity'
	| 'illegal-card'
	| 'unknown-legality'

export interface DeckIssue {
	code: DeckIssueCode
	message: string
}

export function countCards(entries: DeckEntry[]): number {
	return entries.reduce((total, entry) => total + entry.quantity, 0)
}

/**
 * Validates a deck against a rule set. Pure function — safe to unit test
 * and reuse from any view. Returns an empty array for a legal deck.
 */
export function validateDeck(entries: DeckEntry[], rules: DeckRules = POKEMON_DECK_RULES): DeckIssue[] {
	const issues: DeckIssue[] = []

	for (const entry of entries) {
		if (!Number.isInteger(entry.quantity) || entry.quantity <= 0) {
			issues.push({
				code: 'invalid-quantity',
				message: `"${entry.card.name}" has an invalid quantity (${entry.quantity})`,
			})
		}
	}

	const total = countCards(entries)
	if (total !== rules.deckSize) {
		issues.push({
			code: 'deck-size',
			message: `Deck has ${total} cards, expected ${rules.deckSize}`,
		})
	}

	// The copy limit counts by card NAME across printings, not by card id.
	const copiesByName = new Map<string, number>()
	for (const entry of entries) {
		if (entry.copyLimitExempt) continue
		copiesByName.set(entry.card.name, (copiesByName.get(entry.card.name) ?? 0) + entry.quantity)
	}
	for (const [name, copies] of copiesByName) {
		if (copies > rules.maxCopies) {
			issues.push({
				code: 'copy-limit',
				message: `"${name}" has ${copies} copies, max is ${rules.maxCopies}`,
			})
		}
	}

	return issues
}

const BASIC_ENERGY_NAMES =
	/^(?:Basic\s+)?(?:Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/i

/**
 * Name-based fallback for the basic-energy copy-limit exemption, used when a
 * data source or an existing card note lacks the structured flag (TCGdex
 * marks them `energyType: "Normal"`; old notes may predate the flag).
 * The nine basic energy names are fixed by the game rules, so this is safe.
 */
export function isBasicEnergy(supertype: string | null, name: string): boolean {
	return supertype === 'Energy' && BASIC_ENERGY_NAMES.test(name.trim())
}

export interface LegalityEntry {
	name: string
	/** Formats where the card is legal, or null when unknown (e.g. manual cards). */
	legalities: string[] | null
}

/**
 * Checks every card's format legality. Formats other than standard/expanded
 * are not restricted. Unknown legality is surfaced as its own issue instead
 * of guessing either way.
 */
export function validateDeckLegality(entries: LegalityEntry[], format: string): DeckIssue[] {
	if (format !== 'standard' && format !== 'expanded') return []
	const issues: DeckIssue[] = []
	for (const entry of entries) {
		if (!entry.legalities) {
			issues.push({
				code: 'unknown-legality',
				message: `"${entry.name}" has unknown legality — verify manually`,
			})
		} else if (!entry.legalities.includes(format)) {
			issues.push({
				code: 'illegal-card',
				message: `"${entry.name}" is not legal in ${format}`,
			})
		}
	}
	return issues
}
