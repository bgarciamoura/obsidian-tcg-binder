# Pesquisa de produto — como os apps de coleção/deck de TCG se comportam

> Pesquisa feita em 2026-07-22 para orientar o design do TCG Binder.
> Fontes listadas ao final de cada seção e no rodapé.

## 1. Os players e seus modelos

| App | Foco | Modelo |
|---|---|---|
| [Dex](https://dextcg.com/) | Coleção Pokémon (scan + binders) | Free suficiente; assinatura p/ notas, badges, pastas dinâmicas, scanner |
| [Collectr](https://getcollectr.com/) | Portfólio multi-TCG (valor como ações) | Core free; premium p/ scans ilimitados, filtros, export de dados |
| [TCG Collector](https://www.tcgcollector.com/) | Checklist/completude de sets Pokémon | Free p/ checklist; premium p/ quantidades exatas, condição, variantes |
| [pkmn.gg](https://www.pkmn.gg/) | Coleção + deck builder Pokémon | Free/premium |
| [Limitless](https://limitlesstcg.com/) | Competitivo: decklists, torneios, builder | Free |
| Moxfield / Archidekt / [ManaBox](https://www.manabox.app/) (MTG, referência) | Deck building web / categorização / scanner mobile | Free/premium |

## 2. Entrada de cartas na coleção

- **Scanner de câmera é o padrão mobile** (Dex, Collectr, ManaBox): apontar e adicionar em segundos. Mas é imperfeito — usuários do Collectr reclamam que o scanner confunde 1st edition/unlimited e que às vezes é mais lento que entrada manual.
- **Busca + checklist é o padrão web** (TCG Collector): navegar o set e marcar o que possui. Reclamação nº 1: **falta de bulk entry** — adicionar carta a carta é tedioso para coleções grandes.
- **Import/export CSV é esperado** (ManaBox exporta: Name, Set Code, Set Name, Collector Number, Foil, Rarity, Quantity, IDs, Purchase Price...). Não há padrão universal de colunas — cada app usa o seu, e conversões entre apps são fonte de dor (parse errors de condição etc.).
- Busca típica: por nome, por set, por número no set (ex.: "025/198").

**Implicação p/ TCG Binder:** sem câmera no desktop, nossa força é **busca rápida (modal fuzzy) + bulk entry decente** (ex.: colar lista "4 Pikachu SVI 45" ou marcar vários no grid do set) + **import CSV** dos apps existentes (migração = aquisição de usuários).

## 3. Dados rastreados por carta (consenso do mercado)

- Quantidade, **variante** (normal / holo / reverse holo / 1st edition / stamps regionais — TCG Collector cataloga "todas as variações já impressas" e isso é seu diferencial), **condição** (NM→DMG), **graded** (PSA/CGC + nota), preço pago e valor de mercado.
- Preço com **histórico temporal** (Collectr: gráfico como portfólio de ações, 5+ anos).
- Dex permite **notas pessoais por carta** (memórias, insights) — encaixa perfeitamente com Obsidian.

## 4. Organização

- **Binders/pastas custom** (Dex: Wishlist, Favorites, Duplicates, Shinies; pastas dinâmicas premium).
- **Progresso de set** com % de completude e modos configuráveis (TCG Collector: contar qualquer variante / normal+reverse / todas as variantes) e **"Cost to Completion"** (quanto falta em $ para fechar o set) — feature premium muito citada.
- Wishlist e trade list são universais; master set (todas as variantes) é o modo hardcore.

## 5. Deck building

- **Formato de intercâmbio é texto simples**: `4 Pikachu ex SVI 45` (quantidade, nome, código do set, número). Export/import com Pokémon TCG Live via clipboard é o fluxo padrão (Limitless, pkmn.gg). Set code + número precisam estar exatos.
- **Validação automática por formato**: Standard, Expanded, GLC, Unlimited (pkmn.gg valida ao vivo durante a montagem).
- **Agrupamento por supertype** (Pokémon / Trainer / Energy) com contadores por grupo é o layout canônico de decklist.
- Estatísticas: curva/consistência, preço total do deck, **one-click purchase** (afiliados TCGplayer) como monetização.
- Playtesting (mão inicial, draw sim) — Moxfield e Limitless têm; Archidekt ganha em **categorização por função** (Ramp, Draw, Removal...) — conceito interessante para "papéis" no deck Pokémon (attacker, support, consistency).
- Compartilhamento: link público + export como imagem (Limitless).

## 6. Preços

- Fontes dominantes: **TCGplayer (USD)** e **Cardmarket (EUR)**.
- [pokemontcg.io](https://docs.pokemontcg.io/) já entrega ambos por carta (market/low/mid/high por finish; trend/avg do Cardmarket). 1.000 req/dia sem chave, 20.000 com chave gratuita — suficiente para nosso caso com cache local.
- Alternativa sem auth: [TCGdex](https://tcgdex.dev/markets-prices). Reclamação recorrente no Collectr: histórico de preço "reescrito" — transparência de fonte importa.

## 7. Reclamações recorrentes (oportunidades)

1. **Bulk entry ruim/inexistente** (TCG Collector) — carta a carta é tedioso.
2. **Scanner impreciso** para variantes (Collectr).
3. **Dados presos no app** — export é feature *premium* no Collectr; migração entre apps é dolorosa.
4. **Base de dados incompleta/atrasada** em sets novos e itens obscuros, sem opção de adicionar manualmente.
5. Features sociais/serviço que quebram e histórico de preços não confiável.

## 8. Síntese para o TCG Binder

### Table stakes (todo app tem; precisamos ter)
- Busca de cartas por nome/set/número com imagens
- Quantidade + variante + condição por carta
- Progresso de set com % e modos de contagem
- Binders/listas custom + wishlist
- Deck builder com validação Standard/Expanded, agrupamento Pokémon/Trainer/Energy
- Import/export do formato texto do TCG Live
- Valor de mercado (TCGplayer/Cardmarket via pokemontcg.io) e valor total da coleção

### Diferenciais raros no mercado
- Cost to completion (TCG Collector premium)
- Histórico de valor do portfólio (Collectr)
- Notas pessoais por carta (Dex premium)
- Categorização por função no deck (Archidekt, só em MTG)

### Vantagens únicas de um plugin local-first em Markdown
1. **Dono dos dados**: tudo em frontmatter legível — o "export" que os apps cobram é o nosso estado natural. Import CSV de ManaBox/Collectr/TCG Collector como porta de entrada.
2. **Notas e links nativos**: diário de trades, backlinks carta↔deck↔coleção, grafo — nenhum app faz isso (Dex cobra por notas simples).
3. **Sem servidor**: nada de features quebrando, histórico apagado ou paywall progressivo. Cache de preços local com data do snapshot (transparência).
4. **Cartas faltantes na base**: usuário pode criar nota de carta manualmente — resolve a reclamação nº 4.
5. **Bulk entry text-first**: colar decklist/lista de compra em texto já é UX natural de Obsidian — ataca a reclamação nº 1 com nossa arma mais forte.

### Fora de escopo (não competir)
- Scanner de câmera (mobile-first, ML — sem chance no Obsidian desktop; talvez futuro distante via foto).
- Social/feed, marketplace/one-click purchase (por ora).

## Fontes

- [Dex](https://dextcg.com/) · [Dex na App Store](https://apps.apple.com/us/app/dex-for-tcg-collectors/id1555489854)
- [Collectr](https://getcollectr.com/) · [reviews](https://justuseapp.com/en/app/1603892248/collectr-tcg-portfolio-app/reviews)
- [TCG Collector](https://www.tcgcollector.com/) · [review Packz](https://packz.io/blog/tcg-collector-review) · [variant progress](https://www.tcgcollector.com/news/21/card-variant-progress-and-collection-sharing-improvements)
- [pkmn.gg deck builder](https://www.pkmn.gg/trydeckbuilder) · [Limitless builder](https://my.limitlesstcg.com/builder) · [decklist format (RK9)](https://support.rk9.gg/kb/article/8-how-to-import-a-deck-list-from-pok%C3%A9mon-tcg-live/) · [Limitless docs](https://docs.limitlesstcg.com/player/decklists)
- [comparativo Moxfield/Archidekt/ManaBox](https://manaforge.tools/en/blog/manaforge-vs-moxfield-vs-archidekt) · [ManaBox import/export](https://www.manabox.app/guides/collection/import-export/)
- [pokemontcg.io card object](https://docs.pokemontcg.io/api-reference/cards/card-object/) · [TCGdex markets](https://tcgdex.dev/markets-prices) · [panorama de APIs](https://www.scrapingbee.com/blog/pokemon-card-api/)
