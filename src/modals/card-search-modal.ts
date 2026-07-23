import { App, Notice, SuggestModal } from 'obsidian'
import { parseCardQuery } from '../domain/card-query'
import type { CardData, CardDataSource, CardSearchQuery } from '../services/card-data/card-data-source'
import { RateLimitError } from '../services/card-data/card-data-source'
import type { SetCatalog } from '../services/set-catalog'
import { t } from '../i18n'

const DEBOUNCE_MS = 250

/** Async card search with debounce: by name, or by set + number ("SVI 45"). */
export class CardSearchModal extends SuggestModal<CardData> {
	private searchVersion = 0

	constructor(
		app: App,
		private readonly source: CardDataSource,
		private readonly catalog: SetCatalog,
		private readonly onChoose: (card: CardData) => void,
	) {
		super(app)
		this.setPlaceholder(t('search.placeholder'))
		this.emptyStateText = t('search.empty')
		void this.catalog.load()
	}

	onOpen(): void {
		void super.onOpen()
		// When this modal is opened from another modal's close (the "keep
		// searching" loop), the closing modal's focus restore can steal focus
		// from our input — typing then goes nowhere. Re-focus after the dust
		// settles (same workaround as the reference plugin's quick-add modal).
		window.setTimeout(() => this.inputEl.focus(), 50)
	}

	async getSuggestions(query: string): Promise<CardData[]> {
		const trimmed = query.trim()
		if (trimmed.length < 2) return []

		// Debounce + stale-guard: only the latest keystroke's search may render.
		const version = ++this.searchVersion
		await delay(DEBOUNCE_MS)
		if (version !== this.searchVersion) return []

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
		}
	}

	renderSuggestion(card: CardData, el: HTMLElement): void {
		el.addClass('tcgb-suggestion')
		if (card.imageSmall) {
			el.createEl('img', {
				cls: 'tcgb-suggestion-image',
				attr: { src: card.imageSmall, loading: 'lazy', alt: card.name },
			})
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
