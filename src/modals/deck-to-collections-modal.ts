import { App, Modal, Setting, TFile } from 'obsidian'
import { t } from '../i18n'

/** One card-type group of a deck, shown as a destination-picker row. */
export interface DeckBucketGroup {
	/** Bucket id ("supporters", "pokemon-fire", ...) or "unknown". */
	key: string
	/** Localized bucket name shown as the row label. */
	label: string
	/** Total cards (sum of quantities) in this group. */
	qty: number
	/** Name for the "create new collection" option; null hides that option. */
	newName: string | null
	/** Initial dropdown value: 'new', 'skip' or an existing collection path. */
	defaultChoice: string
}

/** 'new' creates the group's suggested collection, 'skip' leaves it out, anything else is a collection path. */
export type BucketChoices = Map<string, string>

/**
 * Where should each card type of a deck go? One dropdown per type present
 * in the deck — the user stays in control instead of an automatic split.
 */
export class DeckToCollectionsModal extends Modal {
	constructor(
		app: App,
		private readonly deckName: string,
		private readonly groups: DeckBucketGroup[],
		private readonly collections: TFile[],
		private readonly onSubmit: (choices: BucketChoices) => void,
	) {
		super(app)
	}

	onOpen(): void {
		this.setTitle(t('deck-to-collections.title', { deck: this.deckName }))
		const { contentEl } = this
		contentEl.empty()

		const choices: BucketChoices = new Map(
			this.groups.map((group) => [group.key, group.defaultChoice]),
		)

		for (const group of this.groups) {
			new Setting(contentEl)
				.setName(group.label)
				.setDesc(t('deck-to-collections.count', { count: group.qty }))
				.addDropdown((dd) => {
					dd.addOption('skip', t('deck-to-collections.skip'))
					if (group.newName !== null) {
						dd.addOption('new', t('deck-to-collections.create', { name: group.newName }))
					}
					for (const collection of this.collections) {
						dd.addOption(collection.path, collection.basename)
					}
					dd.setValue(group.defaultChoice)
					dd.onChange((value) => {
						choices.set(group.key, value)
					})
				})
		}

		new Setting(contentEl).addButton((btn) => {
			btn.setButtonText(t('deck-to-collections.submit'))
				.setCta()
				.onClick(() => {
					this.close()
					this.onSubmit(choices)
				})
		})
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
