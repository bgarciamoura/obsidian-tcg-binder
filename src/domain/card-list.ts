/**
 * Parser for plain-text card lists in the TCG Live / Limitless format:
 *
 *   Pokémon: 12
 *   4 Pikachu ex SVI 45
 *   Trainer: 30
 *   * 4 Professor's Research SVI 189   (RK9 star prefix)
 *   Energy: 18
 *   18x Lightning Energy SVE 4         ("x" suffix tolerated)
 *   Total Cards: 60
 *
 * Shared by collection bulk entry and deck import/export.
 */

export interface CardListLine {
	quantity: number
	name: string
	setCode: string
	number: string
	/** 1-based line number in the pasted text, for error reporting. */
	line: number
}

export interface CardListError {
	line: number
	text: string
}

export interface CardListParseResult {
	entries: CardListLine[]
	errors: CardListError[]
}

const SECTION_HEADER = /^(pok[eé]mon|trainer|energy|total\s+cards)\s*[:：]?\s*\d*$/i
const CARD_LINE = /^(\d+)x?\s+(.+?)\s+([A-Za-z][A-Za-z0-9-]{0,9})\s+([A-Za-z]{0,3}\d{1,4}[a-z]?)$/

export function parseCardList(text: string): CardListParseResult {
	const entries: CardListLine[] = []
	const errors: CardListError[] = []

	const lines = text.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		// RK9 decklists prefix each card line with "* ".
		const line = lines[i].trim().replace(/^\*\s*/, '')
		if (line.length === 0 || SECTION_HEADER.test(line)) continue

		const match = CARD_LINE.exec(line)
		if (!match) {
			errors.push({ line: i + 1, text: lines[i].trim() })
			continue
		}

		const quantity = Number(match[1])
		if (quantity <= 0) {
			errors.push({ line: i + 1, text: lines[i].trim() })
			continue
		}

		entries.push({
			quantity,
			name: match[2],
			setCode: match[3].toUpperCase(),
			number: stripLeadingZeros(match[4]),
			line: i + 1,
		})
	}

	return { entries, errors }
}

export function stripLeadingZeros(value: string): string {
	return value.replace(/^0+(?=\d)/, '')
}

export interface SerializableCard {
	quantity: number
	name: string
	setCode: string | null
	number: string | null
	supertype: string | null
}

/**
 * Serializes cards into the TCG Live decklist format, grouped into the three
 * canonical sections. Cards without a Pokémon/Energy supertype (including
 * unknown) land under Trainer, mirroring how TCG Live buckets everything else.
 */
export function serializeCardList(cards: SerializableCard[]): string {
	const groups: Record<'Pokémon' | 'Trainer' | 'Energy', SerializableCard[]> = {
		'Pokémon': [],
		Trainer: [],
		Energy: [],
	}
	for (const card of cards) {
		const group = card.supertype === 'Pokémon' ? 'Pokémon' : card.supertype === 'Energy' ? 'Energy' : 'Trainer'
		groups[group].push(card)
	}

	const sections: string[] = []
	let total = 0
	for (const [title, items] of Object.entries(groups)) {
		if (items.length === 0) continue
		const count = items.reduce((sum, card) => sum + card.quantity, 0)
		total += count
		const lines = items.map((card) =>
			[card.quantity, card.name, card.setCode, card.number].filter((part) => part !== null).join(' '),
		)
		sections.push(`${title}: ${count}\n${lines.join('\n')}`)
	}
	sections.push(`Total Cards: ${total}`)
	return sections.join('\n\n')
}
