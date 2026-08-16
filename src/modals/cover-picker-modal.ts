import { App, FuzzySuggestModal } from 'obsidian'
import type { CardMeta } from '../services/card-notes'
import { t } from '../i18n'

/** Fuzzy picker over a list's cards — the chosen card's art becomes the cover. */
export class CoverPickerModal extends FuzzySuggestModal<CardMeta> {
	constructor(
		app: App,
		private readonly cards: CardMeta[],
		private readonly onPick: (meta: CardMeta) => void,
	) {
		super(app)
		this.setPlaceholder(t('cover.placeholder'))
	}

	getItems(): CardMeta[] {
		return this.cards
	}

	getItemText(meta: CardMeta): string {
		return [meta.name, meta.setCode ?? '', meta.number ?? ''].filter(Boolean).join(' ')
	}

	onChooseItem(meta: CardMeta): void {
		this.onPick(meta)
	}
}
