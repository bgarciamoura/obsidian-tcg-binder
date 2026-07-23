import { useEffect, useMemo, useState } from 'react'
import { Notice, TFile } from 'obsidian'
import { useApp } from '../context'
import { t } from '../i18n'
import { CARD_CONDITIONS, CARD_VARIANTS } from '../types'
import type { CardCondition, CardVariant } from '../types'
import { computeCollectionStats } from '../domain/collection-stats'
import { computeSetProgress } from '../domain/set-progress'
import type { SetInfo } from '../services/card-data/card-data-source'
import type { CardMeta } from '../services/card-notes'
import type { StoredEntry } from '../services/collection-store'
import type TcgBinderPlugin from '../main'

interface CollectionViewProps {
	plugin: TcgBinderPlugin
	file: TFile
	version: number
	onBack: () => void
}

interface Row extends StoredEntry {
	meta: CardMeta | null
}

const ALL = 'all'

/** Table of one collection: filters, totals, market value and set progress. */
export function CollectionView({ plugin, file, version, onBack }: CollectionViewProps) {
	const app = useApp()
	const [sets, setSets] = useState<SetInfo[]>([])
	const [completion, setCompletion] = useState<
		Record<string, { missing: number; cost: number } | 'loading'>
	>({})
	const [setFilter, setSetFilter] = useState(ALL)
	const [variantFilter, setVariantFilter] = useState(ALL)
	const [conditionFilter, setConditionFilter] = useState(ALL)
	const [search, setSearch] = useState('')

	useEffect(() => {
		let cancelled = false
		void plugin.setCatalog.load().then((loaded) => {
			if (!cancelled) setSets(loaded)
		})
		return () => {
			cancelled = true
		}
	}, [plugin])

	const rows = useMemo<Row[]>(() => {
		const index = plugin.cardNotes.buildIndex()
		return plugin.collections
			.readEntries(file)
			.map((entry) => ({ ...entry, meta: index.get(entry.id) ?? null }))
	}, [plugin, file, version])

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase()
		return rows.filter((row) => {
			if (setFilter !== ALL && row.meta?.setId !== setFilter) return false
			if (variantFilter !== ALL && row.variant !== variantFilter) return false
			if (conditionFilter !== ALL && row.condition !== conditionFilter) return false
			if (query && !(row.meta?.name ?? row.id).toLowerCase().includes(query)) return false
			return true
		})
	}, [rows, setFilter, variantFilter, conditionFilter, search])

	const stats = useMemo(
		() =>
			computeCollectionStats(
				filtered.map((row) => ({
					card: { game: 'pokemon' as const, cardId: row.id, name: row.meta?.name ?? row.id },
					quantity: row.qty,
					variant: row.variant,
					condition: row.condition,
				})),
			),
		[filtered],
	)

	const totalValue = useMemo(
		() => filtered.reduce((sum, row) => sum + row.qty * (row.meta?.priceMarket ?? 0), 0),
		[filtered],
	)

	const ownedSets = useMemo(() => {
		const bySet = new Map<string, Set<string>>()
		for (const row of rows) {
			const setId = row.meta?.setId
			// qty-0 rows are checklist lines — they don't count as owned.
			if (!setId || row.qty <= 0) continue
			const owned = bySet.get(setId) ?? new Set<string>()
			owned.add(row.id)
			bySet.set(setId, owned)
		}
		return [...bySet.entries()]
			.map(([setId, owned]) => {
				const info = sets.find((s) => s.id === setId)
				return { setId, name: info?.name ?? setId, ...computeSetProgress(owned.size, info?.total ?? 0) }
			})
			.sort((a, b) => b.percent - a.percent)
	}, [rows, sets])

	/** Total copies per card id across variants/conditions — 4+ is a playset. */
	const copiesById = useMemo(() => {
		const map = new Map<string, number>()
		for (const row of rows) map.set(row.id, (map.get(row.id) ?? 0) + row.qty)
		return map
	}, [rows])

	const variants = useMemo(() => [...new Set(rows.map((r) => r.variant))], [rows])
	const conditions = useMemo(() => [...new Set(rows.map((r) => r.condition))], [rows])
	const rowSets = useMemo(() => {
		const ids = [...new Set(rows.map((r) => r.meta?.setId).filter((id): id is string => !!id))]
		return ids.map((id) => ({ id, name: sets.find((s) => s.id === id)?.name ?? id }))
	}, [rows, sets])

	const changeQty = (row: Row, delta: number) => {
		void plugin.collections.setQuantity(
			file,
			{ id: row.id, variant: row.variant, condition: row.condition },
			row.qty + delta,
		)
	}

	const rekey = (row: Row, variant: CardVariant, condition: CardCondition) => {
		void plugin.collections.updateEntryKey(
			file,
			{ id: row.id, variant: row.variant, condition: row.condition },
			variant,
			condition,
		)
	}

	/** Adds a sibling checklist line for the same card in the next unused variant. */
	const addVariantLine = (row: Row) => {
		const used = new Set(
			rows.filter((r) => r.id === row.id && r.condition === row.condition).map((r) => r.variant),
		)
		const next = CARD_VARIANTS.find((variant) => !used.has(variant))
		if (!next) {
			new Notice(t('notice.variants-exhausted'))
			return
		}
		void plugin.collections.addEntry(file, row.id, row.link, 0, next, row.condition, {
			id: row.id,
			variant: row.variant,
			condition: row.condition,
		})
	}

	const openCard = (row: Row) => {
		if (row.meta) void app.workspace.getLeaf(true).openFile(row.meta.file)
	}

	/** Fetches the full set once (cached) and prices the cards not yet owned. */
	const loadCompletion = (setId: string) => {
		setCompletion((current) => ({ ...current, [setId]: 'loading' }))
		void (async () => {
			try {
				const cards = await plugin.setCards.getSetCards(setId)
				const ownedIds = new Set(rows.filter((row) => row.meta?.setId === setId).map((row) => row.id))
				const missingCards = cards.filter((card) => !ownedIds.has(card.id))
				const cost = missingCards.reduce((sum, card) => sum + (card.marketPrice ?? 0), 0)
				setCompletion((current) => ({
					...current,
					[setId]: { missing: missingCards.length, cost },
				}))
			} catch (error) {
				console.error(`[TCG Binder] cost-to-completion failed for set ${setId}`, error)
				setCompletion((current) => {
					const next = { ...current }
					delete next[setId]
					return next
				})
				new Notice(t('search.error'))
			}
		})()
	}

	return (
		<div className="tcgb-root">
			<div className="tcgb-view-header">
				<button className="tcgb-back" onClick={onBack}>
					← {t('view.back')}
				</button>
				<h2 className="tcgb-title">{file.basename}</h2>
			</div>

			<div className="tcgb-summary">
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">{stats.totalCards}</span>
					{t('root.total-cards')}
				</div>
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">{stats.uniqueCards}</span>
					{t('view.unique')}
				</div>
				<div className="tcgb-stat">
					<span className="tcgb-stat-value">${totalValue.toFixed(2)}</span>
					{t('view.total-value')}
				</div>
			</div>

			<div className="tcgb-filters">
				<input
					className="tcgb-filter-search"
					type="search"
					placeholder={t('view.filter.search')}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<select value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>
					<option value={ALL}>{t('view.filter.all-sets')}</option>
					{rowSets.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
				<select value={variantFilter} onChange={(e) => setVariantFilter(e.target.value)}>
					<option value={ALL}>{t('view.filter.all-variants')}</option>
					{variants.map((v) => (
						<option key={v} value={v}>
							{t(`variant.${v}`)}
						</option>
					))}
				</select>
				<select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
					<option value={ALL}>{t('view.filter.all-conditions')}</option>
					{conditions.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</div>

			{filtered.length === 0 ? (
				<p className="tcgb-empty">{t('view.no-entries')}</p>
			) : (
				<div className="tcgb-table-wrap">
					<table className="tcgb-table">
						<thead>
							<tr>
								<th className="tcgb-cell-thumb" />
								<th>{t('view.col.card')}</th>
								<th>{t('view.col.set')}</th>
								<th>#</th>
								<th>{t('view.col.variant')}</th>
								<th>{t('view.col.condition')}</th>
								<th className="tcgb-cell-center">{t('view.col.playset')}</th>
								<th className="tcgb-cell-num">{t('view.col.qty')}</th>
								<th className="tcgb-cell-num">{t('view.col.price')}</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.map((row) => (
								<tr key={`${row.id}-${row.variant}-${row.condition}`}>
									<td className="tcgb-cell-thumb">
										{row.meta?.image ? (
											<img className="tcgb-thumb" loading="lazy" src={row.meta.image} alt="" />
										) : (
											<div className="tcgb-thumb tcgb-thumb-empty" />
										)}
									</td>
									<td>
										<a className="tcgb-card-link" onClick={() => openCard(row)}>
											{row.meta?.name ?? row.id}
										</a>
									</td>
									<td className="tcgb-cell-muted">
										{[row.meta?.setCode ?? row.meta?.setName].filter(Boolean).join('') || '—'}
									</td>
									<td className="tcgb-cell-muted">{row.meta?.number ?? '—'}</td>
									<td>
										<select
											className="tcgb-cell-select"
											value={row.variant}
											aria-label={t('view.col.variant')}
											onChange={(e) => rekey(row, e.target.value as CardVariant, row.condition)}
										>
											{CARD_VARIANTS.map((variant) => (
												<option key={variant} value={variant}>
													{t(`variant.${variant}`)}
												</option>
											))}
										</select>
									</td>
									<td>
										<select
											className={`tcgb-cell-select tcgb-cond tcgb-cond-${row.condition}`}
											value={row.condition}
											aria-label={t('view.col.condition')}
											onChange={(e) => rekey(row, row.variant, e.target.value as CardCondition)}
										>
											{CARD_CONDITIONS.map((condition) => (
												<option key={condition} value={condition}>
													{condition}
												</option>
											))}
										</select>
									</td>
									<td className="tcgb-cell-center">
										{(copiesById.get(row.id) ?? 0) >= 4 && (
											<span className="tcgb-playset" title={t('view.playset-tooltip')}>
												<svg
													className="tcgb-playset-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="3.5"
													strokeLinecap="round"
													strokeLinejoin="round"
													aria-hidden="true"
												>
													<path d="M20 6 9 17l-5-5" />
												</svg>
												4×
											</span>
										)}
									</td>
									<td className="tcgb-qty tcgb-cell-num">
										<button className="tcgb-qty-btn" onClick={() => changeQty(row, -1)}>
											−
										</button>
										<span className="tcgb-qty-value">{row.qty}</span>
										<button className="tcgb-qty-btn" onClick={() => changeQty(row, 1)}>
											+
										</button>
									</td>
									<td className="tcgb-cell-num">
										{row.meta?.priceMarket !== null && row.meta?.priceMarket !== undefined
											? `$${(row.qty * row.meta.priceMarket).toFixed(2)}`
											: '—'}
									</td>
									<td className="tcgb-cell-actions">
										<button
											className="tcgb-row-action"
											aria-label={t('view.add-variant')}
											title={t('view.add-variant')}
											onClick={() => addVariantLine(row)}
										>
											⧉
										</button>
										<button
											className="tcgb-remove"
											aria-label={t('view.remove')}
											title={t('view.remove')}
											onClick={() =>
												void plugin.collections.removeEntry(file, {
													id: row.id,
													variant: row.variant,
													condition: row.condition,
												})
											}
										>
											×
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{ownedSets.length > 0 && (
				<section className="tcgb-sets">
					<h3>{t('view.set-progress')}</h3>
					{ownedSets.map((set) => (
						<div key={set.setId} className="tcgb-set-row">
							<span className="tcgb-set-name">{set.name}</span>
							<div className="tcgb-progress">
								<div
									className="tcgb-progress-fill"
									style={{ transform: `scaleX(${set.percent / 100})` }}
								/>
							</div>
							<span className="tcgb-set-count">
								{set.owned}/{set.total || '?'} · {set.percent}%
							</span>
							{(() => {
								const state = completion[set.setId]
								if (state === undefined) {
									return (
										<button className="tcgb-cost-btn" onClick={() => loadCompletion(set.setId)}>
											{t('set.cost-button')}
										</button>
									)
								}
								if (state === 'loading') return <span className="tcgb-set-count">…</span>
								return (
									<span className="tcgb-set-cost">
										{t('set.cost', { missing: state.missing, cost: `$${state.cost.toFixed(2)}` })}
									</span>
								)
							})()}
						</div>
					))}
				</section>
			)}
		</div>
	)
}
