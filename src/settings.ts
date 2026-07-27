import { App, PluginSettingTab, Setting } from 'obsidian'
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
}

export const DEFAULT_SETTINGS: TcgBinderSettings = {
	rootFolder: 'TCG Binder',
	dataSource: 'tcgdex',
	cardLanguage: 'en',
	defaultViewMode: 'list',
	pokemonTcgApiKey: '',
}

export class TcgBinderSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: TcgBinderPlugin,
	) {
		super(app, plugin)
	}

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
