# TCG Binder — Plano de produto

> Derivado de `docs/product-research.md` (2026-07-22). Atualizar este arquivo quando o roadmap mudar.

## Visão

O único gerenciador de Pokémon TCG onde **os dados são do usuário**: coleções, decks e cartas como Markdown legível dentro do vault, com links e notas nativas do Obsidian. Os concorrentes cobram pelo export dos seus próprios dados; aqui o export É o formato de armazenamento.

## Usuários-alvo

1. **Colecionador organizado** — quer saber o que tem, o que falta por set e quanto vale. Hoje usa TCG Collector/Collectr e sofre com bulk entry e paywall de export.
2. **Jogador competitivo casual** — monta decks, valida formato, transfere para o TCG Live e quer saber o que falta comprar cruzando com a coleção.
3. **Usuário de Obsidian que já anota tudo** — quer trades, memórias e decks no mesmo grafo que o resto da vida.

## Posicionamento

- **Contra apps mobile (Dex/Collectr):** não competimos em scanner de câmera. Competimos em posse dos dados, bulk entry por texto e integração com notas.
- **Contra web checklists (TCG Collector):** mesma profundidade de variantes/progresso, sem servidor, sem premium para condição/quantidade.
- **Formatos abertos como estratégia de aquisição:** import de CSV (ManaBox/Collectr/TCG Collector) e do texto do TCG Live traz o usuário com a coleção junto.

## Roadmap priorizado

Ordem de construção pensada para: cada fase entrega valor usável sozinha; a fundação de dados vem antes das views; os diferenciais vêm depois dos table stakes.

### Fase 1 — Fundação: cartas e busca (v0.1)

O alicerce de tudo: sem busca de cartas não existe coleção nem deck.

- [x] `CardSearchModal` (SuggestModal async c/ debounce): busca por nome ou "SVI 45" via `PokemonTcgSource`, com imagem no resultado. *Nota: a API 500a em `set.ptcgoCode` — códigos de set são resolvidos para `set.id` via `SetCatalog.findByCode`.*
- [x] Cache local do catálogo de sets (`SetCatalog` → JSON no dir do plugin, TTL 7 dias, stale cache como fallback offline)
- [x] Nota de carta (`tcg-binder: card`): criada sob demanda (`CardNotes.ensureCardNote`); frontmatter com card-id, set, número, raridade, supertype, preço de mercado + data, imagem
- [x] Carta manual: qualquer nota com o frontmatter certo é uma carta válida (resolve base incompleta, dor nº 4 da pesquisa)

### Fase 2 — Coleção (v0.2–0.3) — table stakes

- [x] Adicionar carta à coleção pelo modal (`AddCardModal`): quantidade, variante, condição, com defaults sticky da sessão e loop "keep searching" para entrada rápida
- [x] **Bulk entry por texto** (`ImportListModal` + `parseCardList`): cola lista no formato TCG Live (aceita headers de seção, prefixo `*` do RK9, sufixo `x`); linhas não resolvidas são reportadas — nossa resposta à dor nº 1
- [x] View de coleção (`CollectionView`): filtros por set/variante/condição + busca, tiles de totais, valor de mercado, editar qty (±) e remover na tabela
- [x] Progresso de set com % — modo "qualquer variante". *Modos normal+reverse / master set dependem do índice de cartas+variantes por set (movido p/ Fase 4).*
- [x] Wishlist: comando "Create wishlist" (coleção com `role: wishlist`)

### Fase 3 — Decks (v0.4–0.5) — table stakes

- [x] Deck view (`DeckView`): agrupamento Pokémon/Trainer/Energy com contadores, validação ao vivo (60 cartas + limite de cópias + legalidade), qty ±, contador total/60
- [x] Formatos Standard/Expanded/Unlimited: legalidade por carta vinda da API (`legalities` no frontmatter da nota de carta); legalidade desconhecida (carta manual) vira issue própria em vez de chute
- [x] **Import/export texto TCG Live**: "Import deck" cria a nota do deck a partir da decklist colada; "Export deck" copia para o clipboard agrupado por seção (`serializeCardList`, com teste de round-trip pelo parser)
- [x] Preço total do deck + **"Missing from collection"** com custo para completar (soma coleções, exclui wishlists)

### Fase 4 — Diferenciais (v0.6–0.8)

- [x] Import CSV de ManaBox/Collectr/TCG Collector: parser RFC 4180 + mapeamento de colunas por aliases de header (`mapCsvRows`); resolução agrupada por set via `SetCardsCache` (1 fetch por set em vez de 1 por carta)
- [x] Cost to completion por set: botão na seção de progresso da coleção, precifica as cartas faltantes com o cache do set
- [x] Snapshot de preços (comando "Update prices"): força refresh por set, atualiza `price-market`/`price-updated` nas notas de carta e appenda em `portfolio-history.json` (dir do plugin — dados derivados; a fonte de verdade continua nas notas). *Nota: armazenado em JSON, não em nota Markdown como planejado originalmente — as notas de carta continuam sendo o dado canônico.*
- [x] Gráfico de valor do portfólio no dashboard (SVG, série única com accent do tema, hover + crosshair, tabela de dados como fallback)
- [x] Notas/links: já garantido por design — os stores só tocam frontmatter; corpo das notas é do usuário; wikilinks nas entries dão os backlinks

### Extras entregues fora do roadmap original

- [x] **Coleção de set (master set tracking)**: comando "Create set collection" — picker fuzzy de sets, cria as notas de todas as cartas e uma coleção-checklist com todas as entradas em qty 0 (regulares + secretas). Mudança de modelo: qty 0 é linha de checklist válida (não conta como possuída); remover linha é ação explícita do ×.
- [x] **Pill de playset**: coluna na view de coleção indicando 4+ cópias da carta (soma variantes/condições do mesmo id).
- [x] Polimento de UI (skill impeccable, registro product): thumbnails com hover-preview, badges de condição, painéis de validação, tabular-nums, empty state instrutivo, motion 150ms + reduced-motion.

### Fase 5 — Polimento e lançamento (v0.9–1.0)

- [x] i18n completo: en + pt-BR com paridade total de chaves (verificado por script)
- [x] README comercial (posicionamento da pesquisa: dados do usuário, bulk entry, comparativo de dores) + LICENSE MIT + disclaimer de trademark
- [x] Demo vault em `demo-vault/` (coleção, deck 60 cartas, notas de carta)
- [x] CSS responsivo para larguras estreitas (≤600px: filtros empilhados, tiles fluidos, tabela compacta)
- [ ] Screenshots/GIFs (lista do que capturar em `docs/assets/README.md` — captura manual pendente)
- [ ] Teste mobile em device real (selects nativos devem funcionar; risco conhecido: foco em input dentro de view-content esconde conteúdo no mobile)
- [ ] Repositório GitHub + primeiro commit + release inicial (`release.mjs`)
- [ ] Submissão à community store (PR em obsidianmd/obsidian-releases) — **adiada por decisão do usuário**

## Modelo de dados (proposta — validar na Fase 1)

```
TCG Binder/
  cards/                      # notas de carta, criadas sob demanda
    Pikachu ex (SVI 45).md    # tcg-binder: card + dados da carta
  collections/
    Minha coleção.md          # tcg-binder: collection + entries: [{card, qty, variant, condition}]
  decks/
    Charizard ex.md           # tcg-binder: deck + format + entries; corpo = decklist legível
```

- Entradas referenciam cartas por **wikilink + cardId** — o link dá o grafo, o id dá a robustez a renomes.
- Corpo das notas é do usuário (notas pessoais, memórias de trade); o plugin só gerencia frontmatter e blocos marcados.

## Não-objetivos

- Scanner de câmera (mobile-first/ML — fora do alcance do Obsidian)
- Feed social, trades entre usuários, marketplace/afiliados
- Outros TCGs no MVP (a arquitetura já prevê via `GameId`/`CardDataSource`, mas MTG etc. só depois da v1.0)

## Métricas de sucesso

- v1.0 aceita na community store
- Import de uma coleção real de +500 cartas em < 5 min (benchmark da dor nº 1)
- Downloads/stars como proxy de alcance; issues abertas como proxy de engajamento
