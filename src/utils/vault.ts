import { App, TFile, TFolder, normalizePath } from 'obsidian'

/**
 * Markdown files inside one folder tree. Deliberately NOT vault-wide
 * enumeration: the plugin only ever looks inside the configured binder
 * folder, so the rest of the vault stays out of reach by construction.
 */
export function listMarkdownFilesIn(app: App, folderPath: string): TFile[] {
	const root = app.vault.getFolderByPath(normalizePath(folderPath))
	if (!root) return []
	const files: TFile[] = []
	const walk = (folder: TFolder) => {
		for (const child of folder.children) {
			if (child instanceof TFolder) walk(child)
			else if (child instanceof TFile && child.extension === 'md') files.push(child)
		}
	}
	walk(root)
	return files
}

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
