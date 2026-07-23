import { App, FuzzySuggestModal } from 'obsidian'
import type { SetInfo } from '../services/card-data/card-data-source'
import { t } from '../i18n'

/** Fuzzy picker over the set catalog, newest sets first. */
export class SetPickerModal extends FuzzySuggestModal<SetInfo> {
	constructor(
		app: App,
		private readonly sets: SetInfo[],
		private readonly onPick: (set: SetInfo) => void,
	) {
		super(app)
		this.setPlaceholder(t('picker.set'))
	}

	getItems(): SetInfo[] {
		return this.sets
	}

	getItemText(set: SetInfo): string {
		return [set.name, set.code ?? '', set.series].filter(Boolean).join(' · ')
	}

	onChooseItem(set: SetInfo): void {
		this.onPick(set)
	}
}
