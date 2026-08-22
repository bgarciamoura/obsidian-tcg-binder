import { App, Modal, Setting } from 'obsidian'
import type { DeckOrder } from '../services/deck-store'
import { t } from '../i18n'

/**
 * Edits the "bought, on the way" purchases of a missing card — one line per
 * purchase (how many copies + where/from whom), so buying the same card
 * from several sellers stays legible. An empty list clears the state; the
 * total is capped at what the deck actually misses.
 */
export class OrderedQtyModal extends Modal {
	private readonly drafts: DeckOrder[]

	constructor(
		app: App,
		private readonly cardName: string,
		current: DeckOrder[],
		private readonly max: number,
		private readonly onSubmit: (orders: DeckOrder[]) => void,
	) {
		super(app)
		// Local copies — the caller's rows must not change until save.
		this.drafts = current.map((order) => ({ ...order }))
	}

	onOpen(): void {
		this.setTitle(t('ordered.title', { name: this.cardName }))
		const { contentEl } = this

		contentEl.createEl('p', { cls: 'tcgb-order-desc', text: t('ordered.list-desc', { max: this.max }) })
		const listEl = contentEl.createDiv({ cls: 'tcgb-order-list' })
		this.renderList(listEl)

		new Setting(contentEl)
			.addButton((btn) => {
				btn.setButtonText(t('ordered.add')).onClick(() => {
					this.drafts.push({ qty: 1, from: '' })
					this.renderList(listEl)
				})
			})
			.addButton((btn) => {
				btn.setButtonText(t('rev.save-btn'))
					.setCta()
					.onClick(() => {
						const orders = this.drafts.filter(
							(order) => Number.isInteger(order.qty) && order.qty > 0,
						)
						this.close()
						this.onSubmit(orders)
					})
			})
	}

	private renderList(listEl: HTMLElement): void {
		listEl.empty()
		if (this.drafts.length === 0) {
			listEl.createEl('p', { cls: 'tcgb-order-empty', text: t('ordered.empty') })
			return
		}
		for (const draft of this.drafts) {
			const row = listEl.createDiv({ cls: 'tcgb-order-row' })
			const qtyEl = row.createEl('input', { cls: 'tcgb-order-qty', type: 'number' })
			qtyEl.min = '1'
			qtyEl.max = String(this.max)
			qtyEl.value = String(draft.qty)
			qtyEl.addEventListener('input', () => {
				draft.qty = Number(qtyEl.value)
			})
			const fromEl = row.createEl('input', {
				cls: 'tcgb-order-from',
				type: 'text',
				placeholder: t('ordered.from-placeholder'),
			})
			fromEl.value = draft.from
			fromEl.addEventListener('input', () => {
				draft.from = fromEl.value
			})
			const removeEl = row.createEl('button', {
				cls: 'tcgb-order-remove',
				text: '×',
				attr: { 'aria-label': t('ordered.remove'), title: t('ordered.remove') },
			})
			removeEl.addEventListener('click', () => {
				this.drafts.splice(this.drafts.indexOf(draft), 1)
				this.renderList(listEl)
			})
		}
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
