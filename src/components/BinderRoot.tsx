import { useEffect, useMemo, useRef, useState } from 'react'
import { Notice, type TFile } from 'obsidian'
import { useApp } from '../context'
import { ConfirmModal } from '../modals/confirm-modal'
import { resolveImageSource } from '../utils/vault'
import { t } from '../i18n'
import { useVaultVersion } from '../hooks/useVaultVersion'
import { CollectionView } from './CollectionView'
import { DeckView } from './DeckView'
import { PortfolioChart } from './PortfolioChart'
import type { CardMeta } from '../services/card-notes'
import type TcgBinderPlugin from '../main'

interface BinderRootProps {
	plugin: TcgBinderPlugin
}

interface Selection {
	kind: 'collection' | 'deck'
	file: TFile
}

/** Top-level React component: dashboard, one collection, or one deck. */
export function BinderRoot({ plugin }: BinderRootProps) {
	const app = useApp()
	const version = useVaultVersion()
	const [selected, setSelected] = useState<Selection | null>(null)
	const [chartRefresh, setChartRefresh] = useState(0)
	const [updatingPrices, setUpdatingPrices] = useState(false)
	const [fetchingImages, setFetchingImages] = useState(false)

	/** Trash (not delete) after confirmation — card notes are never touched. */
	const confirmDelete = (file: TFile, kind: 'collection' | 'deck') => {
		new ConfirmModal(
			app,
			t('delete.title', { name: file.basename }),
			t(kind === 'deck' ? 'delete.deck-body' : 'delete.collection-body'),
			() => {
				void app.fileManager.trashFile(file).then(() => {
					new Notice(t('notice.trashed', { name: file.basename }))
				})
			},
		).open()
	}

	const collections = useMemo(() => plugin.store.listFiles('collection'), [plugin, version])
	const decks = useMemo(() => plugin.store.listFiles('deck'), [plugin, version])
	const cardIndex = useMemo(() => plugin.cardNotes.buildIndex(), [plugin, version])

	// If the open collection/deck was deleted, fall back to the dashboard.
	useEffect(() => {
		if (!selected) return
		const pool = selected.kind === 'collection' ? collections : decks
		if (!pool.includes(selected.file)) setSelected(null)
	}, [collections, decks, selected])

	if (selected?.kind === 'collection') {
		return (
			<>
				<CollectionView
					plugin={plugin}
					file={selected.file}
					version={version}
					onBack={() => setSelected(null)}
				/>
				<ScrollTopFab />
			</>
		)
	}
	if (selected?.kind === 'deck') {
		return (
			<>
				<DeckView
					plugin={plugin}
					file={selected.file}
					version={version}
					onBack={() => setSelected(null)}
				/>
				<ScrollTopFab />
			</>
		)
	}

	return (
		<div className="tcgb-root">
			<h2 className="tcgb-title">{t('view.title')}</h2>

			<div className="tcgb-summary">
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">{collections.length}</span>
					{t('root.collections')}
				</div>
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">{decks.length}</span>
					{t('root.decks')}
				</div>
			</div>

			<PortfolioChart plugin={plugin} refresh={chartRefresh} />

			{(collections.length > 0 || decks.length > 0) && (
				<div className="tcgb-dashboard-actions">
					<button
						className="tcgb-btn"
						disabled={updatingPrices}
						onClick={() => {
							setUpdatingPrices(true)
							void plugin
								.updatePricesAndSnapshot()
								.finally(() => {
									setUpdatingPrices(false)
									setChartRefresh((n) => n + 1)
								})
						}}
					>
						{t('prices.update')}
					</button>
					<button
						className="tcgb-btn"
						disabled={fetchingImages}
						onClick={() => {
							setFetchingImages(true)
							void plugin.fetchMissingImages().finally(() => {
								setFetchingImages(false)
							})
						}}
					>
						{t('images.fetch')}
					</button>
				</div>
			)}

			{collections.length > 0 && (
				<section className="tcgb-list-section">
					<h3 className="tcgb-section-title">
						{t('root.collections')}
						<span className="tcgb-count-pill">{collections.length}</span>
					</h3>
					{collections.map((file) => (
						<div key={file.path} className="tcgb-list-item">
							<CollectionRow
								plugin={plugin}
								file={file}
								cardIndex={cardIndex}
								onOpen={() => setSelected({ kind: 'collection', file })}
							/>
							<button
								className="tcgb-row-action tcgb-list-delete"
								aria-label={t('confirm.delete')}
								title={t('confirm.delete')}
								onClick={() => confirmDelete(file, 'collection')}
							>
								×
							</button>
						</div>
					))}
				</section>
			)}

			{decks.length > 0 && (
				<section className="tcgb-list-section">
					<h3 className="tcgb-section-title">
						{t('root.decks')}
						<span className="tcgb-count-pill">{decks.length}</span>
					</h3>
					{decks.map((file) => {
						const total = plugin.decks.readEntries(file).reduce((sum, e) => sum + e.qty, 0)
						const cover = resolveImageSource(app, plugin.store.getCover(file))
						return (
							<div key={file.path} className="tcgb-list-item">
								<button
									className={`tcgb-list-row ${cover ? 'tcgb-list-row-covered' : ''}`}
									onClick={() => setSelected({ kind: 'deck', file })}
								>
									{cover && (
										<img
											className="tcgb-list-cover"
											src={cover}
											alt=""
											style={{ objectPosition: `50% ${plugin.store.getCoverPosition(file)}%` }}
										/>
									)}
									<span className="tcgb-list-name">{file.basename}</span>
									<span className={`tcgb-list-meta ${total === 60 ? 'tcgb-list-meta-ok' : ''}`}>
										{total}/60
									</span>
								</button>
								<button
									className="tcgb-row-action tcgb-list-delete"
									aria-label={t('confirm.delete')}
									title={t('confirm.delete')}
									onClick={() => confirmDelete(file, 'deck')}
								>
									×
								</button>
							</div>
						)
					})}
				</section>
			)}

			{collections.length === 0 && decks.length === 0 && (
				<div className="tcgb-empty-state">
					<p className="tcgb-empty-title">{t('root.empty')}</p>
					<ul className="tcgb-empty-hints">
						<li>{t('empty.search')}</li>
						<li>{t('empty.import')}</li>
						<li>{t('empty.deck')}</li>
					</ul>
				</div>
			)}
			<ScrollTopFab />
		</div>
	)
}

/**
 * Floating back-to-top button. Rendered as the last child of the content so
 * `position: sticky` pins it to the bottom edge of the view while scrolled;
 * it fades in once the view's scroll container has moved past one screenful.
 */
function ScrollTopFab() {
	const [visible, setVisible] = useState(false)
	const anchorRef = useRef<HTMLDivElement>(null)
	const scrollRef = useRef<HTMLElement | null>(null)

	useEffect(() => {
		// The ItemView's .view-content is the actual scroll container.
		const container = anchorRef.current?.closest('.view-content')
		const scrollEl = container instanceof HTMLElement ? container : anchorRef.current?.parentElement
		if (!scrollEl) return
		scrollRef.current = scrollEl
		const onScroll = () => {
			setVisible(scrollEl.scrollTop > scrollEl.clientHeight)
		}
		scrollEl.addEventListener('scroll', onScroll, { passive: true })
		onScroll()
		return () => {
			scrollEl.removeEventListener('scroll', onScroll)
		}
	}, [])

	return (
		<div ref={anchorRef} className="tcgb-fab-anchor">
			<button
				className={`tcgb-fab ${visible ? 'tcgb-fab-visible' : ''}`}
				aria-label={t('view.scroll-top')}
				title={t('view.scroll-top')}
				tabIndex={visible ? 0 : -1}
				onClick={() => {
					const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
					scrollRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
				}}
			>
				↑
			</button>
		</div>
	)
}

function CollectionRow({
	plugin,
	file,
	cardIndex,
	onOpen,
}: {
	plugin: TcgBinderPlugin
	file: TFile
	cardIndex: Map<string, CardMeta>
	onOpen: () => void
}) {
	const app = useApp()
	const entries = plugin.collections.readEntries(file)
	const total = entries.reduce((sum, entry) => sum + entry.qty, 0)
	const value = entries.reduce(
		(sum, entry) => sum + entry.qty * (cardIndex.get(entry.id)?.priceMarket ?? 0),
		0,
	)
	const cover = resolveImageSource(app, plugin.store.getCover(file))
	return (
		<button className={`tcgb-list-row ${cover ? 'tcgb-list-row-covered' : ''}`} onClick={onOpen}>
			{cover && (
				<img
					className="tcgb-list-cover"
					src={cover}
					alt=""
					style={{ objectPosition: `50% ${plugin.store.getCoverPosition(file)}%` }}
				/>
			)}
			<span className="tcgb-list-name">{file.basename}</span>
			<span className="tcgb-list-meta">
				{t('root.card-count', { count: total })} · ${value.toFixed(2)}
			</span>
		</button>
	)
}
