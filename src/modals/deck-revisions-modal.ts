import { App, Modal, Notice, Setting, TFile } from 'obsidian'
import type { DeckRevision } from '../services/deck-store'
import type { CardMeta } from '../services/card-notes'
import { diffDecklists } from '../domain/deck-diff'
import { ConfirmModal } from './confirm-modal'
import { t } from '../i18n'
import type TcgBinderPlugin from '../main'

/**
 * Saved snapshots of a decklist: save the current list, view an old one,
 * diff it against the current list, copy it out, restore it or delete it.
 * Keeps a local copy of the revisions array — the metadataCache reparses
 * asynchronously, so re-reading right after a write would show stale data.
 */
export class DeckRevisionsModal extends Modal {
	/** Chronological, mirroring the stored array (display reverses it). */
	private revisions: DeckRevision[]
	private readonly index: Map<string, CardMeta>
	/** "<stored index>:view" | "<stored index>:diff" — one panel open at a time. */
	private expanded: string | null = null

	constructor(
		app: App,
		private readonly plugin: TcgBinderPlugin,
		private readonly file: TFile,
	) {
		super(app)
		this.revisions = plugin.decks.readRevisions(file)
		this.index = plugin.cardNotes.buildIndex()
	}

	onOpen(): void {
		this.setTitle(t('rev.title', { deck: this.file.basename }))
		this.render()
	}

	onClose(): void {
		this.contentEl.empty()
	}

	private render(): void {
		const { contentEl } = this
		contentEl.empty()

		let label = ''
		new Setting(contentEl)
			.setName(t('rev.save'))
			.addText((text) => {
				text.setPlaceholder(t('rev.label-placeholder'))
				text.onChange((value) => {
					label = value
				})
			})
			.addButton((btn) => {
				btn.setButtonText(t('rev.save-btn'))
					.setCta()
					.onClick(() => {
						const revision = this.plugin.decks.snapshotRevision(this.file, label)
						void this.plugin.decks.addRevision(this.file, revision).then(() => {
							this.revisions.push(revision)
							new Notice(t('rev.saved'))
							this.render()
						})
					})
			})

		if (this.revisions.length === 0) {
			contentEl.createEl('p', { cls: 'tcgb-empty', text: t('rev.empty') })
			return
		}

		// Newest first; keep the stored index for delete/expand bookkeeping.
		for (let stored = this.revisions.length - 1; stored >= 0; stored--) {
			const revision = this.revisions[stored]
			const total = revision.entries.reduce((sum, line) => sum + line.qty, 0)
			const row = new Setting(contentEl)
				.setName(revision.label.length > 0 ? `${revision.saved} · ${revision.label}` : revision.saved)
				.setDesc(`${t('deck-to-collections.count', { count: total })} · ${t(`format.${revision.format}`)}`)
			row.addExtraButton((btn) => {
				btn.setIcon('eye')
					.setTooltip(t('rev.view'))
					.onClick(() => {
						this.toggle(`${stored}:view`)
					})
			})
			row.addExtraButton((btn) => {
				btn.setIcon('arrow-left-right')
					.setTooltip(t('rev.diff'))
					.onClick(() => {
						this.toggle(`${stored}:diff`)
					})
			})
			row.addExtraButton((btn) => {
				btn.setIcon('clipboard-copy')
					.setTooltip(t('rev.export'))
					.onClick(() => {
						void this.plugin.exportDecklist(revision.entries)
					})
			})
			row.addExtraButton((btn) => {
				btn.setIcon('rotate-ccw')
					.setTooltip(t('rev.restore'))
					.onClick(() => {
						this.confirmRestore(revision)
					})
			})
			row.addExtraButton((btn) => {
				btn.setIcon('trash')
					.setTooltip(t('rev.delete'))
					.onClick(() => {
						this.confirmDelete(stored, revision)
					})
			})

			if (this.expanded === `${stored}:view`) this.renderList(contentEl, revision)
			if (this.expanded === `${stored}:diff`) this.renderDiff(contentEl, revision)
		}
	}

	private toggle(key: string): void {
		this.expanded = this.expanded === key ? null : key
		this.render()
	}

	private lineLabel(id: string, qty: number): string {
		const meta = this.index.get(id)
		const setInfo = [meta?.setCode, meta?.number].filter(Boolean).join(' ')
		return `${qty}× ${meta?.name ?? id}${setInfo ? ` (${setInfo})` : ''}`
	}

	private renderList(container: HTMLElement, revision: DeckRevision): void {
		const panel = container.createDiv('tcgb-rev-panel')
		for (const line of revision.entries) {
			panel.createDiv({ cls: 'tcgb-rev-line', text: this.lineLabel(line.id, line.qty) })
		}
	}

	/** What changed FROM this revision TO the current list. */
	private renderDiff(container: HTMLElement, revision: DeckRevision): void {
		const panel = container.createDiv('tcgb-rev-panel')
		const current = this.plugin.decks.readEntries(this.file)
		const changes = diffDecklists(revision.entries, current)
		if (changes.length === 0) {
			panel.createDiv({ cls: 'tcgb-rev-line', text: t('rev.diff-empty') })
			return
		}
		for (const change of changes) {
			const sign = change.delta > 0 ? '+' : '−'
			panel.createDiv({
				cls: `tcgb-rev-line ${change.delta > 0 ? 'tcgb-rev-add' : 'tcgb-rev-remove'}`,
				text: `${sign}${this.lineLabel(change.id, Math.abs(change.delta))}`,
			})
		}
	}

	private confirmRestore(revision: DeckRevision): void {
		new ConfirmModal(
			this.app,
			t('rev.restore-title'),
			t('rev.restore-body', { saved: revision.saved }),
			() => {
				void (async () => {
					try {
						const backup = this.plugin.decks.snapshotRevision(this.file, t('rev.auto-backup'))
						await this.plugin.decks.addRevision(this.file, backup)
						await this.plugin.decks.setEntries(this.file, revision.entries)
						await this.plugin.decks.setFormat(this.file, revision.format)
						this.revisions.push(backup)
						new Notice(t('rev.restored'))
						this.render()
					} catch (error) {
						new Notice(String(error))
					}
				})()
			},
			t('rev.restore-confirm'),
		).open()
	}

	private confirmDelete(stored: number, revision: DeckRevision): void {
		new ConfirmModal(this.app, t('rev.delete-title'), t('rev.delete-body', { saved: revision.saved }), () => {
			void this.plugin.decks.removeRevision(this.file, stored).then(() => {
				this.revisions.splice(stored, 1)
				this.expanded = null
				new Notice(t('rev.deleted'))
				this.render()
			})
		}).open()
	}
}
