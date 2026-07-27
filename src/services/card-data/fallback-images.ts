/**
 * Image fallback via the pokemontcg.io static CDN (images.pokemontcg.io) —
 * no API/key involved. Used when TCGdex has no scan for a card. Set ids
 * differ between the databases, so candidates are generated from known id
 * conventions and MUST be existence-checked before use (a wrong guess is
 * just a 404 probe).
 */

/**
 * tcgdex → pokemontcg.io set-id candidates.
 * Conventions observed: zero-padding is dropped ("sv01" → "sv1", "me01" →
 * "me1"); half-sets use "ptX" in the SV era ("sv06.5" → "sv6pt5") but plain
 * concatenation in earlier eras ("sm3.5" → "sm35").
 */
export function pokemonTcgIoSetIdCandidates(setId: string): string[] {
	const unpadded = setId.replace(/^([a-z]+)0+(\d)/, '$1$2')
	if (!unpadded.includes('.')) return [unpadded]
	return [unpadded.replace(/\.(\d+)/, 'pt$1'), unpadded.replace('.', '')]
}

/** Candidate hires image URLs for a card, best guess first. */
export function pokemonTcgIoImageCandidates(setId: string, number: string): string[] {
	return pokemonTcgIoSetIdCandidates(setId).map(
		(mapped) => `https://images.pokemontcg.io/${mapped}/${number}_hires.png`,
	)
}
