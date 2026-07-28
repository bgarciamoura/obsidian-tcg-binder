/** Lowercases and strips diacritics — "Substituição" → "substituicao". */
export function normalizeForMatch(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
}

/**
 * Token-based name matching: every whitespace-separated token of the query
 * must appear somewhere in the name. Handles printed abbreviations ("Rocky F
 * Energy" matches "Rocky Fighting Energy") and accent-less typing.
 */
export function matchesAllTokens(name: string, query: string): boolean {
	const haystack = normalizeForMatch(name)
	return query
		.split(/\s+/)
		.filter(Boolean)
		.every((token) => haystack.includes(normalizeForMatch(token)))
}

/**
 * The functional-identity key of a card: canonical English name when known,
 * localized name otherwise, printing id as the last resort. Two entries with
 * the same key are the same card for game purposes (ownership, playsets).
 */
export function functionalKey(nameEn: string | null, name: string | null, id: string): string {
	return normalizeForMatch(nameEn ?? name ?? id)
}

/** Generic TCG words that make terrible search anchors — thousands of hits. */
const GENERIC_TOKENS = new Set([
	'energy',
	'energia',
	'card',
	'carta',
	'basic',
	'basica',
	'ex',
	'gx',
	'v',
	'vmax',
	'vstar',
	'mega',
])

/**
 * The most selective token to send to the API's substring search: the
 * longest token that is not a generic TCG word ("Rocky F Energy" → "Rocky",
 * not "Energy"). Falls back to the longest token overall when every token
 * is generic ("Basic Energy").
 */
export function searchAnchor(query: string): string {
	const tokens = query.split(/\s+/).filter(Boolean)
	const longest = (list: string[]) =>
		list.reduce((best, token) => (token.length > best.length ? token : best), '')
	const specific = tokens.filter((token) => !GENERIC_TOKENS.has(normalizeForMatch(token)))
	return longest(specific.length > 0 ? specific : tokens)
}
