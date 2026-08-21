import { App, Modal, Setting } from 'obsidian'
import { t } from '../i18n'

/**
 * Edits how many copies of a missing card are "bought, on the way" — an
 * absolute count (0 clears it), capped at what the deck actually misses.
 */
export class OrderedQtyModal extends Modal {
	constructor(
		app: App,
		private readonly cardName: string,
		private readonly current: number,
		private readonly max: number,
		private readonly onSubmit: (ordered: number) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('ordered.title', { name: this.cardName }))
		const { contentEl } = this

		let value = this.current
		new Setting(contentEl)
			.setName(t('ordered.label'))
			.setDesc(t('ordered.desc', { max: this.max }))
			.addText((text) => {
				text.inputEl.type = 'number'
				text.inputEl.min = '0'
				text.inputEl.max = String(this.max)
				text.setValue(String(value))
				text.onChange((raw) => {
					value = Number(raw)
				})
			})

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t('rev.save-btn'))
				.setCta()
				.onClick(() => {
					const ordered =
						Number.isInteger(value) && value >= 0 ? Math.min(value, this.max) : this.current
					this.close()
					this.onSubmit(ordered)
				})
		})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
