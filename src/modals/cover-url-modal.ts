import { App, Modal, Setting } from 'obsidian'
import { t } from '../i18n'

/** Asks for an external image URL to use as a collection/deck cover. */
export class CoverUrlModal extends Modal {
	constructor(
		app: App,
		private readonly onSubmit: (url: string) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('cover.url-title'))
		const { contentEl } = this

		let url = ''
		const status = contentEl.createDiv('tcgb-import-status')
		new Setting(contentEl).setName(t('cover.url-label')).addText((text) => {
			text.setPlaceholder(t('cover.url-placeholder'))
			text.inputEl.addClass('tcgb-cover-url-input')
			text.onChange((value) => {
				url = value
			})
		})

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t('cover.save'))
				.setCta()
				.onClick(() => {
					const trimmed = url.trim()
					if (!/^https?:\/\//.test(trimmed)) {
						status.setText(t('cover.url-invalid'))
						return
					}
					this.close()
					this.onSubmit(trimmed)
				})
		})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
