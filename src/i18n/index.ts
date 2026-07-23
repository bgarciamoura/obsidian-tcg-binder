import { getLanguage } from 'obsidian'
import { en } from './locales/en'
import { ptBR } from './locales/pt-br'

export type LocaleKey = keyof typeof en

const locales: Record<string, Partial<Record<LocaleKey, string>>> = {
	en,
	pt: ptBR,
	'pt-br': ptBR,
	'pt-BR': ptBR,
}

/**
 * Resolves a UI string for the current Obsidian language, falling back to
 * English. `vars` fills `{placeholders}` in the string.
 */
export function t(key: LocaleKey, vars?: Record<string, string | number>): string {
	const lang = getLanguage()
	const locale = locales[lang] ?? locales[lang.toLowerCase()] ?? locales[lang.split('-')[0]]
	let text = locale?.[key] ?? en[key]
	if (vars) {
		for (const [name, value] of Object.entries(vars)) {
			text = text.replace(`{${name}}`, String(value))
		}
	}
	return text
}
