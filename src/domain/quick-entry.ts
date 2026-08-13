import type { CardVariant } from '../types'

/** One parsed token of the quick-add input. */
export interface QuickEntry {
	/** The token exactly as typed — tried first as a literal collector number. */
	raw: string
	/** Collector number with the qty/variant flags stripped. */
	number: string
	qty: number
	/** Variant flag, or null to use the modal's current default. */
	variant: CardVariant | null
}

const VARIANT_FLAGS: Record<string, CardVariant> = {
	r: 'reverse-holo',
	h: 'holo',
	p: 'promo',
}

/**
 * Parses quick-add input: whitespace/comma-separated collector numbers, each
 * optionally suffixed with "x<qty>" and/or a variant flag (r/h/p), in either
 * order — "45", "45x3", "45r", "45x3r", "45rx3".
 *
 * Flags are only split off when preceded by a digit, so alphanumeric
 * collector numbers ("TG12", "SWSH039") survive intact. Ambiguity against a
 * real number that happens to end in a flag letter is resolved by the caller,
 * which tries `raw` as a literal number before falling back to `number`.
 */
export function parseQuickEntries(input: string): QuickEntry[] {
	return input
		.split(/[\s,;]+/)
		.filter((token) => token.length > 0)
		.map((raw) => {
			let rest = raw
			let qty = 1
			let variant: CardVariant | null = null

			// Suffixes come in either order ("45x3r" / "45rx3"): try qty, then
			// flag, then qty again for the flag-last spelling.
			const qtyFirst = stripQty(rest)
			if (qtyFirst) [rest, qty] = qtyFirst
			const flag = stripFlag(rest)
			if (flag) [rest, variant] = flag
			if (!qtyFirst) {
				const qtyLast = stripQty(rest)
				if (qtyLast) [rest, qty] = qtyLast
			}

			return { raw, number: rest, qty, variant }
		})
}

/** "45x3" → ["45", 3]. The number part must be non-empty — bare "x3" is not a qty. */
function stripQty(token: string): [string, number] | null {
	const match = /^(.+?)x(\d+)$/i.exec(token)
	return match ? [match[1], Math.max(1, Number(match[2]))] : null
}

/** "45r" → ["45", reverse-holo]. Only when a digit precedes the flag letter. */
function stripFlag(token: string): [string, CardVariant] | null {
	const flag = token.slice(-1).toLowerCase()
	if (token.length > 1 && flag in VARIANT_FLAGS && /\d/.test(token.slice(-2, -1))) {
		return [token.slice(0, -1), VARIANT_FLAGS[flag]]
	}
	return null
}
