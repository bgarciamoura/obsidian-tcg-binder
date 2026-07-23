import { stripLeadingZeros } from './card-list'

export interface ParsedCardQuery {
	name?: string
	setCode?: string
	number?: string
}

/**
 * Interprets what the user typed in the card search box.
 * - "SVI 45" / "svi-45"  → set code + collector number
 * - "45/198" / "045"     → collector number only
 * - anything else        → card name
 *
 * "Iono 185" also matches the set-code shape — callers must validate the
 * code against the set catalog and fall back to a name search.
 */
export function parseCardQuery(raw: string): ParsedCardQuery {
	const query = raw.trim()

	const setAndNumber = /^([A-Za-z][A-Za-z0-9]{1,9})[\s/-]+(\d{1,4}[a-z]?)$/.exec(query)
	if (setAndNumber) {
		return { setCode: setAndNumber[1].toUpperCase(), number: stripLeadingZeros(setAndNumber[2]) }
	}

	const numberOnly = /^(\d{1,4})(?:\/\d{1,4})?$/.exec(query)
	if (numberOnly) {
		return { number: stripLeadingZeros(numberOnly[1]) }
	}

	return { name: query }
}
