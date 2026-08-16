import { useCallback, useEffect, useRef, useState } from 'react'
import { Notice } from 'obsidian'
import { t } from '../i18n'
import type { CardDetails } from '../services/card-data/card-data-source'
import type { CardMeta } from '../services/card-notes'
import type TcgBinderPlugin from '../main'

interface CardDetailProps {
	plugin: TcgBinderPlugin
	metas: CardMeta[]
	startIndex: number
	/** Hands the navigate function to the host modal (keyboard arrows). */
	registerNavigate: (navigate: (delta: number) => void) => void
	onOpenNote: (meta: CardMeta) => void
}

/**
 * Full card text is fetched on demand (card notes only store metadata) and
 * memoized across modal openings. `null` marks a completed fetch with nothing
 * to show — distinct from "not fetched yet" — so misses aren't re-requested
 * while the user flips back and forth.
 */
const detailsCache = new Map<string, CardDetails | null>()
const DETAILS_CACHE_MAX = 200

type DetailsState = { status: 'loading' } | { status: 'done'; details: CardDetails | null }

/** Modal body: large card image, metadata, on-demand card text, prev/next. */
export function CardDetail({ plugin, metas, startIndex, registerNavigate, onOpenNote }: CardDetailProps) {
	const [index, setIndex] = useState(startIndex)
	const [detailsState, setDetailsState] = useState<DetailsState>({ status: 'loading' })
	// Images uploaded during this modal session (cardId → resource URL) —
	// metas is a snapshot, so fresh uploads are displayed from here.
	const [uploaded, setUploaded] = useState<ReadonlyMap<string, string>>(new Map())
	const [uploading, setUploading] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	// Monotonic fetch id — a slow response for a card the user already
	// navigated away from must not overwrite the current card's text.
	const fetchId = useRef(0)
	const meta = metas[index]
	const image = uploaded.get(meta.cardId) ?? meta.image

	const navigate = useCallback(
		(delta: number) => {
			setIndex((current) => Math.min(metas.length - 1, Math.max(0, current + delta)))
		},
		[metas.length],
	)

	useEffect(() => {
		registerNavigate(navigate)
	}, [registerNavigate, navigate])

	// Preload neighbor scans so arrow navigation feels instant.
	useEffect(() => {
		for (const neighbor of [index - 1, index + 1]) {
			const image = metas[neighbor]?.image
			if (image) new Image().src = image
		}
	}, [index, metas])

	useEffect(() => {
		const id = ++fetchId.current
		const cacheKey = `${plugin.activeSource().id}:${meta.cardId}`
		const cached = detailsCache.get(cacheKey)
		if (cached !== undefined) {
			setDetailsState({ status: 'done', details: cached })
			return
		}
		setDetailsState({ status: 'loading' })
		void plugin
			.activeSource()
			.getCard(meta.cardId)
			.then((card) => card?.details ?? null)
			.catch(() => null)
			.then((details) => {
				detailsCache.set(cacheKey, details)
				if (detailsCache.size > DETAILS_CACHE_MAX) {
					for (const oldest of detailsCache.keys()) {
						detailsCache.delete(oldest)
						break
					}
				}
				if (fetchId.current === id) setDetailsState({ status: 'done', details })
			})
	}, [plugin, meta.cardId])

	const metaLine = [
		meta.setName ?? meta.setCode,
		meta.number ? `#${meta.number}` : null,
		meta.rarity,
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<div className="tcgb-detail">
			<div className="tcgb-detail-main">
				<button
					className="tcgb-detail-nav"
					aria-label={t('detail.prev')}
					title={t('detail.prev')}
					disabled={index === 0}
					onClick={() => navigate(-1)}
				>
					‹
				</button>

				<div className="tcgb-detail-body">
					<div className="tcgb-detail-imgcol">
						{image ? (
							<img className="tcgb-detail-img" src={image} alt={meta.name} />
						) : (
							<>
								<div className="tcgb-detail-img tcgb-detail-img-empty tcgb-tile-img-empty" />
								<button
									className="tcgb-btn tcgb-detail-upload"
									disabled={uploading}
									onClick={() => fileInputRef.current?.click()}
								>
									{t('detail.add-image')}
								</button>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									className="tcgb-detail-file"
									onChange={(event) => {
										const file = event.target.files?.[0]
										event.target.value = ''
										if (!file) return
										setUploading(true)
										void file
											.arrayBuffer()
											.then((data) => plugin.attachCardImage(meta, data, file.name))
											.then((resourceUrl) => {
												setUploaded((current) => new Map(current).set(meta.cardId, resourceUrl))
											})
											.catch((error: unknown) => {
												new Notice(String(error))
											})
											.finally(() => {
												setUploading(false)
											})
									}}
								/>
							</>
						)}
					</div>

					<div className="tcgb-detail-info">
						<h3 className="tcgb-detail-name">{meta.name}</h3>
						{meta.nameEn && meta.nameEn !== meta.name && (
							<div className="tcgb-detail-name-en">{meta.nameEn}</div>
						)}
						{metaLine && <div className="tcgb-detail-meta">{metaLine}</div>}

						<div className="tcgb-detail-badges">
							{meta.supertype && <span className="tcgb-detail-badge">{meta.supertype}</span>}
							{(meta.legalities ?? []).map((format) => (
								<span key={format} className="tcgb-detail-badge tcgb-detail-badge-legal">
									{format}
								</span>
							))}
						</div>

						{meta.priceMarket !== null && (
							<div className="tcgb-detail-price">
								${meta.priceMarket.toFixed(2)}
								{meta.priceUpdated && (
									<span className="tcgb-detail-price-date"> · {meta.priceUpdated}</span>
								)}
							</div>
						)}

						<CardText state={detailsState} />

						<div className="tcgb-detail-actions">
							<button
								className="tcgb-btn"
								onClick={() => {
									onOpenNote(meta)
								}}
							>
								{t('detail.open-note')}
							</button>
						</div>
					</div>
				</div>

				<button
					className="tcgb-detail-nav"
					aria-label={t('detail.next')}
					title={t('detail.next')}
					disabled={index === metas.length - 1}
					onClick={() => navigate(1)}
				>
					›
				</button>
			</div>

			<div className="tcgb-detail-counter">
				{index + 1} / {metas.length}
			</div>
		</div>
	)
}

function CardText({ state }: { state: DetailsState }) {
	if (state.status === 'loading') {
		return <div className="tcgb-detail-muted">{t('detail.loading')}</div>
	}
	const details = state.details
	if (!details) return <div className="tcgb-detail-muted">{t('detail.unavailable')}</div>

	const statsLine = [
		details.hp ? `HP ${details.hp}` : null,
		details.types.length > 0 ? details.types.join(' / ') : null,
	]
		.filter(Boolean)
		.join(' · ')

	return (
		<div className="tcgb-detail-text">
			{statsLine && <div className="tcgb-detail-stats">{statsLine}</div>}
			{details.evolvesFrom && (
				<div className="tcgb-detail-muted">{t('detail.evolves-from', { name: details.evolvesFrom })}</div>
			)}

			{details.abilities.length > 0 && (
				<section className="tcgb-detail-section">
					<h4 className="tcgb-detail-section-title">{t('detail.abilities')}</h4>
					{details.abilities.map((ability) => (
						<div key={ability.name} className="tcgb-detail-entry">
							<div className="tcgb-detail-entry-head">
								<span className="tcgb-detail-entry-name">{ability.name}</span>
							</div>
							{ability.text && <p className="tcgb-detail-entry-text">{ability.text}</p>}
						</div>
					))}
				</section>
			)}

			{details.attacks.length > 0 && (
				<section className="tcgb-detail-section">
					<h4 className="tcgb-detail-section-title">{t('detail.attacks')}</h4>
					{details.attacks.map((attack) => (
						<div key={attack.name} className="tcgb-detail-entry">
							<div className="tcgb-detail-entry-head">
								{attack.cost.length > 0 && (
									<span className="tcgb-detail-cost">{attack.cost.join(' · ')}</span>
								)}
								<span className="tcgb-detail-entry-name">{attack.name}</span>
								{attack.damage && <span className="tcgb-detail-damage">{attack.damage}</span>}
							</div>
							{attack.text && <p className="tcgb-detail-entry-text">{attack.text}</p>}
						</div>
					))}
				</section>
			)}

			{details.rules.length > 0 && (
				<section className="tcgb-detail-section">
					<h4 className="tcgb-detail-section-title">{t('detail.rules')}</h4>
					{details.rules.map((rule, i) => (
						<p key={i} className="tcgb-detail-entry-text">
							{rule}
						</p>
					))}
				</section>
			)}

			{details.retreat !== null && (
				<div className="tcgb-detail-muted">
					{t('detail.retreat')}: {details.retreat}
				</div>
			)}
			{details.flavorText && <p className="tcgb-detail-flavor">{details.flavorText}</p>}
			{details.illustrator && (
				<div className="tcgb-detail-muted">{t('detail.illustrator', { name: details.illustrator })}</div>
			)}
		</div>
	)
}
