/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF/LF endings. No dependencies — collection
 * exports from other apps are small enough to parse in one pass.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let field = ''
	let inQuotes = false

	const pushField = () => {
		row.push(field)
		field = ''
	}
	const pushRow = () => {
		pushField()
		// Skip rows that are entirely empty (e.g. a trailing newline).
		if (row.length > 1 || row[0] !== '') rows.push(row)
		row = []
	}

	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"'
					i++
				} else {
					inQuotes = false
				}
			} else {
				field += ch
			}
		} else if (ch === '"') {
			inQuotes = true
		} else if (ch === ',') {
			pushField()
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++
			pushRow()
		} else {
			field += ch
		}
	}
	pushRow()
	return rows
}
