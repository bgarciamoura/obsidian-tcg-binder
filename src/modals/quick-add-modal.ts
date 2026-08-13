import { App, Modal, Setting, TFile } from 'obsidian'
import type { CardData, SetInfo } from '../services/card-data/card-data-source'
import type { CardCondition, CardVariant } from '../types'
import { CARD_CONDITIONS, CARD_VARIANTS } from '../types'
import { parseQuickEntries } from '../domain/quick-entry'
import { stripLeadingZeros } from '../domain/card-list'
import { t } from '../i18n'

export interface QuickAddCallbacks {
	add: (
		card: CardData,
		collection: TFile,
		qty: number,
		variant: CardVariant,
		condition: CardCondition,
	) => Promise<void>
	/** Reopens the set picker — called after this modal has closed. */
	switchSet: () => void
}

/**
 * Rapid physical-card entry for one set: the whole set is already in memory,
 * so each collector number resolves locally — type "45", Enter, next card.
 * "45x3" adds three copies, a trailing r/h/p flag overrides the variant
 * default, and a pasted batch of numbers is added line-resilient in one go.
 */
export class QuickAddModal extends Modal {
	// Session-sticky defaults, shared with consecutive quick-add runs.
	private static lastCollectionPath: string | null = null
	private static lastVariant: CardVariant = 'normal'
	private static lastCondition: CardCondition = 'NM'

	private inputEl!: HTMLInputElement
	private previewEl!: HTMLElement
	private statusEl!: HTMLElement
	private addedCount = 0
	/** Serializes Enter presses — collection writes must not interleave. */
	private busy = false

	constructor(
		app: App,
		private readonly set: SetInfo,
		private readonly cards: CardData[],
		private readonly collections: TFile[],
		private readonly callbacks: QuickAddCallbacks,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('quick.title', { set: this.set.name }))
		this.modalEl.addClass('tcgb-quick-modal')
		const { contentEl } = this
		contentEl.empty()

		contentEl.createDiv({ cls: 'tcgb-import-desc', text: t('quick.hint') })

		let collection =
			this.collections.find((f) => f.path === QuickAddModal.lastCollectionPath) ?? this.collections[0]
		let variant = QuickAddModal.lastVariant
		let condition = QuickAddModal.lastCondition

		new Setting(contentEl).setName(t('add.collection')).addDropdown((dd) => {
			this.collections.forEach((file, i) => {
				dd.addOption(String(i), file.basename)
			})
			dd.setValue(String(this.collections.indexOf(collection)))
			dd.onChange((value) => {
				collection = this.collections[Number(value)]
				QuickAddModal.lastCollectionPath = collection.path
			})
		})

		new Setting(contentEl).setName(t('add.variant')).addDropdown((dd) => {
			for (const option of CARD_VARIANTS) dd.addOption(option, t(`variant.${option}`))
			dd.setValue(variant)
			dd.onChange((value) => {
				variant = value as CardVariant
				QuickAddModal.lastVariant = variant
			})
		})

		new Setting(contentEl).setName(t('add.condition')).addDropdown((dd) => {
			for (const option of CARD_CONDITIONS) dd.addOption(option, option)
			dd.setValue(condition)
			dd.onChange((value) => {
				condition = value as CardCondition
				QuickAddModal.lastCondition = condition
			})
		})

		this.inputEl = contentEl.createEl('input', {
			cls: 'tcgb-quick-input',
			attr: { type: 'text', placeholder: t('quick.placeholder'), enterkeyhint: 'done' },
		})
		this.previewEl = contentEl.createDiv({ cls: 'tcgb-quick-preview' })
		this.statusEl = contentEl.createDiv({ cls: 'tcgb-quick-status' })

		this.inputEl.addEventListener('input', () => {
			this.renderPreview()
		})
		this.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault()
				void this.submit(collection, variant, condition)
			}
		})

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t('quick.change-set')).onClick(() => {
				this.close()
				// Let this modal finish closing before the picker opens —
				// opening mid-close breaks focus/keyboard scope.
				window.setTimeout(() => {
					this.callbacks.switchSet()
				}, 80)
			})
		})

		// Re-focus after the previous modal's focus restoration has run.
		window.setTimeout(() => this.inputEl.focus(), 50)
	}

	onClose(): void {
		this.contentEl.empty()
	}

	/** Local, zero-network lookup — the set is fully in memory. */
	private find(number: string): CardData | undefined {
		const wanted = stripLeadingZeros(number).toLowerCase()
		if (!wanted) return undefined
		return this.cards.find((card) => stripLeadingZeros(card.number).toLowerCase() === wanted)
	}

	/** Live preview of the first token, for visual confirmation against the physical card. */
	private renderPreview(): void {
		this.previewEl.empty()
		const entry = parseQuickEntries(this.inputEl.value)[0]
		if (!entry) return
		const card = this.find(entry.raw) ?? this.find(entry.number)
		if (!card) {
			this.previewEl.createDiv({ cls: 'tcgb-quick-miss', text: t('quick.not-found', { token: entry.raw }) })
			return
		}
		if (card.imageSmall) {
			this.previewEl.createEl('img', { cls: 'tcgb-quick-img', attr: { src: card.imageSmall, alt: card.name } })
		}
		const info = this.previewEl.createDiv({ cls: 'tcgb-quick-info' })
		info.createDiv({ cls: 'tcgb-quick-name', text: card.name })
		info.createDiv({
			cls: 'tcgb-suggestion-meta',
			text: [`#${card.number}`, card.rarity].filter(Boolean).join(' · '),
		})
	}

	private async submit(collection: TFile, variant: CardVariant, condition: CardCondition): Promise<void> {
		if (this.busy) return
		const entries = parseQuickEntries(this.inputEl.value)
		if (entries.length === 0) return

		this.busy = true
		this.inputEl.disabled = true
		const failed: string[] = []
		const pending = [...entries]
		let lastAdded: { name: string; qty: number } | null = null
		try {
			while (pending.length > 0) {
				const entry = pending[0]
				// A literal match wins: the flags belonged to the printed number.
				const literal = this.find(entry.raw)
				const card = literal ?? this.find(entry.number)
				if (card) {
					const qty = literal ? 1 : entry.qty
					const entryVariant = literal ? variant : (entry.variant ?? variant)
					await this.callbacks.add(card, collection, qty, entryVariant, condition)
					this.addedCount += qty
					lastAdded = { name: card.name, qty }
				} else {
					failed.push(entry.raw)
				}
				pending.shift()
			}
			this.statusEl.empty()
			if (lastAdded) {
				this.statusEl.createDiv({
					cls: 'tcgb-quick-ok',
					text: `✓ ${t('quick.added', { name: lastAdded.name, qty: lastAdded.qty })} · ${t('quick.session', { count: this.addedCount })}`,
				})
			}
			for (const token of failed) {
				this.statusEl.createDiv({ cls: 'tcgb-quick-miss', text: t('quick.not-found', { token }) })
			}
		} catch (error) {
			this.statusEl.empty()
			this.statusEl.createDiv({ cls: 'tcgb-quick-miss', text: String(error) })
		} finally {
			this.busy = false
			this.inputEl.disabled = false
		}

		// Only unresolved and unprocessed tokens stay in the input — resolved
		// ones are already persisted, and re-submitting would double-add.
		this.inputEl.value = [...failed, ...pending.map((entry) => entry.raw)].join(' ')
		this.renderPreview()
		this.inputEl.focus()
	}
}
