/**
 * The date in the USER'S timezone as YYYY-MM-DD. `toISOString()` is UTC and
 * stamps "tomorrow" on evening entries west of Greenwich — every date written
 * to the vault goes through here instead.
 */
export function localIsoDate(date: Date = new Date()): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

/** Local date and time as "YYYY-MM-DD HH:mm" — sortable and human-readable. */
export function localIsoDateTime(date: Date = new Date()): string {
	const hours = String(date.getHours()).padStart(2, '0')
	const minutes = String(date.getMinutes()).padStart(2, '0')
	return `${localIsoDate(date)} ${hours}:${minutes}`
}
