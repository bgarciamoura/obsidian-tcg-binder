import { App, Modal, Setting } from 'obsidian'
import type { ImportSummary } from './import-list-modal'
import { t } from '../i18n'

/** Paste a full TCG Live decklist and create a new deck note from it. */
export class ImportDeckModal extends Modal {
	private busy = false

	constructor(
		app: App,
		private readonly runImport: (name: string, text: string) => Promise<ImportSummary>,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('import-deck.title'))
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('p', { cls: 'tcgb-import-desc', text: t('import-deck.desc') })

		let name = ''
		new Setting(contentEl).setName(t('import-deck.name')).addText((text) => {
			text.setPlaceholder(t('default.new-deck-name'))
			text.onChange((value) => {
				name = value
			})
		})

		const textarea = contentEl.createEl('textarea', {
			cls: 'tcgb-import-textarea',
			attr: { rows: '12', placeholder: t('import.placeholder') },
		})
		const status = contentEl.createDiv('tcgb-import-status')
		const failedEl = contentEl.createEl('pre', { cls: 'tcgb-import-failed' })
		failedEl.hide()

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t('import.submit'))
				.setCta()
				.onClick(() => {
					void this.submit(name, textarea.value, status, failedEl, () => {
						btn.setDisabled(this.busy)
					})
				}),
		)
	}

	onClose(): void {
		this.contentEl.empty()
	}

	private async submit(
		name: string,
		text: string,
		status: HTMLElement,
		failedEl: HTMLElement,
		syncButton: () => void,
	): Promise<void> {
		if (this.busy || text.trim().length === 0) return
		this.busy = true
		syncButton()
		status.setText(t('import.running'))
		failedEl.hide()
		try {
			const summary = await this.runImport(name.trim(), text)
			status.setText(t('import.summary', { added: summary.added, failed: summary.failed.length }))
			if (summary.failed.length > 0) {
				failedEl.setText(summary.failed.join('\n'))
				failedEl.show()
			} else {
				this.close()
			}
		} catch (error) {
			status.setText(String(error))
		} finally {
			this.busy = false
			syncButton()
		}
	}
}
