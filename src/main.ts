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
import { AddCardModal } from './modals/add-card-modal'
import { AddToDeckModal } from './modals/add-to-deck-modal'
import { ImportListModal, ImportSummary } from './modals/import-list-modal'
import { ImportDeckModal } from './modals/import-deck-modal'
import { FilePickerModal } from './modals/file-picker-modal'
import { SetPickerModal } from './modals/set-picker-modal'
import type { SetInfo } from './services/card-data/card-data-source'
import { CardListLine, parseCardList, serializeCardList } from './domain/card-list'
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
		this.tcgdexSource = new TcgdexSource()
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
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, (card) => {
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
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, (card) => {
			new AddCardModal(this.app, card, collections, (choice) => {
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

	async openAddToDeck(): Promise<void> {
		let decks = this.store.listFiles('deck')
		if (decks.length === 0) {
			decks = [await this.store.createDeck(t('default.new-deck-name'))]
		}
		this.runAddToDeckLoop(decks)
	}

	/** Search → quantity → add to deck, looping while "keep searching" is on. */
	runAddToDeckLoop(decks: TFile[]): void {
		new CardSearchModal(this.app, this.activeSource(), this.setCatalog, (card) => {
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
		for (const { card, quantity } of resolved) {
			const cardFile = await this.ensureHydratedCardNote(card)
			await this.decks.addEntry(deck, card.id, `[[${cardFile.basename}]]`, quantity)
			added += quantity
		}
		new Notice(t('notice.deck-created'))
		return { added, failed }
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
