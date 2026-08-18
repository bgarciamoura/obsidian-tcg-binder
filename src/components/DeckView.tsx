import { useEffect, useMemo, useState } from 'react'
import { Notice, type TFile } from 'obsidian'
import { useApp } from '../context'
import { showCoverMenu } from '../utils/cover-menu'
import { t } from '../i18n'
import { legalitiesByFunctionalName, validateDeck, validateDeckLegality } from '../domain/deck-rules'
import { functionalKey } from '../domain/text-match'
import type { ViewMode } from '../settings'
import type { CardMeta } from '../services/card-notes'
import { buildOwnershipMaps } from '../services/deck-availability'
import type { DeckStoredEntry } from '../services/deck-store'
import type { DeckFormat } from '../types'
import { CardDetailModal } from '../modals/card-detail-modal'
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
	const assembled = plugin.decks.readAssembled(file)
	const [mode, setMode] = useState<ViewMode>(plugin.settings.defaultViewMode)

	const cardIndex = useMemo(() => plugin.cardNotes.buildIndex(), [plugin, version])

	const rows = useMemo<Row[]>(
		() =>
			plugin.decks.readEntries(file).map((entry) => ({ ...entry, meta: cardIndex.get(entry.id) ?? null })),
		[plugin, file, version, cardIndex],
	)

	const total = useMemo(() => rows.reduce((sum, row) => sum + row.qty, 0), [rows])

	/**
	 * Reprint rule: legality per FUNCTIONAL name, unioned across every card
	 * note in the binder — an old printing is legal when a current same-name
	 * reprint (in this deck or any collection) is.
	 */
	const legalByName = useMemo(
		() =>
			legalitiesByFunctionalName(
				[...cardIndex.values()].map((meta) => ({
					id: meta.cardId,
					name: meta.name,
					nameEn: meta.nameEn,
					legalities: meta.legalities,
				})),
			),
		[cardIndex],
	)

	const effectiveLegalities = (row: Row): string[] | null => {
		const key = functionalKey(row.meta?.nameEn ?? null, row.meta?.name ?? null, row.id)
		const byName = legalByName.get(key)
		if (byName && byName.size > 0) return [...byName]
		return row.meta?.legalities ?? null
	}

	const issues = useMemo(() => {
		const deckEntries = rows.map((row) => ({
			card: { game: 'pokemon' as const, cardId: row.id, name: row.meta?.name ?? row.id },
			quantity: row.qty,
			copyLimitExempt: row.meta?.copyLimitExempt ?? false,
		}))
		const legalityEntries = rows.map((row) => ({
			name: row.meta?.name ?? row.id,
			legalities: effectiveLegalities(row),
		}))
		return [...validateDeck(deckEntries), ...validateDeckLegality(legalityEntries, format)]
	}, [rows, format, legalByName])

	// Cards still illegal after the local union get checked against the card
	// database for a legal reprint — a hit stamps the note and revalidates.
	useEffect(() => {
		if (format !== 'standard' && format !== 'expanded') return
		const flagged = rows
			.filter((row) => {
				const legalities = effectiveLegalities(row)
				return row.meta !== null && legalities !== null && !legalities.includes(format)
			})
			.map((row) => row.meta)
			.filter((meta): meta is CardMeta => meta !== null)
		if (flagged.length > 0) void plugin.checkReprintLegalities(flagged, format)
	}, [rows, format, legalByName, plugin])

	const totalPrice = useMemo(
		() => rows.reduce((sum, row) => sum + row.qty * (row.meta?.priceMarket ?? 0), 0),
		[rows],
	)

	const owned = useMemo(
		() => buildOwnershipMaps(plugin, cardIndex, file.path),
		[plugin, version, cardIndex, file],
	)

	const missing = useMemo(() => {
		// Deck lines of the same name share one owned pool (any printing
		// satisfies the deck), so availability is computed per NAME — but the
		// display keeps one row per PRINTING, or edits to the printing split
		// look like the list did not update. Owned copies cover the printings
		// in deck order; what remains is what is actually missing per line.
		const groups = new Map<string, { allocated: number; rows: Row[] }>()
		for (const row of rows) {
			const key = functionalKey(row.meta?.nameEn ?? null, row.meta?.name ?? null, row.id)
			const group = groups.get(key) ?? { allocated: 0, rows: [] }
			group.allocated += row.allocated
			group.rows.push(row)
			groups.set(key, group)
		}
		const result: (Row & {
			ownedQty: number
			reservedQty: number
			allocatedQty: number
			missingQty: number
			showNote: boolean
		})[] = []
		for (const [key, group] of groups) {
			const first = group.rows[0]
			const ownedQty = owned.inCollections.byName.get(key) ?? owned.inCollections.byId.get(first.id) ?? 0
			const reservedQty = owned.reserved.byName.get(key) ?? owned.reserved.byId.get(first.id) ?? 0
			// Clamp: reserved copies can push availability negative, but a
			// deck can never miss more copies than it needs. Copies allocated
			// to THIS deck are guaranteed to it.
			let available = Math.max(Math.max(0, ownedQty - reservedQty), group.allocated)
			let firstMissing = true
			for (const row of group.rows) {
				const covered = Math.min(row.qty, available)
				available -= covered
				const missingQty = row.qty - covered
				if (missingQty === 0) continue
				result.push({
					...row,
					ownedQty,
					reservedQty,
					allocatedQty: group.allocated,
					missingQty,
					// The ownership note is name-level — repeat it once per name.
					showNote: firstMissing,
				})
				firstMissing = false
			}
		}
		return result
	}, [rows, owned])

	const missingCost = useMemo(
		() => missing.reduce((sum, row) => sum + row.missingQty * (row.meta?.priceMarket ?? 0), 0),
		[missing],
	)

	const changeQty = (row: Row, delta: number) => {
		void plugin.decks.setQuantity(file, row.id, row.qty + delta)
	}

	const grouped = useMemo(() => {
		const buckets: Record<Group, Row[]> = { pokemon: [], trainer: [], energy: [] }
		for (const row of rows) buckets[groupOf(row)].push(row)
		for (const group of GROUPS) {
			buckets[group].sort((a, b) => (a.meta?.name ?? a.id).localeCompare(b.meta?.name ?? b.id))
		}
		return buckets
	}, [rows])

	/** Navigation order for the card viewer = the grouped order on screen. */
	const detailMetas = useMemo(
		() =>
			GROUPS.flatMap((group) => grouped[group])
				.map((row) => row.meta)
				.filter((meta): meta is CardMeta => meta !== null),
		[grouped],
	)

	const openCard = (row: Row) => {
		if (!row.meta) return
		const start = detailMetas.findIndex((meta) => meta.cardId === row.meta?.cardId)
		new CardDetailModal(app, plugin, detailMetas, Math.max(0, start)).open()
	}

	const openCoverMenu = (event: MouseEvent) => {
		showCoverMenu(app, plugin, file, detailMetas, event)
	}

	const missingToWishlist = () => {
		void plugin
			.addMissingToWishlist(missing.map((row) => ({ id: row.id, link: row.link, qty: row.missingQty })))
			.then((count) => {
				new Notice(count > 0 ? t('wishlist.added', { count }) : t('wishlist.covered'))
			})
	}

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
				{plugin.settings.reserveDeckCopies && (
					<label className="tcgb-assembled" title={t('deck.assembled-hint')}>
						<input
							type="checkbox"
							checked={assembled}
							onChange={(e) => void plugin.decks.setAssembled(file, e.target.checked)}
						/>
						{t('deck.assembled')}
					</label>
				)}
				<button className="tcgb-btn tcgb-btn-cta" onClick={() => plugin.runAddToDeckLoop([file])}>
					{t('deck.add-cards')}
				</button>
				<button className="tcgb-btn" onClick={() => void plugin.exportDeck(file)}>
					{t('deck.export')}
				</button>
				<button
					className="tcgb-btn"
					title={t('deck.to-collections-hint')}
					onClick={() => void plugin.addDeckToCollections(file)}
				>
					{t('deck.to-collections')}
				</button>
				<button
					className="tcgb-btn tcgb-mode-toggle"
					title={t('view.toggle-mode')}
					aria-label={t('view.toggle-mode')}
					onClick={() => setMode((m) => (m === 'list' ? 'grid' : 'list'))}
				>
					{mode === 'list' ? '▦' : '≣'}
				</button>
				<button
					className="tcgb-btn tcgb-mode-toggle"
					title={t('cover.set')}
					aria-label={t('cover.set')}
					onClick={(event) => {
						openCoverMenu(event.nativeEvent)
					}}
				>
					🖼
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
						{mode === 'grid' ? (
							<div className="tcgb-card-grid">
								{items.map((row) => (
									<div key={row.id} className="tcgb-card-tile">
										<div className="tcgb-tile-imgwrap" onClick={() => openCard(row)}>
											{row.meta?.image ? (
												<img className="tcgb-tile-img" loading="lazy" src={row.meta.image} alt="" />
											) : (
												<div className="tcgb-tile-img tcgb-tile-img-empty" />
											)}
											<span className="tcgb-tile-qty">{row.qty}×</span>
										</div>
										<div className="tcgb-tile-name" onClick={() => openCard(row)}>
											{row.meta?.name ?? row.id}
										</div>
										<div className="tcgb-tile-footer">
											<span className="tcgb-tile-meta">
												{[row.meta?.setCode, row.meta?.number].filter(Boolean).join(' ')}
											</span>
											<span className="tcgb-qty">
												<button className="tcgb-qty-btn" onClick={() => changeQty(row, -1)}>
													−
												</button>
												<button className="tcgb-qty-btn" onClick={() => changeQty(row, 1)}>
													+
												</button>
											</span>
										</div>
									</div>
								))}
							</div>
						) : (
							items.map((row) => (
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
							))
						)}
					</section>
				)
			})}

			<section className="tcgb-deck-missing">
				<h3 className="tcgb-section-title">
					{t('deck.missing')}
					{missing.length > 0 && <span className="tcgb-count-pill">{missing.length}</span>}
					{missing.length > 0 && (
						<button className="tcgb-btn tcgb-missing-wishlist" onClick={missingToWishlist}>
							{t('deck.missing-to-wishlist')}
						</button>
					)}
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
							<div className="tcgb-deck-missing-name">
								<a className="tcgb-card-link" onClick={() => openCard(row)}>
									{row.meta?.name ?? row.id}
									{row.meta && (row.meta.setCode || row.meta.number) && (
										<span className="tcgb-deck-missing-set">
											{' '}
											{[row.meta.setCode, row.meta.number].filter(Boolean).join(' ')}
										</span>
									)}
								</a>
								{row.showNote && ((row.ownedQty > 0 && row.reservedQty > 0) || row.allocatedQty > 0) && (
									<span className="tcgb-deck-missing-note">
										{t('deck.missing-reserved', {
											owned: row.ownedQty,
											reserved: row.reservedQty,
										})}
										{row.allocatedQty > 0 &&
											` · ${t('deck.missing-allocated', { allocated: row.allocatedQty })}`}
									</span>
								)}
							</div>
							<span className="tcgb-deck-row-meta tcgb-cell-num">
								{row.meta?.priceMarket !== null && row.meta?.priceMarket !== undefined
									? `$${(row.missingQty * row.meta.priceMarket).toFixed(2)}`
									: '—'}
							</span>
							{row.meta && (
								<button
									className="tcgb-row-action"
									aria-label={t('deck.add-missing')}
									title={t('deck.add-missing')}
									onClick={() => {
										const meta = row.meta
										if (meta) void plugin.openAddOwnedCard(meta, row.link, row.missingQty, file)
									}}
								>
									+
								</button>
							)}
						</div>
					))
				)}
			</section>
		</div>
	)
}
