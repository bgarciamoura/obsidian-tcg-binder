// Minimal stubs of the Obsidian API for unit tests (wired via vitest alias).
export class TFile {
	path = ''
	name = ''
	basename = ''
	extension = 'md'
}

export class TFolder {
	path = ''
	children: unknown[] = []
}

export class Modal {}

export class Setting {
	constructor(_el: unknown) {}
	setName(): this { return this }
	setDesc(): this { return this }
	addText(): this { return this }
	addToggle(): this { return this }
	addButton(): this { return this }
	addDropdown(): this { return this }
}

export class Notice {
	constructor(_msg: string) {}
}

export class PluginSettingTab {}

export const Platform = { isMobile: false }

export function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function getLanguage(): string {
	return 'en'
}

export function requestUrl(): never {
	throw new Error('requestUrl is not available in unit tests')
}
