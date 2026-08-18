import { App, Menu, Notice, TFile } from 'obsidian'
import { CoverPickerModal } from '../modals/cover-picker-modal'
import { CoverPositionModal } from '../modals/cover-position-modal'
import { CoverUrlModal } from '../modals/cover-url-modal'
import { resolveImageSource } from './vault'
import { t } from '../i18n'
import type { CardMeta } from '../services/card-notes'
import type TcgBinderPlugin from '../main'

/**
 * The cover menu shared by the collection and deck views: pick a card from
 * the list, paste an external URL, upload a file, then adjust or remove.
 */
export function showCoverMenu(
	app: App,
	plugin: TcgBinderPlugin,
	file: TFile,
	cards: CardMeta[],
	event: MouseEvent,
): void {
	const menu = new Menu()
	menu.addItem((item) => {
		item.setTitle(t('cover.choose'))
			.setIcon('image')
			.onClick(() => {
				const candidates = cards.filter((meta) => meta.image !== null)
				new CoverPickerModal(app, candidates, (meta) => {
					const raw =
						meta.localImagePath ?? (meta.image && /^https?:\/\//.test(meta.image) ? meta.image : null)
					if (!raw) return
					void plugin.store.setCover(file, raw).then(() => {
						new Notice(t('notice.cover-set'))
					})
				}).open()
			})
	})
	menu.addItem((item) => {
		item.setTitle(t('cover.from-url'))
			.setIcon('link')
			.onClick(() => {
				new CoverUrlModal(app, (url) => {
					void plugin.store.setCover(file, url).then(() => {
						new Notice(t('notice.cover-set'))
					})
				}).open()
			})
	})
	menu.addItem((item) => {
		item.setTitle(t('cover.upload'))
			.setIcon('upload')
			.onClick(() => {
				// Detached input: menus have no DOM to host a hidden field.
				const input = createEl('input', {
					type: 'file',
					attr: { accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif' },
				})
				input.onchange = () => {
					const picked = input.files?.[0]
					if (!picked) return
					void picked
						.arrayBuffer()
						.then((data) => plugin.attachCoverImage(file, data, picked.name))
						.then(() => {
							new Notice(t('notice.cover-set'))
						})
						.catch((error: unknown) => {
							new Notice(String(error))
						})
				}
				input.click()
			})
	})
	if (plugin.store.getCover(file)) {
		menu.addItem((item) => {
			item.setTitle(t('cover.position'))
				.setIcon('move-vertical')
				.onClick(() => {
					const url = resolveImageSource(app, plugin.store.getCover(file))
					if (!url) return
					new CoverPositionModal(app, url, plugin.store.getCoverPosition(file), (pos) => {
						void plugin.store.setCoverPosition(file, pos)
					}).open()
				})
		})
		menu.addItem((item) => {
			item.setTitle(t('cover.remove'))
				.setIcon('trash')
				.onClick(() => {
					void plugin.store.removeCover(file).then(() => {
						new Notice(t('notice.cover-removed'))
					})
				})
		})
	}
	menu.showAtMouseEvent(event)
}
