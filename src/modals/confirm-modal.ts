import { App, Modal, Setting } from 'obsidian'
import { t } from '../i18n'

/** Small yes/no gate for destructive actions (delete deck/collection). */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private readonly title: string,
		private readonly body: string,
		private readonly onConfirm: () => void,
		/** Confirm-button label; defaults to "Delete" for the delete flows. */
		private readonly confirmLabel?: string,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(this.title)
		this.contentEl.createEl('p', { text: this.body })
		new Setting(this.contentEl)
			.addButton((btn) => {
				btn.setButtonText(t('confirm.cancel')).onClick(() => {
					this.close()
				})
			})
			.addButton((btn) => {
				btn.setButtonText(this.confirmLabel ?? t('confirm.delete')).onClick(() => {
					this.close()
					this.onConfirm()
				})
				// Destructive styling without setWarning (deprecated) or
				// setDestructive (needs Obsidian 1.13+, above our minAppVersion).
				btn.buttonEl.addClass('mod-warning')
			})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
