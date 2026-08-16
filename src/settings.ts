import { App, PluginSettingTab, Setting } from 'obsidian'
import type { SettingDefinitionItem } from 'obsidian'
import { t } from './i18n'
import { TCGDEX_LANGUAGES } from './services/card-data/tcgdex-source'
import type { TcgdexLanguage } from './services/card-data/tcgdex-source'
import type TcgBinderPlugin from './main'

const LANGUAGE_LABELS: Record<TcgdexLanguage, string> = {
	en: 'English',
	pt: 'Português',
	es: 'Español',
	fr: 'Français',
	de: 'Deutsch',
	it: 'Italiano',
	ja: '日本語',
}

export type CardDataSourceId = 'tcgdex' | 'pokemontcg-io'

/** How card collections/results are laid out: table rows or a card grid. */
export type ViewMode = 'list' | 'grid'

export interface TcgBinderSettings {
	/** Vault folder that holds collections/ and decks/. */
	rootFolder: string
	/**
	 * Which card database to use. TCGdex is free with no key; pokemontcg.io
	 * requires a paid (Scrydex) key for reliable limits. Card ids are
	 * source-specific — switching affects new lookups, not existing notes.
	 */
	dataSource: CardDataSourceId
	/**
	 * TCGdex card language: names, search and new card notes. The set catalog
	 * stays English (codes/coverage), and lookups fall back to English where
	 * the locale has gaps. Ids match across languages.
	 */
	cardLanguage: TcgdexLanguage
	/** Global default for list vs card-grid layout; every surface has a local toggle. */
	defaultViewMode: ViewMode
	/** Optional pokemontcg.io key — only raises rate limits. */
	pokemonTcgApiKey: string
	/**
	 * When on, cards used by other decks are treated as unavailable in
	 * missing-cards math — for players who keep every deck assembled.
	 * Off (default) any owned copy satisfies every deck.
	 */
	reserveDeckCopies: boolean
}

export const DEFAULT_SETTINGS: TcgBinderSettings = {
	rootFolder: 'TCG Binder',
	dataSource: 'tcgdex',
	cardLanguage: 'en',
	defaultViewMode: 'list',
	pokemonTcgApiKey: '',
	reserveDeckCopies: false,
}

export class TcgBinderSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TcgBinderPlugin,
	) {
		super(app, plugin)
	}

	/**
	 * Declarative settings (Obsidian 1.13+): renders the tab and feeds the
	 * settings search. display() below stays as the pre-1.13 fallback — keep
	 * both in sync when settings change.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: t('settings.root-folder.name'),
				desc: t('settings.root-folder.desc'),
				control: {
					type: 'folder',
					key: 'rootFolder',
					defaultValue: DEFAULT_SETTINGS.rootFolder,
					placeholder: DEFAULT_SETTINGS.rootFolder,
					validate: (value) => (value.trim().length === 0 ? t('settings.root-folder.required') : undefined),
				},
			},
			{
				name: t('settings.view-mode.name'),
				desc: t('settings.view-mode.desc'),
				control: {
					type: 'dropdown',
					key: 'defaultViewMode',
					defaultValue: DEFAULT_SETTINGS.defaultViewMode,
					options: { list: t('view-mode.list'), grid: t('view-mode.grid') },
				},
			},
			{
				name: t('settings.card-language.name'),
				desc: t('settings.card-language.desc'),
				control: {
					type: 'dropdown',
					key: 'cardLanguage',
					defaultValue: DEFAULT_SETTINGS.cardLanguage,
					options: Object.fromEntries(TCGDEX_LANGUAGES.map((lang) => [lang, LANGUAGE_LABELS[lang]])),
				},
			},
			{
				name: t('settings.data-source.name'),
				desc: t('settings.data-source.desc'),
				control: {
					type: 'dropdown',
					key: 'dataSource',
					defaultValue: DEFAULT_SETTINGS.dataSource,
					options: { tcgdex: t('source.tcgdex'), 'pokemontcg-io': t('source.pokemontcg-io') },
				},
			},
			{
				name: t('settings.reserve-decks.name'),
				desc: t('settings.reserve-decks.desc'),
				control: {
					type: 'toggle',
					key: 'reserveDeckCopies',
					defaultValue: DEFAULT_SETTINGS.reserveDeckCopies,
				},
			},
			{
				name: t('settings.api-key.name'),
				desc: t('settings.api-key.desc'),
				control: { type: 'text', key: 'pokemonTcgApiKey' },
			},
		]
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof TcgBinderSettings]
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.plugin.settings as unknown as Record<string, unknown>
		settings[key] =
			key === 'rootFolder' && typeof value === 'string'
				? value.trim() || DEFAULT_SETTINGS.rootFolder
				: value
		await this.plugin.saveSettings()
	}

	/** Imperative fallback for Obsidian < 1.13 — not called when definitions render. */
	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting(containerEl)
			.setName(t('settings.root-folder.name'))
			.setDesc(t('settings.root-folder.desc'))
			.addText((text) =>
				text.setValue(this.plugin.settings.rootFolder).onChange(async (value) => {
					this.plugin.settings.rootFolder = value.trim() || DEFAULT_SETTINGS.rootFolder
					await this.plugin.saveSettings()
				}),
			)

		new Setting(containerEl)
			.setName(t('settings.data-source.name'))
			.setDesc(t('settings.data-source.desc'))
			.addDropdown((dd) => {
				dd.addOption('tcgdex', t('source.tcgdex'))
				dd.addOption('pokemontcg-io', t('source.pokemontcg-io'))
				dd.setValue(this.plugin.settings.dataSource)
				dd.onChange(async (value) => {
					this.plugin.settings.dataSource = value === 'pokemontcg-io' ? 'pokemontcg-io' : 'tcgdex'
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName(t('settings.view-mode.name'))
			.setDesc(t('settings.view-mode.desc'))
			.addDropdown((dd) => {
				dd.addOption('list', t('view-mode.list'))
				dd.addOption('grid', t('view-mode.grid'))
				dd.setValue(this.plugin.settings.defaultViewMode)
				dd.onChange(async (value) => {
					this.plugin.settings.defaultViewMode = value === 'grid' ? 'grid' : 'list'
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName(t('settings.card-language.name'))
			.setDesc(t('settings.card-language.desc'))
			.addDropdown((dd) => {
				for (const lang of TCGDEX_LANGUAGES) {
					dd.addOption(lang, LANGUAGE_LABELS[lang])
				}
				dd.setValue(this.plugin.settings.cardLanguage)
				dd.onChange(async (value) => {
					this.plugin.settings.cardLanguage = TCGDEX_LANGUAGES.includes(value as TcgdexLanguage)
						? (value as TcgdexLanguage)
						: 'en'
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName(t('settings.reserve-decks.name'))
			.setDesc(t('settings.reserve-decks.desc'))
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.reserveDeckCopies)
				toggle.onChange(async (value) => {
					this.plugin.settings.reserveDeckCopies = value
					await this.plugin.saveSettings()
				})
			})

		new Setting(containerEl)
			.setName(t('settings.api-key.name'))
			.setDesc(t('settings.api-key.desc'))
			.addText((text) =>
				text.setValue(this.plugin.settings.pokemonTcgApiKey).onChange(async (value) => {
					this.plugin.settings.pokemonTcgApiKey = value.trim()
					await this.plugin.saveSettings()
				}),
			)
	}
}
