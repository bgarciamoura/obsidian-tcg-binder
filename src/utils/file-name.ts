/** Characters Obsidian forbids in file names or that break wikilinks. */
const INVALID_CHARS = /[\\/:*?"<>|#^[\]]/g

export function sanitizeFileName(name: string): string {
	return name.replace(INVALID_CHARS, '').replace(/\s+/g, ' ').trim()
}
