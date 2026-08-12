/**
 * TCGdex localizes the card `category` field ("Energia", "Treinador",
 * "Dresseur", ...), but every consumer (deck grouping, decklist export,
 * copy-limit exemption) compares against the canonical English supertypes.
 * This maps every known localized value across the supported TCGdex locales
 * (en, pt, es, fr, de, it, ja) back to the canonical form.
 */
const CANONICAL_SUPERTYPES: Record<string, 'Pokémon' | 'Trainer' | 'Energy'> = {
	// Pokémon — "Pokemon" (en) vs "Pokémon" (accented locales)
	pokemon: 'Pokémon',
	pokémon: 'Pokémon',
	ポケモン: 'Pokémon',
	// Trainer
	trainer: 'Trainer',
	treinador: 'Trainer',
	entrenador: 'Trainer',
	dresseur: 'Trainer',
	allenatore: 'Trainer',
	トレーナー: 'Trainer',
	// Energy
	energy: 'Energy',
	energia: 'Energy',
	energía: 'Energy',
	énergie: 'Energy',
	energie: 'Energy',
	エネルギー: 'Energy',
}

/**
 * Normalizes a (possibly localized) supertype to its canonical English form.
 * Unknown values pass through unchanged — hand-written card notes may carry
 * anything, and guessing would corrupt them.
 */
export function canonicalSupertype(value: string | null): string | null {
	if (value === null) return null
	return CANONICAL_SUPERTYPES[value.trim().toLowerCase()] ?? value
}
