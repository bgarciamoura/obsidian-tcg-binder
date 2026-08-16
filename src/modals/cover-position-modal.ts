import { App, Modal, Setting } from 'obsidian'
import { t } from '../i18n'

/**
 * Vertical framing of the cover art: a live banner-shaped preview plus a
 * slider (0 = top of the scan, 100 = bottom). Persisted only on save.
 */
export class CoverPositionModal extends Modal {
	constructor(
		app: App,
		private readonly coverUrl: string,
		private readonly initial: number,
		private readonly onSave: (pos: number) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('cover.position'))
		let pos = this.initial

		const preview = this.contentEl.createDiv('tcgb-cover-preview')
		const img = preview.createEl('img', { attr: { src: this.coverUrl, alt: '' } })
		img.style.objectPosition = `50% ${pos}%`

		new Setting(this.contentEl).setName(t('cover.position-label')).addSlider((slider) => {
			slider.setLimits(0, 100, 1)
			slider.setValue(pos)
			slider.onChange((value) => {
				pos = value
				img.style.objectPosition = `50% ${value}%`
			})
		})

		new Setting(this.contentEl).addButton((btn) => {
			btn.setButtonText(t('cover.save'))
				.setCta()
				.onClick(() => {
					this.close()
					this.onSave(pos)
				})
		})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
