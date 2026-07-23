import { App, PluginSettingTab, Setting } from 'obsidian'
import { t } from './i18n'
import type TcgBinderPlugin from './main'

export type CardDataSourceId = 'tcgdex' | 'pokemontcg-io'

export interface TcgBinderSettings {
	/** Vault folder that holds collections/ and decks/. */
	rootFolder: string
	/**
	 * Which card database to use. TCGdex is free with no key; pokemontcg.io
	 * requires a paid (Scrydex) key for reliable limits. Card ids are
	 * source-specific — switching affects new lookups, not existing notes.
	 */
	dataSource: CardDataSourceId
	/** Optional pokemontcg.io key — only raises rate limits. */
	pokemonTcgApiKey: string
}

export const DEFAULT_SETTINGS: TcgBinderSettings = {
	rootFolder: 'TCG Binder',
	dataSource: 'tcgdex',
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
