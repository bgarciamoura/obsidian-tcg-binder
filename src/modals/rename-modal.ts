import { App, Modal, Setting } from 'obsidian'
import { t } from '../i18n'

/** Renames a collection/deck note from the UI, prefilled with the current name. */
export class RenameModal extends Modal {
	constructor(
		app: App,
		private readonly currentName: string,
		private readonly onSubmit: (name: string) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('rename.title'))
		const { contentEl } = this

		let name = this.currentName
		new Setting(contentEl).setName(t('rename.label')).addText((text) => {
			text.setValue(name)
			text.inputEl.select()
			text.onChange((value) => {
				name = value
			})
		})

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t('rev.save-btn'))
				.setCta()
				.onClick(() => {
					const trimmed = name.trim()
					if (trimmed.length === 0 || trimmed === this.currentName) {
						this.close()
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
