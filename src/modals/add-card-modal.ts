import { App, Modal, Setting, TFile } from 'obsidian'
import type { CardCondition, CardVariant } from '../types'
import { CARD_CONDITIONS, CARD_VARIANTS } from '../types'
import type { CardData } from '../services/card-data/card-data-source'
import { t } from '../i18n'

export interface AddCardChoice {
	collection: TFile
	quantity: number
	variant: CardVariant
	condition: CardCondition
	keepSearching: boolean
}

/** Quantity/variant/condition picker shown after choosing a card in the search. */
export class AddCardModal extends Modal {
	// Session-sticky defaults: bulk-adding usually repeats the same choices.
	private static lastCollectionPath: string | null = null
	private static lastVariant: CardVariant = 'normal'
	private static lastCondition: CardCondition = 'NM'
	private static lastKeepSearching = true

	constructor(
		app: App,
		private readonly card: CardData,
		private readonly collections: TFile[],
		private readonly onSubmit: (choice: AddCardChoice) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(this.card.name)
		const { contentEl } = this
		contentEl.empty()

		const preview = contentEl.createDiv('tcgb-add-preview')
		if (this.card.imageSmall) {
			preview.createEl('img', {
				cls: 'tcgb-add-image',
				attr: { src: this.card.imageSmall, alt: this.card.name },
			})
		}
		preview.createDiv({
			cls: 'tcgb-suggestion-meta',
			text: [this.card.setName, `#${this.card.number}`, this.card.rarity].filter(Boolean).join(' · '),
		})

		let collection =
			this.collections.find((f) => f.path === AddCardModal.lastCollectionPath) ?? this.collections[0]
		let quantity = 1
		let variant = AddCardModal.lastVariant
		let condition = AddCardModal.lastCondition
		let keepSearching = AddCardModal.lastKeepSearching

		new Setting(contentEl).setName(t('add.collection')).addDropdown((dd) => {
			this.collections.forEach((file, i) => {
				dd.addOption(String(i), file.basename)
			})
			dd.setValue(String(this.collections.indexOf(collection)))
			dd.onChange((value) => {
				collection = this.collections[Number(value)]
			})
		})

		new Setting(contentEl).setName(t('add.quantity')).addText((text) => {
			text.inputEl.type = 'number'
			text.inputEl.min = '1'
			text.setValue('1')
			text.onChange((value) => {
				quantity = Number(value)
			})
		})

		new Setting(contentEl).setName(t('add.variant')).addDropdown((dd) => {
			for (const option of CARD_VARIANTS) dd.addOption(option, t(`variant.${option}`))
			dd.setValue(variant)
			dd.onChange((value) => {
				variant = value as CardVariant
			})
		})

		new Setting(contentEl).setName(t('add.condition')).addDropdown((dd) => {
			for (const option of CARD_CONDITIONS) dd.addOption(option, option)
			dd.setValue(condition)
			dd.onChange((value) => {
				condition = value as CardCondition
			})
		})

		new Setting(contentEl).setName(t('add.keep-searching')).addToggle((toggle) => {
			toggle.setValue(keepSearching)
			toggle.onChange((value) => {
				keepSearching = value
			})
		})

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t('add.submit'))
				.setCta()
				.onClick(() => {
					const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1
					AddCardModal.lastCollectionPath = collection.path
					AddCardModal.lastVariant = variant
					AddCardModal.lastCondition = condition
					AddCardModal.lastKeepSearching = keepSearching
					this.close()
					this.onSubmit({ collection, quantity: qty, variant, condition, keepSearching })
				}),
		)
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
