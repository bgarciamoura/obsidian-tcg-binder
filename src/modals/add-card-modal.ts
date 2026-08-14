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

/** What the modal shows about the card being added — source-agnostic. */
export interface CardPreview {
	name: string
	image: string | null
	metaLine: string
}

export interface AddCardOptions {
	/** Prefilled quantity (default 1). */
	initialQuantity?: number
	/** Show the "keep searching" toggle (default true — the search loop). */
	showKeepSearching?: boolean
}

export function previewFromCardData(card: CardData): CardPreview {
	return {
		name: card.name,
		image: card.imageSmall,
		metaLine: [card.setName, `#${card.number}`, card.rarity].filter(Boolean).join(' · '),
	}
}

/** Quantity/variant/condition picker for adding one card to a collection. */
export class AddCardModal extends Modal {
	// Session-sticky defaults: bulk-adding usually repeats the same choices.
	private static lastCollectionPath: string | null = null
	private static lastVariant: CardVariant = 'normal'
	private static lastCondition: CardCondition = 'NM'
	private static lastKeepSearching = true

	constructor(
		app: App,
		private readonly preview: CardPreview,
		private readonly collections: TFile[],
		private readonly onSubmit: (choice: AddCardChoice) => void,
		private readonly options: AddCardOptions = {},
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(this.preview.name)
		const { contentEl } = this
		contentEl.empty()

		const preview = contentEl.createDiv('tcgb-add-preview')
		if (this.preview.image) {
			preview.createEl('img', {
				cls: 'tcgb-add-image',
				attr: { src: this.preview.image, alt: this.preview.name },
			})
		}
		preview.createDiv({ cls: 'tcgb-suggestion-meta', text: this.preview.metaLine })

		const showKeepSearching = this.options.showKeepSearching ?? true
		let collection =
			this.collections.find((f) => f.path === AddCardModal.lastCollectionPath) ?? this.collections[0]
		let quantity = this.options.initialQuantity ?? 1
		let variant = AddCardModal.lastVariant
		let condition = AddCardModal.lastCondition
		let keepSearching = showKeepSearching && AddCardModal.lastKeepSearching

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
			text.setValue(String(quantity))
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

		if (showKeepSearching) {
			new Setting(contentEl).setName(t('add.keep-searching')).addToggle((toggle) => {
				toggle.setValue(keepSearching)
				toggle.onChange((value) => {
					keepSearching = value
				})
			})
		}

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t('add.submit'))
				.setCta()
				.onClick(() => {
					const qty =
						Number.isInteger(quantity) && quantity > 0 ? quantity : (this.options.initialQuantity ?? 1)
					AddCardModal.lastCollectionPath = collection.path
					AddCardModal.lastVariant = variant
					AddCardModal.lastCondition = condition
					if (showKeepSearching) AddCardModal.lastKeepSearching = keepSearching
					this.close()
					this.onSubmit({ collection, quantity: qty, variant, condition, keepSearching })
				}),
		)
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
