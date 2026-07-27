import { App, Notice, SuggestModal } from 'obsidian'
import { parseCardQuery } from '../domain/card-query'
import type { CardData, CardDataSource, CardSearchQuery } from '../services/card-data/card-data-source'
import { RateLimitError } from '../services/card-data/card-data-source'
import type { SetCatalog } from '../services/set-catalog'
import type { ViewMode } from '../settings'
import { t } from '../i18n'

const DEBOUNCE_MS = 250

/** Async card search with debounce: by name, or by set + number ("SVI 45"). */
export class CardSearchModal extends SuggestModal<CardData> {
	/** Session-sticky layout choice; falls back to the global default. */
	private static lastMode: ViewMode | null = null

	private searchVersion = 0
	private loadingCount = 0

	constructor(
		app: App,
		private readonly source: CardDataSource,
		private readonly catalog: SetCatalog,
		private readonly defaultMode: ViewMode,
		private readonly onChoose: (card: CardData) => void,
	) {
		super(app)
		this.setPlaceholder(t('search.placeholder'))
		this.emptyStateText = t('search.empty')
		void this.catalog.load()
	}

	onOpen(): void {
		void super.onOpen()
		this.modalEl.addClass('tcgb-search-modal')
		this.applyMode()

		const container = this.modalEl.querySelector('.prompt-input-container')
		if (container instanceof HTMLElement) {
			const toggle = container.createEl('button', {
				cls: 'tcgb-search-mode',
				attr: { 'aria-label': t('view.toggle-mode'), title: t('view.toggle-mode') },
			})
			this.syncToggleGlyph(toggle)
			toggle.addEventListener('click', (event) => {
				event.preventDefault()
				CardSearchModal.lastMode = this.currentMode() === 'list' ? 'grid' : 'list'
				this.applyMode()
				this.syncToggleGlyph(toggle)
				this.inputEl.focus()
			})
		}

		// When this modal is opened from another modal's close (the "keep
		// searching" loop), the closing modal's focus restore can steal focus
		// from our input — typing then goes nowhere. Re-focus after the dust
		// settles (same workaround as the reference plugin's quick-add modal).
		window.setTimeout(() => this.inputEl.focus(), 50)
	}

	private currentMode(): ViewMode {
		return CardSearchModal.lastMode ?? this.defaultMode
	}

	private applyMode(): void {
		this.modalEl.toggleClass('tcgb-grid-mode', this.currentMode() === 'grid')
	}

	private syncToggleGlyph(toggle: HTMLElement): void {
		toggle.setText(this.currentMode() === 'grid' ? '≣' : '▦')
	}

	/** Spinner in the prompt while a request is in flight (counted — searches overlap). */
	private setLoading(on: boolean): void {
		this.loadingCount = Math.max(0, this.loadingCount + (on ? 1 : -1))
		this.modalEl.toggleClass('tcgb-searching', this.loadingCount > 0)
	}

	async getSuggestions(query: string): Promise<CardData[]> {
		const trimmed = query.trim()
		if (trimmed.length < 2) return []

		// Debounce + stale-guard: only the latest keystroke's search may render.
		const version = ++this.searchVersion
		await delay(DEBOUNCE_MS)
		if (version !== this.searchVersion) return []

		this.setLoading(true)
		try {
			const results = await this.source.searchCards(await this.buildQuery(trimmed))
			if (version !== this.searchVersion) return []
			if (results.length > 0) return results
			// A set-code-shaped query with no hits ("Iono 185") — retry as a name.
			const fallback = await this.source.searchCards({ name: trimmed })
			return version === this.searchVersion ? fallback : []
		} catch (error) {
			if (version === this.searchVersion) {
				console.error('[TCG Binder] card search failed', error)
				new Notice(error instanceof RateLimitError ? t('search.rate-limited') : t('search.error'))
			}
			return []
		} finally {
			this.setLoading(false)
		}
	}

	renderSuggestion(card: CardData, el: HTMLElement): void {
		el.addClass('tcgb-suggestion')
		if (card.imageSmall) {
			const img = el.createEl('img', {
				cls: 'tcgb-suggestion-image',
				attr: { src: card.imageSmall, loading: 'lazy', alt: card.name },
			})
			// The TCGdex CDN serves variants inconsistently at times — fall back
			// low → high before giving up, and log the exact failing URL.
			img.addEventListener('error', () => {
				if (!img.dataset.fallback && card.imageLarge && card.imageLarge !== img.src) {
					img.dataset.fallback = '1'
					img.src = card.imageLarge
					return
				}
				console.error(`[TCG Binder] card image failed to load: ${img.src}`)
				img.replaceWith(createDiv({ cls: 'tcgb-suggestion-image tcgb-suggestion-noimg' }))
			})
		} else {
			// Placeholder keeps grid tiles aligned when a card has no scan.
			el.createDiv({ cls: 'tcgb-suggestion-image tcgb-suggestion-noimg' })
		}
		const info = el.createDiv('tcgb-suggestion-info')
		info.createDiv({ cls: 'tcgb-suggestion-name', text: card.name })
		const meta = [card.setName, `#${card.number}`, card.rarity].filter(Boolean).join(' · ')
		info.createDiv({ cls: 'tcgb-suggestion-meta', text: meta })
	}

	onChooseSuggestion(card: CardData): void {
		this.onChoose(card)
	}

	private async buildQuery(query: string): Promise<CardSearchQuery> {
		const parsed = parseCardQuery(query)
		if (parsed.setCode) {
			await this.catalog.load()
			// "Iono 185" parses as a set code — only trust codes the catalog knows.
			// The API cannot filter by set code directly, so resolve it to a set id.
			const set = this.catalog.findByCode(parsed.setCode)
			return set ? { setId: set.id, number: parsed.number } : { name: query }
		}
		if (parsed.number) return { number: parsed.number }
		return { name: query }
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms))
}
