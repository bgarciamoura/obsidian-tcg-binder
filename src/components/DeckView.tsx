import { useMemo } from 'react'
import type { TFile } from 'obsidian'
import { useApp } from '../context'
import { t } from '../i18n'
import { validateDeck, validateDeckLegality } from '../domain/deck-rules'
import type { CardMeta } from '../services/card-notes'
import type { DeckStoredEntry } from '../services/deck-store'
import type { DeckFormat } from '../types'
import type TcgBinderPlugin from '../main'

interface DeckViewProps {
	plugin: TcgBinderPlugin
	file: TFile
	version: number
	onBack: () => void
}

interface Row extends DeckStoredEntry {
	meta: CardMeta | null
}

const GROUPS = ['pokemon', 'trainer', 'energy'] as const
type Group = (typeof GROUPS)[number]

function groupOf(row: Row): Group {
	if (row.meta?.supertype === 'Pokémon') return 'pokemon'
	if (row.meta?.supertype === 'Energy') return 'energy'
	return 'trainer'
}

/** One deck: grouped list, live validation, price and missing-vs-collection. */
export function DeckView({ plugin, file, version, onBack }: DeckViewProps) {
	const app = useApp()
	const format = plugin.decks.readFormat(file)

	const rows = useMemo<Row[]>(() => {
		const index = plugin.cardNotes.buildIndex()
		return plugin.decks.readEntries(file).map((entry) => ({ ...entry, meta: index.get(entry.id) ?? null }))
	}, [plugin, file, version])

	const total = useMemo(() => rows.reduce((sum, row) => sum + row.qty, 0), [rows])

	const issues = useMemo(() => {
		const deckEntries = rows.map((row) => ({
			card: { game: 'pokemon' as const, cardId: row.id, name: row.meta?.name ?? row.id },
			quantity: row.qty,
			copyLimitExempt: row.meta?.copyLimitExempt ?? false,
		}))
		const legalityEntries = rows.map((row) => ({
			name: row.meta?.name ?? row.id,
			legalities: row.meta?.legalities ?? null,
		}))
		return [...validateDeck(deckEntries), ...validateDeckLegality(legalityEntries, format)]
	}, [rows, format])

	const totalPrice = useMemo(
		() => rows.reduce((sum, row) => sum + row.qty * (row.meta?.priceMarket ?? 0), 0),
		[rows],
	)

	const owned = useMemo(() => {
		const map = new Map<string, number>()
		for (const collection of plugin.store.listFiles('collection')) {
			if (plugin.store.getRole(collection) === 'wishlist') continue
			for (const entry of plugin.collections.readEntries(collection)) {
				map.set(entry.id, (map.get(entry.id) ?? 0) + entry.qty)
			}
		}
		return map
	}, [plugin, version])

	const missing = useMemo(
		() =>
			rows
				.map((row) => ({ ...row, missingQty: Math.max(0, row.qty - (owned.get(row.id) ?? 0)) }))
				.filter((row) => row.missingQty > 0),
		[rows, owned],
	)

	const missingCost = useMemo(
		() => missing.reduce((sum, row) => sum + row.missingQty * (row.meta?.priceMarket ?? 0), 0),
		[missing],
	)

	const changeQty = (row: Row, delta: number) => {
		void plugin.decks.setQuantity(file, row.id, row.qty + delta)
	}

	const openCard = (row: Row) => {
		if (row.meta) void app.workspace.getLeaf(true).openFile(row.meta.file)
	}

	const grouped = useMemo(() => {
		const buckets: Record<Group, Row[]> = { pokemon: [], trainer: [], energy: [] }
		for (const row of rows) buckets[groupOf(row)].push(row)
		for (const group of GROUPS) {
			buckets[group].sort((a, b) => (a.meta?.name ?? a.id).localeCompare(b.meta?.name ?? b.id))
		}
		return buckets
	}, [rows])

	return (
		<div className="tcgb-root">
			<div className="tcgb-view-header">
				<button className="tcgb-back" onClick={onBack}>
					← {t('view.back')}
				</button>
				<h2 className="tcgb-title">{file.basename}</h2>
			</div>

			<div className="tcgb-deck-toolbar">
				<select
					value={format}
					onChange={(e) => void plugin.decks.setFormat(file, e.target.value as DeckFormat)}
				>
					<option value="standard">{t('format.standard')}</option>
					<option value="expanded">{t('format.expanded')}</option>
					<option value="unlimited">{t('format.unlimited')}</option>
				</select>
				<button className="tcgb-btn tcgb-btn-cta" onClick={() => plugin.runAddToDeckLoop([file])}>
					{t('deck.add-cards')}
				</button>
				<button className="tcgb-btn" onClick={() => void plugin.exportDeck(file)}>
					{t('deck.export')}
				</button>
			</div>

			<div className="tcgb-summary">
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">{total}/60</span>
					{t('deck.total')}
				</div>
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">${totalPrice.toFixed(2)}</span>
					{t('view.total-value')}
				</div>
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">${missingCost.toFixed(2)}</span>
					{t('deck.missing-cost')}
				</div>
			</div>

			{issues.length === 0 ? (
				<div className="tcgb-panel tcgb-panel-ok">✓ {t('deck.valid')}</div>
			) : (
				<div className="tcgb-panel tcgb-panel-issues">
					<div className="tcgb-panel-title">{t('deck.issues', { count: issues.length })}</div>
					<ul className="tcgb-deck-issues">
						{issues.map((issue, i) => (
							<li key={i}>{issue.message}</li>
						))}
					</ul>
				</div>
			)}

			{GROUPS.map((group) => {
				const items = grouped[group]
				if (items.length === 0) return null
				return (
					<section key={group} className="tcgb-deck-group">
						<h3 className="tcgb-section-title">
							{t(`deck.group.${group}`)}
							<span className="tcgb-count-pill">{items.reduce((sum, r) => sum + r.qty, 0)}</span>
						</h3>
						{items.map((row) => (
							<div key={row.id} className="tcgb-deck-row">
								{row.meta?.image ? (
									<img className="tcgb-thumb" loading="lazy" src={row.meta.image} alt="" />
								) : (
									<div className="tcgb-thumb tcgb-thumb-empty" />
								)}
								<span className="tcgb-qty">
									<button className="tcgb-qty-btn" onClick={() => changeQty(row, -1)}>
										−
									</button>
									<span className="tcgb-qty-value">{row.qty}</span>
									<button className="tcgb-qty-btn" onClick={() => changeQty(row, 1)}>
										+
									</button>
								</span>
								<a className="tcgb-card-link" onClick={() => openCard(row)}>
									{row.meta?.name ?? row.id}
								</a>
								<span className="tcgb-deck-row-meta">
									{[row.meta?.setCode, row.meta?.number].filter(Boolean).join(' ')}
								</span>
								<button
									className="tcgb-remove"
									aria-label={t('view.remove')}
									onClick={() => changeQty(row, -row.qty)}
								>
									×
								</button>
							</div>
						))}
					</section>
				)
			})}

			<section className="tcgb-deck-missing">
				<h3 className="tcgb-section-title">
					{t('deck.missing')}
					{missing.length > 0 && <span className="tcgb-count-pill">{missing.length}</span>}
				</h3>
				{missing.length === 0 ? (
					<p className="tcgb-empty">{t('deck.missing-none')}</p>
				) : (
					missing.map((row) => (
						<div key={row.id} className="tcgb-deck-row">
							{row.meta?.image ? (
								<img className="tcgb-thumb" loading="lazy" src={row.meta.image} alt="" />
							) : (
								<div className="tcgb-thumb tcgb-thumb-empty" />
							)}
							<span className="tcgb-deck-missing-qty">{row.missingQty}×</span>
							<a className="tcgb-card-link" onClick={() => openCard(row)}>
								{row.meta?.name ?? row.id}
							</a>
							<span className="tcgb-deck-row-meta tcgb-cell-num">
								{row.meta?.priceMarket !== null && row.meta?.priceMarket !== undefined
									? `$${(row.missingQty * row.meta.priceMarket).toFixed(2)}`
									: '—'}
							</span>
						</div>
					))
				)}
			</section>
		</div>
	)
}
