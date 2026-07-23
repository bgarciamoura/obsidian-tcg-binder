import { useEffect, useMemo, useState } from 'react'
import type { TFile } from 'obsidian'
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
	const version = useVaultVersion()
	const [selected, setSelected] = useState<Selection | null>(null)
	const [chartRefresh, setChartRefresh] = useState(0)
	const [updatingPrices, setUpdatingPrices] = useState(false)

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
			<CollectionView
				plugin={plugin}
				file={selected.file}
				version={version}
				onBack={() => setSelected(null)}
			/>
		)
	}
	if (selected?.kind === 'deck') {
		return (
			<DeckView
				plugin={plugin}
				file={selected.file}
				version={version}
				onBack={() => setSelected(null)}
			/>
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

			{collections.length > 0 && (
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
			)}

			{collections.length > 0 && (
				<section className="tcgb-list-section">
					<h3 className="tcgb-section-title">
						{t('root.collections')}
						<span className="tcgb-count-pill">{collections.length}</span>
					</h3>
					{collections.map((file) => (
						<CollectionRow
							key={file.path}
							plugin={plugin}
							file={file}
							cardIndex={cardIndex}
							onOpen={() => setSelected({ kind: 'collection', file })}
						/>
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
						return (
							<button
								key={file.path}
								className="tcgb-list-row"
								onClick={() => setSelected({ kind: 'deck', file })}
							>
								<span className="tcgb-list-name">{file.basename}</span>
								<span className={`tcgb-list-meta ${total === 60 ? 'tcgb-list-meta-ok' : ''}`}>
									{total}/60
								</span>
							</button>
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
	const entries = plugin.collections.readEntries(file)
	const total = entries.reduce((sum, entry) => sum + entry.qty, 0)
	const value = entries.reduce(
		(sum, entry) => sum + entry.qty * (cardIndex.get(entry.id)?.priceMarket ?? 0),
		0,
	)
	return (
		<button className="tcgb-list-row" onClick={onOpen}>
			<span className="tcgb-list-name">{file.basename}</span>
			<span className="tcgb-list-meta">
				{t('root.card-count', { count: total })} · ${value.toFixed(2)}
			</span>
		</button>
	)
}
