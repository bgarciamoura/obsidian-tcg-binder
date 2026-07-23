# TCG Binder — Plugin Obsidian

Plugin do Obsidian para controle de **coleções, decks e cartas de Pokémon TCG** dentro do vault.

## Nome e branding

- **Nome do plugin:** `TCG Binder` — "binder" é o fichário físico que todo colecionador de TCG usa; nome curto e memorável no padrão dos apps líderes do nicho (Dex, Collectr, TCG Collector).
- **Plugin ID (`manifest.json`):** `tcg-binder`
- **Pasta do repositório:** `obsidian-tcg-binder`
- **Descrição (marketing/SEO da community store):** deve conter as palavras-chave que os usuários buscam — ex.: *"Track your Pokémon TCG collection, build decks and browse cards — binders, decklists and card database inside your vault."* A busca da loja indexa nome + descrição, então "Pokémon TCG" entra na descrição, não no nome.
- **Racional jurídico/comercial:** "Pokémon" é marca registrada da Nintendo/TPCi — não usar no NOME do plugin (risco de takedown e de rejeição por trademark). A [política de desenvolvedores do Obsidian](https://docs.obsidian.md/Developer+policies) também veta uso confuso de marcas. Nome neutro ("TCG") ainda permite expandir para outros jogos (MTG, Yu-Gi-Oh!, One Piece) no futuro — estratégia que fez o Collectr crescer.
- Não usar "Obsidian" no nome do plugin (convenção da loja; o prefixo `obsidian-` fica só no nome do repo).

## Pesquisa e plano de produto

- `docs/product-research.md` — análise dos apps concorrentes (Dex, Collectr, TCG Collector, pkmn.gg, Limitless, Moxfield/Archidekt/ManaBox): table stakes, diferenciais e vantagens do modelo local-first em Markdown.
- `PRODUCT.md` — visão, posicionamento e **roadmap priorizado em 5 fases** (fundação de cartas → coleção → decks → diferenciais → lançamento) + modelo de dados proposto. Consultar antes de iniciar qualquer feature; marcar os checkboxes conforme entregas.

## Estado do projeto

Scaffold pronto e validado (`npm run build`, `npm run lint` e `npm run test` passando). A arquitetura abaixo foi extraída do plugin de referência `../obsidian-notion-bases-plugin` (plugin publicado e maduro do mesmo autor) e deve ser seguida aqui.

### Estrutura atual

```
src/
  main.ts                  # TcgBinderPlugin (entry): comandos, ribbon, view, settings tab
  constants.ts             # FRONTMATTER_TYPE_KEY ('tcg-binder')
  types.ts                 # GameId, CardRef, CollectionEntry, DeckEntry, DeckConfig...
  settings.ts              # TcgBinderSettings + DEFAULT_SETTINGS + TcgBinderSettingTab
  context.ts               # AppContext + useApp()
  domain/                  # lógica PURA (sem imports do Obsidian) — é o que se testa
    deck-rules.ts          # DeckRules (data-driven p/ outros jogos), validateDeck()
    collection-stats.ts    # computeCollectionStats()
    card-query.ts          # parseCardQuery: "SVI 45" / "45/198" / nome
  services/
    binder-store.ts        # BinderStore: notas marcadas (collection/deck), roles
    collection-store.ts    # CollectionStore: entries {id,link,qty,variant,condition}
    deck-store.ts          # DeckStore: entries {id,link,qty} + format
    card-notes.ts          # CardNotes: nota por carta, criada sob demanda + índice
    set-catalog.ts         # SetCatalog: cache em disco dos sets (TTL 7d, fallback stale)
    set-cards-cache.ts     # SetCardsCache: cartas por set (mem+disco) — CSV import e cost-to-completion
    portfolio-history.ts   # PortfolioHistory: snapshots de valor em JSON no dir do plugin
    card-data/
      card-data-source.ts  # interface CardDataSource + CardData/SetInfo normalizados
      pokemon-tcg-source.ts# adapter pokemontcg.io via requestUrl
  modals/card-search-modal.ts # SuggestModal async com debounce e imagem
  utils/                   # vault.ts (ensureFolder/findAvailablePath), file-name.ts
  views/binder-view.tsx    # BinderView (ItemView) monta o React root
  components/BinderRoot.tsx# componente raiz da view
  hooks/useIsMobile.ts
  i18n/                    # t(key); locales en (fonte de verdade) + pt-br
tests/
  __mocks__/obsidian.ts    # stubs mínimos, ligados via alias no vitest.config.ts
  deck-rules.test.ts, collection-stats.test.ts
```

### Decisões de escalabilidade

- **Multi-jogo por design:** `GameId` em `types.ts` + `Map<GameId, CardDataSource>` em `main.ts`. Adicionar MTG/One Piece = novo membro no union, novo adapter, novo `DeckRules` — nada mais muda.
- **Regras de deck são dados** (`DeckRules`), não código hard-coded; `copyLimitExempt` vem do data source (supertype Energy + subtype Basic), nunca de name-matching.
- **`domain/` não importa `obsidian`** — mantém a lógica 100% testável.
- **Callbacks lazy para settings** (`() => this.settings.x`) em store/sources — mudanças de settings valem na hora, sem re-instanciar serviços.
- Lint: 2 warnings conhecidas e aceitas (deprecação de `tseslint.config` e sugestão de `getSettingDefinitions`) — mesmas do projeto de referência; zero erros é o critério.

### Gotchas do Obsidian descobertos neste projeto

- **Bundle stale mascara qualquer correção** (perdemos um ciclo inteiro de debug nisso, 2026-07-23): copiar `main.js` para o vault NÃO recarrega o plugin — o Obsidian mantém o código antigo em memória até `Ctrl+R`/restart. O arquivo `.hotreload` só funciona com o plugin **Hot Reload instalado** (agora está no vault development). Diagnóstico rápido: `console.debug` de versão+fonte no `onload` (aparece com console em Verbose); ids de carta no formato errado (`me5-25` sem zero-pad = pokemontcg.io; `me5-025` = TCGdex) também denunciam qual build/fonte rodou.
- **Lint obsidianmd proíbe `console.log`** (guideline "avoid unnecessary logging") E proíbe `eslint-disable` dessa regra (`eslint-comments/no-restricted-disable`). `console.error` e `console.debug` passam — usar `error` para falhas reais e `debug` para marcadores de dev.
- **Encadear modais rouba foco/escopo de teclado** (bug real, 2026-07-23): abrir um modal enquanto o anterior fecha faz a restauração de foco do modal antigo "matar" o input do novo — digitar não dispara `getSuggestions` e nada é logado. Correção dupla: re-focar `inputEl` no `onOpen` com `window.setTimeout(..., 50)` (mesmo workaround do quick-add do plugin de referência) e atrasar a reabertura de loops modal→modal com `window.setTimeout(..., 80)`.
- **`requestUrl` pode lançar erro cru MESMO com `throw: false`** quando não consegue processar o corpo de uma resposta de erro (ex.: página HTML de 500 do Cloudflare) — a mensagem é "Request failed, status NNN" sem URL. Todo caminho de rede passa por `http.requestJson`, que envolve as duas tentativas em try e re-lança sempre com a URL no contexto (e converte "status 429" em `RateLimitError`).
- **Imports são resilientes por linha**: uma requisição falha em `resolveCardLines`/`runCsvImport` vai para a lista de `failed` (com `console.error`) e o loop continua. Exceção: `RateLimitError` aborta o restante — insistir só aprofunda o bloqueio.
- **Componentes de UI do Obsidian são "thenables"**: `BaseComponent` tem método `.then()`, então `DropdownComponent`/`ButtonComponent` retornados implicitamente por arrow functions disparam `@typescript-eslint/no-misused-promises`. Sempre usar corpo com chaves em callbacks que chamam métodos encadeáveis (`forEach((f, i) => { dd.addOption(...) })`).
- Strings de UI hard-coded em `.ts` também sofrem lint de sentence case (`obsidianmd/ui/sentence-case`) — mover exemplos/placeholders para os locales e cobrir com `ignoreRegex`.
- YAML converte números de coletor ("45") em number no frontmatter — normalizar de volta para string ao ler (`CardNotes.readCardMeta`).

### Fontes de dados de cartas (2026-07-23)

- **pokemontcg.io foi absorvida pelo Scrydex — não há mais chave gratuita.** O tier sem chave segue no ar, mas com rate limit agressivo. Por isso o plugin tem duas fontes (`CardDataSource`): **TCGdex (padrão, grátis, sem chave)** e pokemontcg.io (para quem tem chave paga). Seletor em settings (`dataSource`).
- **Ids de carta/set são específicos por fonte** (`sv1-45` no pokemontcg.io ↔ `sv01-045` no TCGdex). Caches em disco levam o `source.id` no nome do arquivo; nunca misturar.
- **TCGdex**: REST `api.tcgdex.net/v2/en` apenas — GraphQL foi descartado. Motivos: não expõe `abbreviation`, não expõe pricing, não filtra por set, e o campo legado `tcgOnline` é **null em todos os sets modernos** (quebrou o bulk import silenciosamente em 2026-07-23). O código TCG Live ("SVI") só existe no REST **detail** do set (`abbreviation.official`) — o catálogo hidrata os ~160 details com concorrência 8 no refresh semanal.
- **Buscas TCGdex retornam resumes** (sem preço/legalidade/supertype) — `main.ensureHydratedCardNote` hidrata via `getCard` antes de persistir. `getSetCards` hidrata o set inteiro com concorrência 8 (~30s num set de 250; cache de 7 dias).
- Imagens TCGdex: base + `/low.webp` ou `/high.webp`. Preço: `pricing.tcgplayer.<finish>.marketPrice` (USD; ignorar chaves de metadata `unit`/`updated`); não misturar com Cardmarket (EUR).
- **`energyType` no TCGdex é "Normal"/"Special"** — NÃO "Basic" (bug real: 13 Fighting Energy acusadas de estourar limite de cópias). Além do fix no adapter, `isBasicEnergy(supertype, name)` no domain (os 9 nomes são fixos pelas regras do jogo) é fallback em `readCardMeta` — conserta notas antigas sem migração.
- Cartas de sets novos podem ter `image: null` na API E asset 404 no CDN (ex.: mee-006) — nota sem imagem é o caminho gracioso, não é bug nosso.

### Gotchas da API pokemontcg.io (verificados em 2026-07-22)

- **`set.ptcgoCode` NÃO é filtrável** — a API responde HTTP 500 (sem corpo). Resolver código→`set.id` localmente via `SetCatalog.findByCode` e filtrar por `set.id`.
- A API é lenta e instável (timeouts frequentes) — toda chamada precisa de fallback (cache stale, retry como busca por nome).
- **Rate limit agressivo sem chave** (confirmado em teste real 2026-07-23): após "Update prices"/cost-to-complete (que baixam sets inteiros), buscas passam a falhar com 429 por minutos. Por isso: `requestWithRetry` (1 retry em 5xx/rede), `RateLimitError` tipado com mensagem própria sugerindo a chave gratuita, cache de buscas de 5 min no `PokemonTcgSource`, e `console.error('[TCG Binder] ...')` em toda falha de API para debug.
- `number` é string exata ("45", não "045"); `parseCardQuery` remove zeros à esquerda.

---

# Arquitetura de referência (baseada em obsidian-notion-bases-plugin)

## Stack

- **TypeScript** (strict) + **React 18** para UI, bundlado com **esbuild** em um único `main.js` (CJS, target ES2020).
- **Vitest** para testes de lógica pura. **ESLint flat config** com `eslint-plugin-obsidianmd`.
- Artefatos distribuídos de um plugin Obsidian são sempre 3 arquivos: **`main.js` + `manifest.json` + `styles.css`**. `main.js` fica no `.gitignore` (vai só para releases).

## Comandos

```bash
npm run dev          # esbuild em watch mode (sourcemap inline)
npm run build        # tsc -noEmit -skipLibCheck && esbuild production (minify)
npm run lint         # eslint .
npm run test         # vitest run
npm run test:watch   # vitest
node release.mjs [patch|minor|major]   # bump + commit + tag + push (tag dispara release no CI)
```

Padrão importante: o `build` roda **type-check antes do bundle** — esbuild não checa tipos.

## manifest.json e versions.json

Campos obrigatórios do `manifest.json`: `id`, `name`, `version`, `minAppVersion`, `description`, `author`. Opcionais úteis: `authorUrl`, `isDesktopOnly: false` (habilita mobile), `fundingUrl` (string ou objeto com múltiplos links).

```json
{
	"id": "tcg-binder",
	"name": "TCG Binder",
	"version": "0.1.0",
	"minAppVersion": "1.8.7",
	"description": "Track your Pokémon TCG collection, build decks and browse cards inside your vault.",
	"author": "bgarciamoura",
	"authorUrl": "https://github.com/bgarciamoura",
	"isDesktopOnly": false
}
```

`versions.json` mapeia `versão-do-plugin → minAppVersion` (o Obsidian usa para servir a versão certa a apps antigos). A versão deve estar sempre sincronizada entre `manifest.json` e `package.json` — o `release.mjs` cuida disso.

## Configs de build

### esbuild.config.mjs
- Entry `src/main.ts` → `main.js`; `bundle: true`, `format: "cjs"`, `target: "es2020"`, `treeShaking: true`.
- `jsx: "automatic"` (não precisa importar React nos `.tsx`).
- `external`: `obsidian`, `electron`, `@codemirror/*`, `@lezer/*` e builtins do Node — providos pelo runtime do Obsidian, nunca bundlar.
- Prod: `minify: true`, sem sourcemap, `context.rebuild()` e sai. Dev: `sourcemap: "inline"`, `context.watch()`.

### tsconfig.json
- `target: ES2020`, `module: ESNext`, `moduleResolution: node`, `baseUrl: src`.
- `strictNullChecks`, `noImplicitAny`, `noImplicitReturns`, `useUnknownInCatchVariables`, `isolatedModules`, `importHelpers` (tslib).
- `jsx: "react-jsx"`, `lib: ["DOM", "ES2020", "DOM.Iterable"]`.

### eslint.config.mts (flat config)
- Estende `obsidianmd.configs.recommendedWithLocalesEn` + `tseslint.configs.recommendedTypeChecked`.
- Declara globals do runtime Obsidian: `activeWindow`, `activeDocument`, `createEl`, `createDiv`, `createSpan`, `createFragment`.
- Precisa de `jiti` como devDependency para o ESLint carregar config `.mts`.
- Ignora: `node_modules`, `main.js`, `esbuild.config.mjs`, `release.mjs`, `versions.json`, `tests`, `vitest.config.ts`.

### vitest.config.ts
- `test.include: ['tests/**/*.test.ts']`, `globals: true`.
- **Alias `obsidian` → `tests/__mocks__/obsidian.ts`** — é assim que os testes rodam sem o runtime real.

### .editorconfig
- **Indentação: TAB, largura 4.** UTF-8, LF, newline final.

## Estrutura de src/ (camadas)

```
src/
  main.ts              # entry: classe Plugin, comandos, eventos, registros
  <feature>-view.ts    # ItemView(s) que hospedam o React root
  settings.ts          # interface Settings, DEFAULT_SETTINGS, PluginSettingTab
  types.ts             # interfaces compartilhadas + defaults
  context.ts           # AppContext (React context) + hook useApp()
  <domain>-manager.ts  # camada de serviço/dados: CRUD, I/O de frontmatter (recebe App no construtor)
  components/          # componentes React (.tsx), um por view principal
  hooks/               # useIsMobile, useDebouncedValue, hooks de dados
  i18n/                # index.ts com t(key); locales/ (en.ts é fonte de verdade das chaves)
  *-modal.ts           # modais (extends Modal do Obsidian)
```

### main.ts — padrão do entry point

`export default class TcgBinderPlugin extends Plugin` (única exceção permitida a default export — o Obsidian exige). `onload()` na ordem:

1. `await this.loadSettings()`
2. Instanciar managers (camada de dados)
3. `this.registerView(VIEW_TYPE, leaf => new MinhaView(leaf, this))`
4. `this.addRibbonIcon(...)`, `this.addCommand(...)` (com `name: t(...)`)
5. `this.registerEvent(this.app.workspace.on(...))` / `this.app.metadataCache.on('changed', ...)`
6. `this.addSettingTab(new TcgBinderSettingTab(this.app, this))`

`onunload()` pode ficar vazio: tudo registrado via `registerEvent`/`registerView`/`addCommand` é limpo automaticamente pelo Obsidian.

Armadilha conhecida: para interceptar abertura de arquivos, usar `workspace.on('active-leaf-change')` e NÃO `file-open` (dispara antes do CodeMirror inicializar e causa "Field is not present in this state"). Usar flag privada de reentrância (ex.: `_redirecting`) quando o próprio plugin abre views.

### ItemView + React

- `getViewType()`, `getDisplayText()`, `getIcon()` obrigatórios.
- `getState()`/`setState()` persistem o estado do workspace (ex.: path do arquivo aberto) para a view sobreviver a reload.
- `onOpen()` vazio (renderizar nele causa flash — o `setState` chega depois e dispara o render).
- Render: `container = this.containerEl.children[1]` → `container.empty()` → `createRoot(container)` → `<AppContext.Provider value={app}>...</AppContext.Provider>`. Desmontar root anterior antes de recriar; `onClose()` faz `this.root?.unmount()`.
- O `App` do Obsidian chega aos componentes React via `AppContext` + hook `useApp()` (lança erro fora do Provider).

### Persistência de dados

- **Settings do plugin:** `loadData()`/`saveData()`. Padrão: `this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`. `data.json` no `.gitignore`.
- **Dados de domínio NÃO usam loadData/saveData** — vivem no vault como Markdown com frontmatter. No plugin de referência: uma pasta por database com `_database.md` (schema/config no frontmatter, marcado por um campo booleano marcador) e um `.md` por linha. Aqui: aplicar o mesmo modelo — ex.: pasta por coleção/deck com nota de config + uma nota por carta (dados no frontmatter). Isso mantém tudo versionável, sincronizável e legível sem o plugin.
- Ler/gravar frontmatter: **`app.fileManager.processFrontMatter(file, fm => {...})`** (forma preferida). Leitura sync via `app.metadataCache.getFileCache(file)?.frontmatter`.
- Resolver arquivos: `app.vault.getFileByPath(path) ?? null`. Conteúdo: `vault.cachedRead`; edição atômica: `vault.process`.
- Reagir a mudanças: `app.vault.on('create'|'delete'|'rename')` + `metadataCache.on('changed')`, com **debounce (~50ms)** e cleanup via `.off()` no return do `useEffect`.
- Sanitizar config lida do frontmatter (pode estar corrompida); `structuredClone(DEFAULT_...)` para defaults; ao gravar, deletar chaves vazias em vez de escrever `undefined`; guard `isRecord()` antes de acessar propriedades de `unknown`.

### Tratamento de erros

- `new Notice(String(e))` para erros visíveis ao usuário.
- `try/finally` para resetar flags de estado.
- Catches recebem `unknown` (`useUnknownInCatchVariables`); classes de erro custom quando fizer sentido; validações retornam `string | null` em vez de lançar.
- Em hooks de carregamento, versionar o load (ref incremental) para descartar resultados stale de carregamentos concorrentes.

### CSS (styles.css)

- Um único `styles.css` na raiz. **Sempre usar as CSS variables do tema do Obsidian** (`var(--background-primary)`, `var(--text-normal)`, `var(--font-ui-small)`, `var(--radius-m)`, `var(--background-modifier-border)`, ...) — nunca hard-codar cores.
- Todas as classes com prefixo próprio: aqui, **`tcgb-`** (ex.: `tcgb-card-grid`).

### React no Obsidian — armadilhas

- `useIsMobile()` para detecção mobile; em mobile, dropdowns viram **BottomSheet via portal em `activeDocument.body`** (o Obsidian esconde o conteúdo da view quando um input dentro de `view-content` recebe foco).
- Portals para menus/dropdowns evitam clipping por `overflow: hidden`.
- Drag-and-drop com `@dnd-kit`: cuidado com propagação de eventos para não conflitar com o drag nativo do Obsidian.

### i18n

- Toda string de UI passa por `t(key)` (`src/i18n/index.ts`); locale resolvido via `getLanguage()` do Obsidian, fallback `en` → própria key.
- `en.ts` é a fonte de verdade (`type Keys = keyof typeof en`). Strings em **sentence case**. Começar com `en` e `pt-BR`; ao mudar `en.ts`, atualizar todos os locales.

## Testes

- Testar **apenas lógica pura** (parsing, validação de deck, cálculos de coleção, filtros) — sem testes de componentes React; UI é validada manualmente no Obsidian.
- `tests/__mocks__/obsidian.ts`: stubs mínimos das classes importadas (`TFile`, `TFolder`, `Modal`, `Setting` com métodos chainable retornando `this`, `Notice`, `normalizePath`, `getLanguage` → `'en'`...), ligado via alias no `vitest.config.ts`.

## Dev loop / hot reload

**Vault de teste deste projeto:** `/home/bgarciamoura/windows/Documents/development` (vault "development" no Windows). Deploy = `cp main.js styles.css manifest.json` para `<vault>/.obsidian/plugins/tcg-binder/`. O plugin Hot Reload está instalado e habilitado lá, mas escrever via WSL→NTFS nem sempre dispara o watcher — **sempre pedir `Ctrl+R` ao usuário após deploy** e confirmar pela linha `[TCG Binder] v... loaded` (console em nível Verbose).


1. `npm install` → `npm run dev` (watch).
2. Symlink/cópia de `main.js`, `styles.css`, `manifest.json` para `<vault>/.obsidian/plugins/tcg-binder/`.
3. Arquivo vazio `.hotreload` na raiz do plugin (dentro do vault) ativa o plugin comunitário **Hot Reload**, que recarrega o plugin quando `main.js` muda. `.hotreload` fica no `.gitignore`.

## Release e CI

- `release.mjs` (local): bump semver em `manifest.json` + `package.json` + nova entrada em `versions.json` (todos gravados com `JSON.stringify(..., null, '\t') + '\n'`) → gate `tsc -noEmit` → commit `chore: bump version to <x>` → tag `<x>` → push.
- `.github/workflows/release.yml`: trigger em push de tag → Node 20 → `npm install` → `npm run build` → publica `main.js`, `manifest.json`, `styles.css` como assets do GitHub Release (com attestation de proveniência via `actions/attest-build-provenance`).
- `.github/workflows/lint.yml`: em todo push/PR → matrix Node 20/22 → `npm ci` → build → lint.

## Convenções de código

- TypeScript strict; evitar `any`.
- **Sem default exports** (exceção única: a classe Plugin em `main.ts`).
- Componentes React funcionais com hooks.
- Commits semânticos em inglês (`feat:`, `fix:`, `docs:`, `chore:`).
- Rodar `npm run lint` após qualquer implementação e corrigir tudo antes de commit.
- Branch por issue: `fix/issue#<n>/<descrição>`; PR com `Closes #<n>`.
- Nunca fazer push sem autorização explícita.
- TODO.md é local (`.gitignore`), nunca commitado.

## Dependências de partida

```
dependencies:    obsidian (latest), react ^18.3, react-dom ^18.3
devDependencies: esbuild ^0.27, typescript ^5.8, typescript-eslint ^8,
                 eslint-plugin-obsidianmd ^0.4, vitest ^4, jiti,
                 @types/react, @types/react-dom, @types/node, tslib
```

Adicionar `@tanstack/react-table` / `@dnd-kit/*` apenas se/quando as views precisarem (tabela de coleção, ordenação de deck).

## Dados de cartas (específico deste plugin)

- Fonte de dados de cartas/sets/preços: API pública [pokemontcg.io](https://pokemontcg.io/) (ou similar). No código do plugin, requisições HTTP devem usar `requestUrl` do Obsidian (evita problemas de CORS e funciona em mobile).
- Nesta sessão de desenvolvimento existe um MCP server `pokemon-tcg` (search_cards, get_card, get_decklist, get_meta) útil para explorar dados reais durante o desenvolvimento.

## Domínio (visão de produto inicial)

Três entidades centrais, todas como Markdown no vault:

1. **Coleção (binder):** quais cartas o usuário possui, quantidade, condição, variante (normal/holo/reverse), set.
2. **Deck:** lista de 60 cartas com validação de regras (máx. 4 cópias por nome exceto energias básicas, formato Standard/Expanded).
3. **Carta:** nota individual com frontmatter (nome, set, número, raridade, tipo, preço) — permite links/backlinks nativos do Obsidian entre decks, coleções e cartas.
