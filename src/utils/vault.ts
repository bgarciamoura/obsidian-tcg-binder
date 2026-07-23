import { App, normalizePath } from 'obsidian'

/** Creates the folder (and every missing parent) if it does not exist. */
export async function ensureFolder(app: App, path: string): Promise<void> {
	let current = ''
	for (const segment of path.split('/')) {
		current = current ? `${current}/${segment}` : segment
		if (!app.vault.getFolderByPath(current)) {
			await app.vault.createFolder(current)
		}
	}
}

/** Returns `<folder>/<name>.md`, suffixing " 2", " 3", ... on collisions. */
export function findAvailablePath(app: App, folder: string, name: string): string {
	let candidate = normalizePath(`${folder}/${name}.md`)
	let suffix = 1
	while (app.vault.getAbstractFileByPath(candidate)) {
		suffix += 1
		candidate = normalizePath(`${folder}/${name} ${suffix}.md`)
	}
	return candidate
}
