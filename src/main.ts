import { Notice, Plugin, TFile, normalizePath } from 'obsidian'
import { BINDER_VIEW_TYPE, BinderView } from './views/binder-view'
import { DEFAULT_SETTINGS, TcgBinderSettings, TcgBinderSettingTab } from './settings'
import { BinderStore } from './services/binder-store'
import { CardNotes } from './services/card-notes'
import { CollectionStore } from './services/collection-store'
import { DeckStore } from './services/deck-store'
import { SetCatalog } from './services/set-catalog'
import { SetCardsCache } from './services/set-cards-cache'
import { PortfolioHistory } from './services/portfolio-history'
import { PokemonTcgSource } from './services/card-data/pokemon-tcg-source'
import { TcgdexSource } from './services/card-data/tcgdex-source'
import type { CardData, CardDataSource } from './services/card-data/card-data-source'
import { RateLimitError } from './services/card-data/card-data-source'
import { CardSearchModal } from './modals/card-search-modal'
import { AddCardModal, previewFromCardData } from './modals/add-card-modal'
import type { CardMeta } from './services/card-notes'
import { ensureFolder } from './utils/vault'
import { sanitizeFileName } from './utils/file-name'
import { AddToDeckModal } from './modals/add-to-deck-modal'
import { ImportListModal, ImportSummary } from './modals/import-list-modal'
import { ImportDeckModal } from './modals/import-deck-modal'
import { FilePickerModal } from './modals/file-picker-modal'
import { SetPickerModal } from './modals/set-picker-modal'
import { QuickAddModal } from './modals/quick-add-modal'
import type { SetInfo } from './services/card-data/card-data-source'
import { pokemonTcgIoImageCandidates } from './services/card-data/fallback-images'
import { urlExists } from './services/card-data/http'
import { CardListLine, parseCardList, serializeCardList } from './domain/card-list'
import { functionalKey } from './domain/text-match'
import { parseCsv } from './domain/csv'
import { CsvCardRow, mapCsvRows } from './domain/csv-import'
import { t } from './i18n'

export default class TcgBinderPlugin extends Plugin {
	settings: TcgBinderSettings = DEFAULT_SETTINGS
	store!: BinderStore
	cardNotes!: CardNotes
	collections!: CollectionStore
	decks!: DeckStore
	setCatalog!: SetCatalog
	setCards!: SetCardsCache
	portfolio!: PortfolioHistory
	private tcgdexSource!: TcgdexSource
	private pokemonIoSource!: PokemonTcgSource

	async onload(): Promise<void> {
		await this.loadSettings()

		this.store = new BinderStore(this.app, () => this.settings.rootFolder)
		this.cardNotes = new CardNotes(this.app, () => this.settings.rootFolder)
		this.collections = new CollectionStore(this.app)
		this.decks = new DeckStore(this.app)
		this.tcgdexSource = new TcgdexSource(() => this.settings.cardLanguage)
		this.pokemonIoSource = new PokemonTcgSource(() => this.settings.pokemonTcgApiKey)
		this.setCatalog = new SetCatalog(
			this.app,
			() => this.activeSource(),
			() => normalizePath(`${this.manifest.dir ?? '.'}/sets-cache-${this.activeSource().id}.json`),
		)
		this.setCards = new SetCardsCache(this.app, () => this.activeSource(), () => this.manifest.dir ?? '.')
		this.portfolio = new PortfolioHistory(this.app, () =>
			normalizePath(`${this.manifest.dir ?? '.'}/portfolio-history.json`),
		)

		this.registerView(BINDER_VIEW_TYPE, (leaf) => new BinderView(leaf, this))

		this.addRibbonIcon('layers', t('view.title'), () => {
			void this.activateBinderView()
		})

		this.addCommand({
			id: 'open-binder',
			name: t('command.open-binder'),
			callback: () => {
				void this.activateBinderView()
			},
		})
		this.addCommand({
			id: 'search-cards',
			name: t('command.search-cards'),
			callback: () => {
				this.openCardSearch()
			},
		})
		this.addCommand({
			id: 'add-cards',
			name: t('command.add-cards'),
			callback: () => {
				void this.openAddCards()
			},
		})
		this.addCommand({
			id: 'quick-add-by-set',
			name: t('command.quick-add'),
			callback: () => {
				void this.openQuickAddBySet()
			},
		})
		this.addCommand({
			id: 'import-card-list',
			name: t('command.import-card-list'),
			callback: () => {
				void this.openImportList()
			},
		})
		this.addCommand({
			id: 'import-csv',
			name: t('command.import-csv'),
			callback: () => {
				void this.openImportCsv()
			},
		})
		this.addCommand({
			id: 'update-prices',
			name: t('command.update-prices'),
			callback: () => {
				void this.updatePricesAndSnapshot()
			},
		})
		this.addCommand({
			id: 'fetch-missing-images',
			name: t('command.fetch-images'),
			callback: () => {
				void this.fetchMissingImages()
			},
		})
		this.addCommand({
			id: 'add-cards-to-deck',
			name: t('command.add-cards-to-deck'),
			callback: () => {
				void this.openAddToDeck()
			},
		})
		this.addCommand({
			id: 'import-deck',
			name: t('command.import-deck'),
			callback: () => {
				this.openImportDeck()
			},
		})
		this.addCommand({
			id: 'export-deck',
			name: t('command.export-deck'),
			callback: () => {
				this.openExportDeck()
			},
		})
		this.addCommand({
			id: 'create-set-collection',
			name: t('command.create-set-collection'),
			callback: () => {
				void this.openCreateSetCollection()
			},
		})
		this.addCommand({
			id: 'create-wishlist',
			name: t('command.create-wishlist'),
			callback: () => {
				void this.createWishlist()
			},
		})
		this.addCommand({
			id: 'create-collection',
			name: t('command.create-collection'),
			callback: () => {
				void this.createCollection()
			},
		})
		this.addCommand({
			id: 'create-deck',
			name: t('command.create-deck'),
			callback: () => {
				void this.createDeck()
			},
		})

		this.addSettingTab(new TcgBinderSettingTab(this.app, this))

		// Version marker — makes stale-bundle situations obvious when debugging.
		// (console.debug is hidden unless the console is set to Verbose.)
		console.debug(`[TCG Binder] v${this.manifest.version} loaded — card source: ${this.activeSource().id}`)
	}

	onunload(): void {
		// Views, commands and events registered via this.register* are cleaned up by Obsidian.
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<TcgBinderSettings> | null
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data)
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings)
	}

	async activateBinderView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(BINDER_VIEW_TYPE)[0]
		if (existing) {
			await this.app.workspace.revealLeaf(existing)
			return
		}
		await this.app.workspace.getLeaf(true).setViewState({ type: BINDER_VIEW_TYPE, active: true })
	}

	/** The card database selected in settings. */
	activeSource(): CardDataSource {
		return this.settings.dataSource === 'pokemontcg-io' ? this.pokemonIoSource : this.tcgdexSource
	}

	/** Hydrates partial search results (e.g. TCGdex resumes) before persisting a note. */
	private async ensureHydratedCardNote(card: CardData): Promise<TFile> {
		let full = card
		if (!card.supertype || card.marketPrice === null) {
			full = (await this.activeSource().getCard(card.id)) ?? card
		}
		return this.cardNotes.ensureCardNote(full)
	}

	openCardSearch(): void {
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, this.settings.defaultViewMode, (card) => {
			void this.openCardNote(card)
		}).open()
	}

	private async openCardNote(card: CardData): Promise<void> {
		try {
			const file = await this.ensureHydratedCardNote(card)
			await this.app.workspace.getLeaf(true).openFile(file)
		} catch (error) {
			new Notice(String(error))
		}
	}

	/** Existing collections, creating the default one on first use. */
	private async ensureCollections(): Promise<TFile[]> {
		const existing = this.store.listFiles('collection')
		if (existing.length > 0) return existing
		return [await this.store.createCollection(t('default.new-collection-name'))]
	}

	async openAddCards(): Promise<void> {
		const collections = await this.ensureCollections()
		this.runAddCardsLoop(collections)
	}

	/** Search → configure → add, looping while "keep searching" is on. */
	private runAddCardsLoop(collections: TFile[]): void {
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, this.settings.defaultViewMode, (card) => {
			new AddCardModal(this.app, previewFromCardData(card), collections, (choice) => {
				void (async () => {
					try {
						const cardFile = await this.ensureHydratedCardNote(card)
						await this.collections.addEntry(
							choice.collection,
							card.id,
							`[[${cardFile.basename}]]`,
							choice.quantity,
							choice.variant,
							choice.condition,
						)
						new Notice(t('notice.card-added', { name: card.name }))
					} catch (error) {
						new Notice(String(error))
					}
					if (choice.keepSearching) {
						// Let the previous modal finish closing before reopening the
						// search — opening mid-close breaks focus/keyboard scope.
						window.setTimeout(() => this.runAddCardsLoop(collections), 80)
					}
				})()
			}).open()
		}).open()
	}

	/** Rapid physical-card entry: pick a set once, then add cards by collector number. */
	async openQuickAddBySet(): Promise<void> {
		const collections = await this.ensureCollections()
		const sets = [...(await this.setCatalog.load())].sort((a, b) =>
			b.releaseDate.localeCompare(a.releaseDate),
		)
		if (sets.length === 0) {
			new Notice(t('search.error'))
			return
		}
		new SetPickerModal(this.app, sets, (set) => {
			void this.startQuickAdd(set, collections)
		}).open()
	}

	private async startQuickAdd(set: SetInfo, collections: TFile[]): Promise<void> {
		const progress = new Notice(t('setcol.running'), 0)
		let cards: CardData[] = []
		try {
			cards = await this.setCards.getSetCards(set.id)
		} catch (error) {
			new Notice(error instanceof RateLimitError ? t('search.rate-limited') : String(error))
			return
		} finally {
			progress.hide()
		}
		if (cards.length === 0) {
			new Notice(t('search.error'))
			return
		}
		// Let the set picker finish closing before opening the entry modal —
		// opening mid-close breaks focus/keyboard scope.
		window.setTimeout(() => {
			new QuickAddModal(this.app, set, cards, collections, {
				add: async (card, collection, qty, variant, condition) => {
					const cardFile = await this.cardNotes.ensureCardNote(card)
					await this.collections.addEntry(
						collection,
						card.id,
						`[[${cardFile.basename}]]`,
						qty,
						variant,
						condition,
					)
				},
				switchSet: () => {
					void this.openQuickAddBySet()
				},
			}).open()
		}, 80)
	}

	async openImportList(): Promise<void> {
		const collections = await this.ensureCollections()
		new ImportListModal(
			this.app,
			collections,
			{ title: t('import.title'), desc: t('import.desc'), placeholder: t('import.placeholder') },
			(collection, text) => this.runImport(collection, text),
		).open()
	}

	async openImportCsv(): Promise<void> {
		const collections = await this.ensureCollections()
		new ImportListModal(
			this.app,
			collections,
			{
				title: t('import-csv.title'),
				desc: t('import-csv.desc'),
				placeholder: t('import-csv.placeholder'),
			},
			(collection, text) => this.runCsvImport(collection, text),
		).open()
	}

	private async runCsvImport(collection: TFile, text: string): Promise<ImportSummary> {
		const { rows, errors } = mapCsvRows(parseCsv(text))
		const failed = errors.map((e) => e.text)
		await this.setCatalog.load()

		// Group rows by resolved set so each set is fetched once, not per card.
		const bySet = new Map<string, CsvCardRow[]>()
		for (const row of rows) {
			const set =
				(row.setCode ? this.setCatalog.findByCode(row.setCode) : null) ??
				(row.setName ? this.setCatalog.findByName(row.setName) : null)
			if (!set) {
				failed.push(csvRowLabel(row))
				continue
			}
			const list = bySet.get(set.id) ?? []
			list.push(row)
			bySet.set(set.id, list)
		}

		const source = this.activeSource()
		const totalRows = [...bySet.values()].reduce((sum, list) => sum + list.length, 0)
		const progress = new Notice(t('import.running'), 0)
		let added = 0
		let done = 0
		try {
			for (const [setId, list] of bySet) {
				const cards = await this.setCards.getSetCards(setId).catch((error: unknown) => {
					console.error(`[TCG Binder] failed to fetch set ${setId}`, error)
					return [] as CardData[]
				})
				for (const row of list) {
					done++
					progress.setMessage(`${t('import.running')} ${done}/${totalRows}`)
					try {
						let card = row.number ? this.setCards.findByNumber(cards, row.number) : undefined
						card ??= cards.find((c) => c.name.toLowerCase() === row.name.toLowerCase())
						card ??= (await source.searchCards({ name: row.name, setId, pageSize: 1 }))[0]
						if (!card) {
							failed.push(csvRowLabel(row))
							continue
						}
						const cardFile = await this.ensureHydratedCardNote(card)
						await this.collections.addEntry(
							collection,
							card.id,
							`[[${cardFile.basename}]]`,
							row.quantity,
							row.variant,
							row.condition,
						)
						added += row.quantity
					} catch (error) {
						if (error instanceof RateLimitError) throw error
						console.error(`[TCG Binder] failed to import "${csvRowLabel(row)}"`, error)
						failed.push(csvRowLabel(row))
					}
				}
			}
		} finally {
			progress.hide()
		}
		return { added, failed }
	}

	/** Refreshes owned cards' prices from the API and appends a portfolio snapshot. */
	async updatePricesAndSnapshot(): Promise<void> {
		const owned = new Map<string, number>()
		for (const collection of this.store.listFiles('collection')) {
			if (this.store.getRole(collection) === 'wishlist') continue
			for (const entry of this.collections.readEntries(collection)) {
				owned.set(entry.id, (owned.get(entry.id) ?? 0) + entry.qty)
			}
		}
		if (owned.size === 0) {
			new Notice(t('prices.empty'))
			return
		}

		const index = this.cardNotes.buildIndex()
		const bySet = new Map<string, string[]>()
		for (const id of owned.keys()) {
			const setId = index.get(id)?.setId
			if (!setId) continue
			const list = bySet.get(setId) ?? []
			list.push(id)
			bySet.set(setId, list)
		}

		const prices = new Map<string, number>()
		const progress = new Notice(t('prices.updating'), 0)
		try {
			let i = 0
			for (const [setId, ids] of bySet) {
				i++
				progress.setMessage(`${t('prices.updating')} ${i}/${bySet.size}`)
				const cards = await this.setCards.getSetCards(setId, true).catch((error: unknown) => {
					console.error(`[TCG Binder] failed to refresh set ${setId}`, error)
					return [] as CardData[]
				})
				for (const id of ids) {
					const fresh = cards.find((card) => card.id === id)
					const meta = index.get(id)
					if (fresh?.marketPrice != null && meta) {
						await this.cardNotes.updatePrice(meta.file, fresh.marketPrice)
						prices.set(id, fresh.marketPrice)
					} else if (meta?.priceMarket != null) {
						prices.set(id, meta.priceMarket) // API miss — keep the last known price
					}
				}
			}
		} finally {
			progress.hide()
		}

		let total = 0
		for (const [id, qty] of owned) total += qty * (prices.get(id) ?? 0)
		await this.portfolio.append({
			date: new Date().toISOString().slice(0, 10),
			value: Math.round(total * 100) / 100,
		})
		new Notice(t('prices.done', { value: `$${total.toFixed(2)}` }))
	}

	/** Resolves parsed list lines to cards via set catalog + API; misses go to `failed`. */
	private async resolveCardLines(
		entries: CardListLine[],
		failed: string[],
	): Promise<{ card: CardData; quantity: number }[]> {
		const source = this.activeSource()
		await this.setCatalog.load()

		const resolved: { card: CardData; quantity: number }[] = []
		const progress = new Notice(t('import.running'), 0)
		try {
			for (const [i, entry] of entries.entries()) {
				progress.setMessage(`${t('import.running')} ${i + 1}/${entries.length}`)
				const line = `${entry.quantity} ${entry.name} ${entry.setCode} ${entry.number}`
				const set = this.setCatalog.findByCode(entry.setCode)
				if (!set) {
					failed.push(line)
					continue
				}
				try {
					const results = await source.searchCards({ setId: set.id, number: entry.number, pageSize: 1 })
					if (results[0]) {
						resolved.push({ card: results[0], quantity: entry.quantity })
					} else {
						failed.push(line)
					}
				} catch (error) {
					// One bad request must not abort the whole import — except a
					// rate limit, where continuing would only dig the hole deeper.
					if (error instanceof RateLimitError) throw error
					console.error(`[TCG Binder] failed to resolve "${line}"`, error)
					failed.push(line)
				}
			}
		} finally {
			progress.hide()
		}
		return resolved
	}

	private async runImport(collection: TFile, text: string): Promise<ImportSummary> {
		const { entries, errors } = parseCardList(text)
		const failed = errors.map((e) => e.text)
		let added = 0
		for (const { card, quantity } of await this.resolveCardLines(entries, failed)) {
			const cardFile = await this.ensureHydratedCardNote(card)
			await this.collections.addEntry(
				collection,
				card.id,
				`[[${cardFile.basename}]]`,
				quantity,
				'normal',
				'NM',
			)
			added += quantity
		}
		return { added, failed }
	}

	/**
	 * Saves a user-provided image for a card (API gap, manual card) into the
	 * binder folder and stamps it on the note. When replacing an earlier
	 * upload (`replacePath`), the body embed is swapped and the old file is
	 * trashed — only after the new one is safely written. Returns the stored
	 * vault path and the app:// resource URL for immediate display.
	 */
	async attachCardImage(
		meta: CardMeta,
		data: ArrayBuffer,
		fileName: string,
		replacePath: string | null,
	): Promise<{ path: string; resourceUrl: string }> {
		const ALLOWED = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']
		const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
		if (!ALLOWED.includes(ext)) throw new Error(t('detail.image-invalid'))

		const folder = normalizePath(`${this.settings.rootFolder}/cards/images`)
		await ensureFolder(this.app, folder)
		const base = sanitizeFileName(`${meta.name} ${meta.cardId}`)
		let path = normalizePath(`${folder}/${base}.${ext}`)
		for (let suffix = 2; this.app.vault.getAbstractFileByPath(path); suffix++) {
			path = normalizePath(`${folder}/${base} ${suffix}.${ext}`)
		}
		const created = await this.app.vault.createBinary(path, data)
		await this.cardNotes.setImage(meta.file, created.path, meta.name, replacePath ?? undefined)
		if (replacePath) {
			const previous = this.app.vault.getFileByPath(replacePath)
			// Trash (not delete) — respects the user's "deleted files" setting.
			if (previous) await this.app.fileManager.trashFile(previous)
		}
		return { path: created.path, resourceUrl: this.app.vault.adapter.getResourcePath(created.path) }
	}

	/** Cards already checked for reprint legality this session — misses included. */
	private readonly reprintChecked = new Set<string>()

	/**
	 * Reprint rule via the card database: for cards whose known printings are
	 * not legal in `format`, searches same-name printings (newest first) and
	 * stamps `legal-by-reprint` on the note when a legal one exists. Notes
	 * changing retriggers validation; misses are not retried this session.
	 */
	async checkReprintLegalities(metas: CardMeta[], format: string): Promise<void> {
		const source = this.activeSource()
		for (const meta of metas) {
			if (this.reprintChecked.has(meta.cardId)) continue
			this.reprintChecked.add(meta.cardId)
			const searchName = meta.nameEn ?? meta.name
			const target = searchName.toLowerCase()
			try {
				const results = await source.searchCards({ name: searchName, pageSize: 40 })
				// Newest printings first (both sources sort by release desc) —
				// the current reprint is what proves legality, so cap the
				// hydration cost at a handful of candidates.
				for (const candidate of results.slice(0, 8)) {
					if (candidate.id === meta.cardId) continue
					const full = candidate.legalities.length > 0 ? candidate : await source.getCard(candidate.id)
					if (!full) continue
					const candidateName = (full.nameEn ?? full.name).toLowerCase()
					if (candidateName !== target) continue
					if (full.legalities.includes(format)) {
						await this.cardNotes.setReprintLegalities(meta.file, full.legalities)
						break
					}
				}
			} catch (error) {
				if (error instanceof RateLimitError) return
				console.error(`[TCG Binder] reprint legality check failed for ${meta.cardId}`, error)
			}
		}
	}

	/**
	 * Adds an already-known card (existing note) to a collection — used by the
	 * deck view's "missing from collection" list after the cards were bought.
	 */
	async openAddOwnedCard(meta: CardMeta, link: string, initialQuantity: number): Promise<void> {
		const collections = await this.ensureCollections()
		const preview = {
			name: meta.name,
			image: meta.image,
			metaLine: [meta.setName ?? meta.setCode, meta.number ? `#${meta.number}` : null, meta.rarity]
				.filter(Boolean)
				.join(' · '),
		}
		new AddCardModal(
			this.app,
			preview,
			collections,
			(choice) => {
				void (async () => {
					try {
						await this.collections.addEntry(
							choice.collection,
							meta.cardId,
							link,
							choice.quantity,
							choice.variant,
							choice.condition,
						)
						new Notice(t('notice.card-added', { name: meta.name }))
					} catch (error) {
						new Notice(String(error))
					}
				})()
			},
			{ initialQuantity, showKeepSearching: false },
		).open()
	}

	async openAddToDeck(): Promise<void> {
		let decks = this.store.listFiles('deck')
		if (decks.length === 0) {
			decks = [await this.store.createDeck(t('default.new-deck-name'))]
		}
		this.runAddToDeckLoop(decks)
	}

	/** Search → quantity → add to deck, looping while "keep searching" is on. */
	runAddToDeckLoop(decks: TFile[]): void {
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, this.settings.defaultViewMode, (card) => {
			new AddToDeckModal(this.app, card, decks, (choice) => {
				void (async () => {
					try {
						const cardFile = await this.ensureHydratedCardNote(card)
						await this.decks.addEntry(choice.deck, card.id, `[[${cardFile.basename}]]`, choice.quantity)
						new Notice(t('notice.card-added', { name: card.name }))
					} catch (error) {
						new Notice(String(error))
					}
					if (choice.keepSearching) {
						window.setTimeout(() => this.runAddToDeckLoop(decks), 80)
					}
				})()
			}).open()
		}).open()
	}

	openImportDeck(): void {
		new ImportDeckModal(this.app, (name, text) => this.runDeckImport(name, text)).open()
	}

	private async runDeckImport(name: string, text: string): Promise<ImportSummary> {
		const { entries, errors } = parseCardList(text)
		const failed = errors.map((e) => e.text)
		const resolved = await this.resolveCardLines(entries, failed)

		const deck = await this.store.createDeck(name || t('default.new-deck-name'))
		let added = 0
		const deckLines: { id: string; link: string; qty: number }[] = []
		for (const { card, quantity } of resolved) {
			const cardFile = await this.ensureHydratedCardNote(card)
			await this.decks.addEntry(deck, card.id, `[[${cardFile.basename}]]`, quantity)
			deckLines.push({ id: card.id, link: `[[${cardFile.basename}]]`, qty: quantity })
			added += quantity
		}
		new Notice(t('notice.deck-created'))
		await this.wishlistMissingFromDeck(deck, deckLines)
		return { added, failed }
	}

	/**
	 * Copies available across every non-wishlist collection, keyed by
	 * functional card name. With "reserve deck copies" on, quantities used by
	 * decks (other than `excludeDeck`) are subtracted — may go negative.
	 */
	private ownedByName(index: Map<string, CardMeta>, excludeDeck?: TFile): Map<string, number> {
		const byName = new Map<string, number>()
		for (const collection of this.store.listFiles('collection')) {
			if (this.store.getRole(collection) === 'wishlist') continue
			for (const entry of this.collections.readEntries(collection)) {
				const meta = index.get(entry.id)
				const key = functionalKey(meta?.nameEn ?? null, meta?.name ?? null, entry.id)
				byName.set(key, (byName.get(key) ?? 0) + entry.qty)
			}
		}
		if (this.settings.reserveDeckCopies) {
			for (const deck of this.store.listFiles('deck')) {
				if (excludeDeck && deck.path === excludeDeck.path) continue
				for (const entry of this.decks.readEntries(deck)) {
					const meta = index.get(entry.id)
					const key = functionalKey(meta?.nameEn ?? null, meta?.name ?? null, entry.id)
					byName.set(key, (byName.get(key) ?? 0) - entry.qty)
				}
			}
		}
		return byName
	}

	/** After a deck import: whatever the collections can't cover goes to the wishlist. */
	private async wishlistMissingFromDeck(
		deck: TFile,
		deckLines: { id: string; link: string; qty: number }[],
	): Promise<void> {
		const index = this.cardNotes.buildIndex()
		const owned = this.ownedByName(index, deck)
		// Deck lines of the same functional card share one owned pool.
		const needed = new Map<string, { id: string; link: string; qty: number }>()
		for (const line of deckLines) {
			const meta = index.get(line.id)
			const key = functionalKey(meta?.nameEn ?? null, meta?.name ?? null, line.id)
			const current = needed.get(key)
			if (current) current.qty += line.qty
			else needed.set(key, { ...line })
		}
		const missing = [...needed.entries()]
			// Reserved copies can drive availability negative — clamp so one
			// deck's missing count never exceeds what it actually needs.
			.map(([key, line]) => ({ ...line, qty: line.qty - Math.max(0, owned.get(key) ?? 0) }))
			.filter((line) => line.qty > 0)
		const count = await this.addMissingToWishlist(missing)
		if (count > 0) new Notice(t('wishlist.added', { count }))
	}

	/**
	 * Adds missing cards (quantities already net of owned copies) to the
	 * wishlist, creating it on first use. Idempotent: only tops the wishlist
	 * up to the needed quantity, so re-running never inflates it.
	 */
	async addMissingToWishlist(items: { id: string; link: string; qty: number }[]): Promise<number> {
		if (items.length === 0) return 0
		let wishlist = this.store.listFiles('collection').find(
			(file) => this.store.getRole(file) === 'wishlist',
		)
		wishlist ??= await this.store.createCollection(t('default.new-wishlist-name'), 'pokemon', 'wishlist')

		const wishlisted = new Map<string, number>()
		for (const entry of this.collections.readEntries(wishlist)) {
			wishlisted.set(entry.id, (wishlisted.get(entry.id) ?? 0) + entry.qty)
		}

		let added = 0
		for (const item of items) {
			const delta = item.qty - (wishlisted.get(item.id) ?? 0)
			if (delta <= 0) continue
			await this.collections.addEntry(wishlist, item.id, item.link, delta, 'normal', 'NM')
			added += delta
		}
		return added
	}

	openExportDeck(): void {
		const decks = this.store.listFiles('deck')
		if (decks.length === 0) {
			new Notice(t('notice.no-decks'))
			return
		}
		if (decks.length === 1) {
			void this.exportDeck(decks[0])
			return
		}
		new FilePickerModal(this.app, decks, t('picker.deck'), (deck) => {
			void this.exportDeck(deck)
		}).open()
	}

	/** Copies the deck to the clipboard in the TCG Live text format. */
	async exportDeck(file: TFile): Promise<void> {
		const index = this.cardNotes.buildIndex()
		const text = serializeCardList(
			this.decks.readEntries(file).map((entry) => {
				const meta = index.get(entry.id)
				return {
					quantity: entry.qty,
					name: meta?.name ?? entry.id,
					setCode: meta?.setCode ?? null,
					number: meta?.number ?? null,
					supertype: meta?.supertype ?? null,
				}
			}),
		)
		await navigator.clipboard.writeText(text)
		new Notice(t('notice.deck-copied'))
	}

	/** Set-tracking collection: every card of a chosen set as a qty-0 checklist. */
	async openCreateSetCollection(): Promise<void> {
		const sets = [...(await this.setCatalog.load())].sort((a, b) =>
			b.releaseDate.localeCompare(a.releaseDate),
		)
		if (sets.length === 0) {
			new Notice(t('search.error'))
			return
		}
		new SetPickerModal(this.app, sets, (set) => {
			void this.createSetCollection(set)
		}).open()
	}

	private async createSetCollection(set: SetInfo): Promise<void> {
		const progress = new Notice(t('setcol.running'), 0)
		try {
			const cards = await this.setCards.getSetCards(set.id)
			if (cards.length === 0) {
				new Notice(t('search.error'))
				return
			}
			const files = await this.cardNotes.ensureCardNotes(cards, (done, total) => {
				progress.setMessage(`${t('setcol.running')} ${done}/${total}`)
			})
			const collection = await this.store.createCollection(set.name, 'pokemon', undefined, {
				'set-id': set.id,
			})
			await this.collections.setEntries(
				collection,
				cards.map((card, i) => ({
					id: card.id,
					link: `[[${files[i].basename}]]`,
					qty: 0,
					variant: 'normal' as const,
					condition: 'NM' as const,
					added: null,
				})),
			)
			new Notice(t('notice.set-collection-created', { name: set.name, count: cards.length }))
			await this.activateBinderView()
		} catch (error) {
			new Notice(String(error))
		} finally {
			progress.hide()
		}
	}

	/** Backfills images on card notes that have none (e.g. scans published later). */
	async fetchMissingImages(): Promise<void> {
		const missing = [...this.cardNotes.buildIndex().values()].filter((meta) => !meta.image)
		if (missing.length === 0) {
			new Notice(t('images.none-missing'))
			return
		}

		const source = this.activeSource()
		const progress = new Notice(t('images.fetching'), 0)
		let updated = 0
		try {
			for (const [i, meta] of missing.entries()) {
				progress.setMessage(`${t('images.fetching')} ${i + 1}/${missing.length}`)
				try {
					const card = await source.getCard(meta.cardId)
					let image = card?.imageLarge ?? null
					if (!image && meta.setId && meta.number) {
						// TCGdex has no scan — probe the pokemontcg.io static CDN.
						for (const candidate of pokemonTcgIoImageCandidates(meta.setId, meta.number)) {
							if (await urlExists(candidate)) {
								image = candidate
								break
							}
						}
					}
					if (image) {
						await this.cardNotes.setImage(meta.file, image, meta.name)
						updated++
					}
				} catch (error) {
					if (error instanceof RateLimitError) throw error
					console.error(`[TCG Binder] image fetch failed for ${meta.cardId}`, error)
				}
			}
		} catch (error) {
			new Notice(error instanceof RateLimitError ? t('search.rate-limited') : String(error))
		} finally {
			progress.hide()
		}
		new Notice(t('images.done', { updated, missing: missing.length - updated }))
		await this.backfillCanonicalNames()
	}

	/** Stamps `name-en` on localized notes that predate the field — one request per set. */
	private async backfillCanonicalNames(): Promise<void> {
		const source = this.activeSource()
		if (!source.getCanonicalNames) return
		const pending = [...this.cardNotes.buildIndex().values()].filter(
			(meta) => !meta.nameEn && meta.setId && meta.number,
		)
		if (pending.length === 0) return

		const bySet = new Map<string, typeof pending>()
		for (const meta of pending) {
			const list = bySet.get(meta.setId as string) ?? []
			list.push(meta)
			bySet.set(meta.setId as string, list)
		}

		let stamped = 0
		for (const [setId, metas] of bySet) {
			try {
				const names = await source.getCanonicalNames(setId)
				for (const meta of metas) {
					const nameEn = names.get(meta.number as string)
					if (nameEn && nameEn !== meta.name) {
						await this.cardNotes.setNameEn(meta.file, nameEn)
						stamped++
					}
				}
			} catch (error) {
				console.error(`[TCG Binder] canonical-name backfill failed for set ${setId}`, error)
			}
		}
		if (stamped > 0) console.debug(`[TCG Binder] stamped name-en on ${stamped} notes`)
	}

	private async createWishlist(): Promise<void> {
		try {
			const file = await this.store.createCollection(t('default.new-wishlist-name'), 'pokemon', 'wishlist')
			new Notice(t('notice.collection-created'))
			await this.app.workspace.getLeaf(true).openFile(file)
		} catch (error) {
			new Notice(String(error))
		}
	}

	private async createCollection(): Promise<void> {
		try {
			const file = await this.store.createCollection(t('default.new-collection-name'))
			new Notice(t('notice.collection-created'))
			await this.app.workspace.getLeaf(true).openFile(file)
		} catch (error) {
			new Notice(String(error))
		}
	}

	private async createDeck(): Promise<void> {
		try {
			const file = await this.store.createDeck(t('default.new-deck-name'))
			new Notice(t('notice.deck-created'))
			await this.app.workspace.getLeaf(true).openFile(file)
		} catch (error) {
			new Notice(String(error))
		}
	}
}

function csvRowLabel(row: CsvCardRow): string {
	return [row.quantity, row.name, row.setCode ?? row.setName, row.number]
		.filter((part) => part !== null && part !== undefined)
		.join(' ')
}
