import { useEffect, useMemo, useRef, useState } from 'react'
import { Notice, type TFile } from 'obsidian'
import { useApp } from '../context'
import { ConfirmModal } from '../modals/confirm-modal'
import { CardDetailModal } from '../modals/card-detail-modal'
import { matchesAllTokens } from '../domain/text-match'
import { resolveImageSource } from '../utils/vault'
import type { StoredEntry } from '../services/collection-store'
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

	const [query, setQuery] = useState('')
	const searching = query.trim().length > 0

	/** Global search: every entry of every collection, matched by card name. */
	const results = useMemo(() => {
		if (!searching) return []
		const rows: { file: TFile; entry: StoredEntry; meta: CardMeta | null }[] = []
		for (const file of collections) {
			for (const entry of plugin.collections.readEntries(file)) {
				const meta = cardIndex.get(entry.id) ?? null
				const matches =
					matchesAllTokens(meta?.name ?? entry.id, query) ||
					(meta?.nameEn ? matchesAllTokens(meta.nameEn, query) : false)
				if (matches) rows.push({ file, entry, meta })
			}
		}
		return rows.sort((a, b) => (a.meta?.name ?? a.entry.id).localeCompare(b.meta?.name ?? b.entry.id))
	}, [searching, query, collections, cardIndex, plugin])

	const deckResults = useMemo(() => {
		if (!searching) return []
		const rows: { file: TFile; id: string; qty: number; meta: CardMeta | null }[] = []
		for (const file of decks) {
			for (const entry of plugin.decks.readEntries(file)) {
				const meta = cardIndex.get(entry.id) ?? null
				const matches =
					matchesAllTokens(meta?.name ?? entry.id, query) ||
					(meta?.nameEn ? matchesAllTokens(meta.nameEn, query) : false)
				if (matches) rows.push({ file, id: entry.id, qty: entry.qty, meta })
			}
		}
		return rows.sort((a, b) => (a.meta?.name ?? a.id).localeCompare(b.meta?.name ?? b.id))
	}, [searching, query, decks, cardIndex, plugin])

	/** Opens the card viewer navigating over the (deduped) result cards. */
	const openResultCard = (meta: CardMeta | null) => {
		if (!meta) return
		const seen = new Set<string>()
		const metas: CardMeta[] = []
		for (const row of [...results.map((r) => r.meta), ...deckResults.map((r) => r.meta)]) {
			if (row && !seen.has(row.cardId)) {
				seen.add(row.cardId)
				metas.push(row)
			}
		}
		const start = metas.findIndex((m) => m.cardId === meta.cardId)
		new CardDetailModal(app, plugin, metas, Math.max(0, start)).open()
	}

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

			<input
				className="tcgb-global-search"
				type="search"
				placeholder={t('root.search')}
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>

			{searching && (
				<>
					<section className="tcgb-list-section">
						<h3 className="tcgb-section-title">
							{t('root.search-results')}
							<span className="tcgb-count-pill">{results.length}</span>
						</h3>
						{results.length === 0 ? (
							<p className="tcgb-empty">{t('search.empty')}</p>
						) : (
							results.map(({ file, entry, meta }) => (
								<div
									key={`${file.path}-${entry.id}-${entry.variant}-${entry.condition}`}
									className="tcgb-deck-row"
								>
									{meta?.image ? (
										<img className="tcgb-thumb" loading="lazy" src={meta.image} alt="" />
									) : (
										<div className="tcgb-thumb tcgb-thumb-empty" />
									)}
									<a className="tcgb-card-link" onClick={() => openResultCard(meta)}>
										{meta?.name ?? entry.id}
									</a>
									<span className="tcgb-deck-row-meta">
										{entry.qty}× · {t(`variant.${entry.variant}`)} · {entry.condition}
									</span>
									<button
										className="tcgb-result-loc"
										onClick={() => setSelected({ kind: 'collection', file })}
									>
										{file.basename}
									</button>
								</div>
							))
						)}
					</section>

					{deckResults.length > 0 && (
						<section className="tcgb-list-section">
							<h3 className="tcgb-section-title">
								{t('root.search-decks')}
								<span className="tcgb-count-pill">{deckResults.length}</span>
							</h3>
							{deckResults.map(({ file, id, qty, meta }) => (
								<div key={`${file.path}-${id}`} className="tcgb-deck-row">
									{meta?.image ? (
										<img className="tcgb-thumb" loading="lazy" src={meta.image} alt="" />
									) : (
										<div className="tcgb-thumb tcgb-thumb-empty" />
									)}
									<a className="tcgb-card-link" onClick={() => openResultCard(meta)}>
										{meta?.name ?? id}
									</a>
									<span className="tcgb-deck-row-meta">{qty}×</span>
									<button
										className="tcgb-result-loc"
										onClick={() => setSelected({ kind: 'deck', file })}
									>
										{file.basename}
									</button>
								</div>
							))}
						</section>
					)}
				</>
			)}

			{!searching && (
			<>
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
			</>
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
