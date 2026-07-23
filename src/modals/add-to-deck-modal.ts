import { App, Modal, Setting, TFile } from 'obsidian'
import type { CardData } from '../services/card-data/card-data-source'
import { t } from '../i18n'

export interface AddToDeckChoice {
	deck: TFile
	quantity: number
	keepSearching: boolean
}

/** Quantity/deck picker shown after choosing a card while building a deck. */
export class AddToDeckModal extends Modal {
	private static lastDeckPath: string | null = null
	private static lastKeepSearching = true

	constructor(
		app: App,
		private readonly card: CardData,
		private readonly decks: TFile[],
		private readonly onSubmit: (choice: AddToDeckChoice) => void,
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

		let deck = this.decks.find((f) => f.path === AddToDeckModal.lastDeckPath) ?? this.decks[0]
		let quantity = 1
		let keepSearching = AddToDeckModal.lastKeepSearching

		new Setting(contentEl).setName(t('adddeck.deck')).addDropdown((dd) => {
			this.decks.forEach((file, i) => {
				dd.addOption(String(i), file.basename)
			})
			dd.setValue(String(this.decks.indexOf(deck)))
			dd.onChange((value) => {
				deck = this.decks[Number(value)]
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

		new Setting(contentEl).setName(t('add.keep-searching')).addToggle((toggle) => {
			toggle.setValue(keepSearching)
			toggle.onChange((value) => {
				keepSearching = value
			})
		})

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t('adddeck.submit'))
				.setCta()
				.onClick(() => {
					const qty = Number.isInteger(quantity) && quantity > 0 ? quantity : 1
					AddToDeckModal.lastDeckPath = deck.path
					AddToDeckModal.lastKeepSearching = keepSearching
					this.close()
					this.onSubmit({ deck, quantity: qty, keepSearching })
				}),
		)
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
