# TCG Binder

**Track your Pokémon TCG collection, build decks and browse cards — inside your Obsidian vault, in plain Markdown you own.**

Every collection, deck and card is a regular note with frontmatter. Your data stays readable, syncable, linkable and greppable — with or without the plugin. The export other apps charge for? Here it's just... your files.

![Dashboard](docs/assets/dashboard.png)

## Why TCG Binder

| The usual pain | Here |
|---|---|
| Adding cards one by one is tedious | **Paste a list** — `4 Pikachu ex SVI 45` — and import hundreds of cards at once (TCG Live format) |
| Your collection is locked inside an app | **Plain Markdown frontmatter** — the storage format *is* the export |
| Migrating apps means retyping everything | **CSV import** from ManaBox, Collectr and TCG Collector |
| "Cost to complete this set" is a premium feature | **Free**, computed from live market prices |
| The card database is missing that obscure promo | **Write a note by hand** — any note with the right frontmatter is a valid card |
| Notes about trades and memories live elsewhere | Card notes are **real notes**: write on them, link them, see backlinks from decks and collections |

## Features

### Collections & set tracking
- Search the card database by name or `SVI 45` style set + number
- Rapid entry loop: search → variant/condition/quantity → search again
- **Set collections**: pick any set and get a full checklist (every card at qty 0, secrets included) — watch the completion bar fill as you collect
- Variant lines per card (normal / holo / reverse holo / promo) with inline editing and automatic merging
- **Playset pill** when you own 4+ copies of a card
- Set progress with per-set completion % and **cost to completion** at market prices

![Collection view](docs/assets/collection.png)

### Decks
- Import a decklist straight from Pokémon TCG Live (paste → deck note)
- Live validation: 60 cards, copy limits (basic energy exempt), **format legality** per card
- Grouped Pokémon / Trainer / Energy view with card thumbnails
- **Missing from collection**: exactly what you still need to buy, and what it costs
- Export back to TCG Live format with one click

![Deck view](docs/assets/deck.png)

### Portfolio
- Market prices (TCGplayer via TCGdex) stamped on every card note, with the snapshot date
- **Portfolio value history** chart — one snapshot per "Update prices" run, stored locally

### Your data, your vault
- Collections/decks: notes with an `entries` list in frontmatter
- Cards: one note each, created on demand — price, set, rarity, legality, image
- Backlinks between cards ↔ decks ↔ collections work natively
- No server, no account, no telemetry. Offline-first with cached set data
- **Scoped by design**: the plugin only reads and writes inside your binder folder (default `TCG Binder/`) — the rest of the vault is never touched or enumerated. Manual card notes must live inside that folder to be recognized

## Installation

Not yet in the community plugin store. Until then:

1. Download `main.js`, `manifest.json` and `styles.css` from the latest release
2. Copy them to `<your vault>/.obsidian/plugins/tcg-binder/`
3. Enable **TCG Binder** in Settings → Community plugins

A demo vault with sample data is available in [`demo-vault/`](demo-vault/).

## Quick start

1. `Ctrl/Cmd+P` → **Add cards** — search anything, add it to your first collection
2. Got an existing list? **Import card list** (TCG Live text) or **Import collection CSV** (ManaBox/Collectr/TCG Collector export)
3. Chasing a set? **Create set collection** and start ticking
4. Deck player? **Import deck**, fix what the validator flags, **Export deck** back to TCG Live

## Settings

- **Card database**: TCGdex (default — free, no key) or pokemontcg.io (needs an API key since the Scrydex acquisition)
- **Binder folder**: where collections, decks and card notes live (default `TCG Binder/`)

## Data model

```
TCG Binder/
  cards/Pikachu ex (SVI 45).md     # tcg-binder: card + set/rarity/price/legality
  collections/My collection.md     # tcg-binder: collection + entries: [{id, qty, variant, condition}]
  decks/Pikachu Rush.md            # tcg-binder: deck + format + entries: [{id, qty}]
```

The plugin only manages frontmatter — the note body is yours for trade diaries, memories and anything else.

## Development

Requires Node.js 18+.

```bash
npm install
npm run dev        # watch build
npm run build      # type-check + production bundle
npm run lint
npm run test
```

Copy or symlink `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/tcg-binder/`. An empty `.hotreload` file in that folder enables the community Hot Reload plugin.

## License

[MIT](LICENSE)

---

*Pokémon and Pokémon TCG are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc. This plugin is an independent fan project, not affiliated with or endorsed by them. Card data via [TCGdex](https://tcgdex.dev/).*
