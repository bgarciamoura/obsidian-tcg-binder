import { App, Modal, Setting, TFile } from 'obsidian'
import { t } from '../i18n'

export interface ImportSummary {
	added: number
	failed: string[]
}

export interface ImportLabels {
	title: string
	desc: string
	placeholder: string
}

/** Paste-and-import into a collection: TCG Live lists or CSV, per `labels`. */
export class ImportListModal extends Modal {
	private busy = false

	constructor(
		app: App,
		private readonly collections: TFile[],
		private readonly labels: ImportLabels,
		private readonly runImport: (collection: TFile, text: string) => Promise<ImportSummary>,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(this.labels.title)
		const { contentEl } = this
		contentEl.empty()

		contentEl.createEl('p', { cls: 'tcgb-import-desc', text: this.labels.desc })

		let collection = this.collections[0]
		new Setting(contentEl).setName(t('import.collection')).addDropdown((dd) => {
			this.collections.forEach((file, i) => {
				dd.addOption(String(i), file.basename)
			})
			dd.onChange((value) => {
				collection = this.collections[Number(value)]
			})
		})

		const textarea = contentEl.createEl('textarea', {
			cls: 'tcgb-import-textarea',
			attr: { rows: '10', placeholder: this.labels.placeholder },
		})
		const status = contentEl.createDiv('tcgb-import-status')
		const failedEl = contentEl.createEl('pre', { cls: 'tcgb-import-failed' })
		failedEl.hide()

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t('import.submit'))
				.setCta()
				.onClick(() => {
					void this.submit(collection, textarea.value, status, failedEl, () => {
						btn.setDisabled(this.busy)
					})
				}),
		)
	}

	onClose(): void {
		this.contentEl.empty()
	}

	private async submit(
		collection: TFile,
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
			const summary = await this.runImport(collection, text)
			status.setText(t('import.summary', { added: summary.added, failed: summary.failed.length }))
			if (summary.failed.length > 0) {
				failedEl.setText(summary.failed.join('\n'))
				failedEl.show()
			}
		} catch (error) {
			status.setText(String(error))
		} finally {
			this.busy = false
			syncButton()
		}
	}
}
