# Cache de Atividades dos Agents — Controle de Bola App

Documento vivo para acelerar intervencoes futuras. Complementa `AGENTS.md` e `docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md` — nao os substitui.

**Ultima atualizacao:** 2026-10-06 (voltar da ficha do juiz)

---

### 2026-10-06 — Voltar da ficha do juiz para a lista

- O listener Android em `profile-view` chamava `location.back()` além do voltar do sistema. Um toque pulava a busca e a lista de juízes saía da pilha; o toque seguinte não a recuperava
- A ficha volta a desempilhar uma vez só. A lista de perfis Juiz permanece na tela de busca

---

### 2026-10-06 — Ficha pública do juiz: pontuação por pelada e voltar

- Pontuação 0 no card Peladas: `getRolePublicProfile` (`cloud/source/11-profiles-search.js`) somava `EventPerformance` pelo ponteiro `pelada` e só a linha do próprio juiz. A súmula grava `refereeGoals` na linha do atleta, no evento. Agora a soma usa esses eventos já carregados: gols×3 − amarelos − vermelhos×3, somados na pelada. Espelho: `role-profile-history.service.ts`
- Voltar físico: a ficha usava `window.history.back()`. Em `profile-view`, o listener Android só existe com a ficha aberta; se a URL não mudar, volta para a busca ou a lista
- **Deploy:** publicar `cloud/main.js` de novo. Sem isso a pontuação e os avisos novos da caixa continuam na função antiga

---

### 2026-10-06 — Caixa: card só identidade; avisos entre usuários

- Lista Entrada/Saída: só `Apelido (Nome completo)`, data `dd/mm/aaaa` e hora `HH:mm` (`sentAt`). Título, corpo e avatar saíram do card. Toque abre o texto; Entrada marca lida; Saída não. Não lida na cor primária; lida com opacity 0.55
- Novos `AppMessage`: sócio (`afterSave PeladaMembership`), apresentação de perfil, novo evento, cancelamento/remarcação, aviso do admin aos confirmados, reportagem do jornal
- Já gravavam: desafio, participação, arbitragem, convite/resposta, confronto criado. Fora: `sendContactMessage`, lembrete de 2h, push de teste
- **Deploy:** publicar `cloud/main.js` (22300 linhas)

---

### 2026-10-06 — Restaurar tema padrão

- Cortina de Cores e tema (menu e perfil): botão **Restaurar padrão do app**, com confirmação
- `ThemePaletteService.restoreDefaults()` grava paleta `default` e superfície `dark`. O botão fica desabilitado quando já está nesse par
- Arquivos: `theme-palette.service.ts`, `theme-picker` (ts/html/scss), i18n `theme.restoreDefaults` e `confirm.restoreDefaults`

---

### 2026-10-05 — Busca de usuarios, biometria e wizard

- Usuarios (`/tabs/peladas/usuarios`): a busca casa perfil (Atleta, Juiz, Radialista...) e posicao (goleiro, zagueiro, atacante, meio campo...). A ordem continua pelo endereco de quem esta logado
- Toque no atleta abre a ficha da pessoa com o perfil de atleta na mesma tela (`getAthletePublicProfile`). Os outros perfis seguem em link
- Sair do menu reabre o login com a digital quando a biometria deste aparelho esta ativa. A digital fica acima do formulario
- Wizard: o cartao some enquanto o teclado esta aberto, para o campo de busca da pelada continuar visivel. Abrir pelada e Ver peladas vao para `/tabs/peladas/lista`

---

### 2026-10-04 — Apple fechou o trem 1.0.4

- Upload do IPA 1.0.4 (202) falhou com 90062 e 90186: a versao aprovada 1.0.4 nao aceita build novo
- `package.json` passou a **1.0.5**. Compilacao continua **202** (`CFBundleVersion`). O workflow le a versao de loja do `package.json`

---

### 2026-10-04 — Mural Confrontos: vitorias e gols zerados

- `buildTeamMatchSpotlightCards` somava o placar a partir de `EventPerformance` / `EventRegistration` buscados com `createWithoutData` no `containedIn`. Essa consulta volta vazia; cada confronto entrava 0x0, entao Vitorias, Gols marcados e Gols sofridos ficavam 0
- Agora a busca usa os eventos ja carregados e casa o atleta por `participantUserId` e pelo ponteiro `user`
- **Deploy:** publicar `cloud/main.js` de novo no Back4App

---

---

### 2026-10-04 — Idioma e tema no menu; ajuda da Home

- A segunda linha do `user-bar` (bandeiras + paleta) saiu. O menu tem **Idioma** (alerta com as tres bandeiras) e **Cores e tema** (abre a cortina ja existente, `ThemePickerComponent.showTrigger = false` no app)
- A frase `peladas.hubLead` saiu. A Home usa `app-screen-help` (`peladas.help`), o mesmo botao do Mural

---

### 2026-10-04 — Busca do Wizard, home em quatro portas

- Backup: `D:\Ita\Backups\minhapelada-2026-10-04` (com `.git`; fora `node_modules`, `.gradle-home`, `www`, `android\app\build`, `android\.gradle`, `.angular`, `.gradle`)
- Busca `/tabs/search`: `Event.search` casa nome do evento **ou** nome da pelada (`matchesQuery` no pointer `pelada`). Card destaca `peladaName`. Filtro de bairro em `address.neighborhood`. Atleta: `equalTo` em `primaryPosition` (`FOOTBALL_POSITIONS`). Lista e ficha mostram altura (`formatHeightLabel`) e peso
- **Gotcha:** `listTeamMatchesForFeed` nao manda `peladaName`; confronto so casa a pelada se o campo ja vier na linha
- Home da aba Peladas: hub em `/tabs/peladas`; listas em `lista`, `confrontos`, `times`, `usuarios` e ficha `usuarios/:userId`. Ordenacao pelo endereco logado (bairro, cidade, estado). Eventos dentro da pelada: busca por nome, data e local na lista ja carregada
- Listas novas: `src/app/core/services/home-directory.service.ts` (times e usuarios no cliente, teto 400). Presidente do confronto e endereco do time ficam "—" quando o DTO nao traz

### 2026-10-04 — Inbox, volta do desafio e Media CB na separacao

- Inbox: toque na mensagem abre o texto e, na Entrada, `markRead`. Saida nao marca lida. Nao lida em cor primaria; lida com opacity 0.55. Linha `Apelido (Nome) · data hora` com `counterpartApelido` / `counterpartFullName` (`18-app-mailbox.js`)
- Aceite ida e volta: modal com data, hora e local. Nuvem grava `returnStartTime`, `returnEndTime` (duracao da ida, ou +2h), `returnLocationComplement` e copia `returnAddress`. `confronto-create` preenche so a volta
- Separacao aleatoria padrao: socios em round-robin, demais em cobra por Media CB. Cada time mostra a media no fim
- Push: token em `Parse.Installation` via `registerPushDevice`. Sem token, o push e pulado e o app segue. `getMuralAppDashboard` pesado: falha vira mensagem na tela, nao derruba o app
- **Deploy:** publicar `cloud/main.js` de novo no Back4App

---

### 2026-10-01 — Frase do filtro de regiao nos cards do mural

- Util puro `src/app/core/utils/mural-filter-caption.util.ts` (`muralFilterCaption`): sem estado = `Brasil`; com estado = `Filtro: Estado: …, Cidade: …, Bairro: …` (vazios = `Todas` / `Todos`)
- A frase vai em `MuralPage.locationFilterCaption` e nos mesmos campos `appFilter*` de `shareContextForTab`. Cards do feed (destaques, tops, apoio, Explorar) mostram `<p class="mural-filter-line">` abaixo do titulo — sem `mural-share-exclude`, entra na foto
- Share: faixa e legenda do escopo app usam a mesma funcao. `formatPlace` de pelada/evento permanece
- Cloud Code nao foi alterado

### 2026-10-01 — Caixa de mensagens de verdade (classe `AppMessage`)

- Novo `cloud/source/18-app-mailbox.js`: classe `AppMessage` (registro permanente por mensagem) + helpers `createAppMessage` / `createAppMessages` (Master Key, nunca lancam) + `listAppMessages` / `markAppMessageRead` / `markAllAppMessagesRead` / `countUnreadAppMessages` / `configureAppMailboxClassPermissions`
- Busca: campo `searchText` (minusculo, sem acento — titulo + corpo + nomes dos dois lados) consultado com `matches` escapado
- Ganchos ao lado de cada push: `16-match-challenge.js` (desafio/resposta, remarcacao/resposta, participacao/resposta, arbitragem/aprovacao), `09-events-registrations.js` (`createTeamMatch`, mesmo publico de `collectTeamMatchNotifyUserIds`), `03-push-notifications.js` (`afterSave('RefereeInvitation')`: convite + resposta)
- **Gotcha:** o `afterSave('RefereeInvitation')` tambem dispara na recusa do presidente adversario em confronto (`refereeHiringApprovalStatus === 'rejected'`); a mensagem e suprimida ali para nao duplicar a de `respondTeamMatchRefereeHiringApproval`
- Cliente: `core/models/app-message.model.ts`, `core/services/app-message.service.ts`, inbox com `ion-searchbar` (debounce 350ms) + titulo "Precisa da sua resposta" + lista de mensagens, `app-screen-help helpId="inbox-help" bodyKey="inbox.help"`
- Badge do `user-bar`: pendencias + `countUnreadAppMessages`; falha na contagem cai no comportamento antigo
- **Deploy:** publicar `cloud/main.js` + rodar `configureAppMailboxClassPermissions` (Master Key)
- Sem backfill: o historico comeca na publicacao

### 2026-10-01 — Mural do app: filtro de regiao e 4 destaques na aba Confrontos

- **Filtro em cascata** (Estado > Cidade > Bairro) acima do `ion-segment` em `mural.page.html`; `ion-select interface="alert"` com `label (count)`, opcoes "Todo o Brasil / Todas as cidades / Todos os bairros" (sentinela `__ALL__`) e `ion-chip` com o filtro ativo. Vale para as tres abas
- `MuralService`: `loadLocationOptions(level, filter)` (Cloud `getMuralLocationOptions`; retorna `[]` e a barra fica escondida se a funcao nao existir) e parametros opcionais `state`/`city`/`neighborhood` em `loadAppDashboard()` / `loadTeamMatchDashboard()`
- `mural.page.ts`: `load()` chama os dois dashboards em paralelo (`loadTeamMatchDashboard` deixou de ser condicional) e `enrichDashboardTeamRanks` ficou sincrono recebendo o retorno
- **Aba Confrontos:** `mural-app-feed` recebe `[teamMatchDashboard]` e mostra, antes dos cards antigos, Melhor time / Maior invencibilidade / Melhor ataque (com goleador) / Melhor defesa (com defensor). Chaves `bestTeam`, `longestUnbeaten`, `bestAttack`, `bestDefense` sao **opcionais**: ausentes, o card nao aparece
- **Share:** `MuralShareContext.appFilter{State,City,Neighborhood}` (escopo app, sem mexer no escopo pelada); a regiao sai na faixa de destaque (`buildShareMetaTextLines`) e na legenda
- Ajuda: `app-screen-help helpId="mural-confrontos-help"` so na aba Confrontos (`mural.confrontos.help` nos 3 idiomas) + regras `mural.rule.melhorTime|invencibilidade|melhorAtaque|melhorDefesa`
- **Depende de publicar `cloud/main.js`** com `getMuralLocationOptions` e as 4 chaves novas (Cloud Code escrito por outro agente)

---

### 2026-10-01 — Jogos na ficha (atleta e treinador)

- `getAmateurTeamPublicProfile`: atleta do elenco passa `matchesPlayed` (0 se nao jogou confronto contado deste time)
- Ficha: `N jogos` antes do percentual, nas listas de atletas e treinadores
- `cloud/main.js` regenerado — publicar de novo no Back4App

---

### 2026-10-01 — Ficha publica do time

- `getAmateurTeamPublicProfile` (`cloud/source/15-amateur-teams.js`): foto do presidente, torcedores (`_User.favoriteAmateurTeam` = nome do time), invicto (sequencia V/E ate a derrota, ate 200 confrontos), ultima derrota, atletas do elenco e treinadores com aproveitamento `(V*3+E)/(jogos*3)`
- Tela `team-profile`: escudo, presidente, fundacao, torcedores, invicto, listas e data nos ultimos confrontos. Data tambem no card do desafio
- `cloud/main.js` regenerado — **publicar no Back4App**

---

### 2026-09-29 — Lote correcoes (baloes, treinador, times, CPF, busca, mural)

- **Baloes "?":** X com `color="medium"` + botao "Fechar" com texto (`help-balloon`, `app-screen-help`, `mural-share-button`); X sumia na paleta preta (herdava primary). Estilos `ion-popover .balloon-*` em `global.scss`
- **Mural:** texto "Calculando Rankings, aguarde..." no spinner (`mural.page.html`)
- **CPF duplicado:** `duplicateValueMessage()` em `parse-error.util.ts` (+ `i18n.translateError`); codigo 137 e reutilizado por varias regras — nao mapear tudo para apelido
- **Busca:** segmento Eventos/Perfis/Times movido para `ion-header` (antes ficava sob a user-bar)
- **Top 10 Treinadores vazio:** treinador contratado sem `teamSide`; `resolveCoachTeamSideForStats` em `17-team-match-stats.js` (convite aceito / presidente que convidou). Hiring panel exige lado para coach em `team_match`; `registerFromInvitation` salva `teamSide` para qualquer papel. Ranking usa resultados, nao votos
- **Ficha do time zerada:** `15-amateur-teams.js` contava so `isFinished`; agora `loadCountedTeamMatchScore` (encerrado ou realizado com placar). V/E/D pt-BR (`core/utils/team-match-result.util.ts`), "?" `team.stats.help`, botao "Ver ficha do time" no desafio
- **Painel do treinador (confronto):** nomes do evento, edita so o proprio lado (`14-support-roles.js` `resolveCoachTeamMatchContext`)
- **Cadastro de time:** `app-birth-date-picker` na fundacao, `app-address-form` no local (novo campo `homeVenueAddress` salvo pelo cliente), uniforme so via botao
- **Site:** 42 prints `public/guia/p*.jpeg` (commit `6ecb35c`); faltam 40-48, 52, 56-59, 69, 70
- `cloud/main.js` regenerado (20442 linhas) — **publicar no Back4App**

### 2026-09-28 — Plano pending_items_batch (app + site)

- **Rota:** `team/form` antes de `team/:id` em `app-routing.module.ts` (Perfil/Desafio/Confronto abrem formulario)
- **iOS:** `docs/DEEP-LINKS-APP-LINKS.md` — AASA publicado, entitlements no CI; falta capability Associated Domains no App ID (usuario)
- **i18n:** 56 chaves `screen.help.*` + `mural.app.help` / peladas / confrontos em en-GB e es-ES
- **Site (`controledebolasite`):** guia cap. 01–09 revisados + novos 11–15; commit `90ed9ee` em master (Cloudflare)
- **Manual prints:** capitulos usam `{/* print NN */}` onde nao ha JPEG em `public/guia/` (lista `docs/MANUAL-SCREENSHOTS-PEDIDOS.md`)
- **Pendente usuario:** publicar `cloud/main.js` (fix triplicacao mural evento confronto); screenshots 21–71; Apple Associated Domains

### 2026-09-27 — Botao X nos baloes "?" + redes sociais

- X (`close-outline`) no cabecalho dos 3 baloes: `help-balloon`, `mural-share-button` (regra do card), `app-screen-help`; dismiss dispara `didDismiss` (para o TTS)
- `core/config/social-links.config.ts` (`SOCIAL_LINKS`) -> Sobre > Redes sociais. Nova rede = novo item na lista (site: `controledebolasite/src/config/social.ts`)

### 2026-09-27 — Botao "?" de ajuda em todas as telas

- Componente `app-help-balloon` (`shared/components/help-balloon/`): "?" + popover + Ouvir/Parar (`MuralRuleSpeechService`); some se a chave nao tiver texto
- `core/config/screen-help.config.ts`: `resolveScreenHelpKey(url)` -> `screen.help.<pasta-da-pagina>` (53 chaves, sem splash)
- `user-bar`: "?" e o 1o botao da 1a faixa (nunca oculto pela linha de bandeiras/cores); apelido encolhe com reticencias
- 12 paginas sem user-bar recebem o "?" na toolbar (about, login, register, onboarding, profile-setup, profile-view, etc.)
- Textos so em pt-BR (en/es caem no pt-BR). Botoes "Ajuda" antigos de Peladas/Confrontos/Mural mantidos
- **Gotcha:** nova pagina => adicionar rota em `screen-help.config.ts` e texto `screen.help.<pasta>` no pt-BR

### 2026-09-27 — Mural do Evento: botao "?" (pelada e confronto)

- `MuralShareContext.eventKind` (`pelada`|`confronto`) preenchido em `MuralShareService.buildContextForEvent`
- `mural-share-button.ruleText`: scope `event` resolve `mural.rule.<card>.evento_<kind>` -> `.evento`; scope `pelada` sem "?"
- Novos `ruleKey`: `eventMedia`, `top10` (event-mural page), `supportOps`, `palpites` (prediction-rankings)
- **Corrigido:** mural do evento confronto triplicava soma de notas (Craque/Juiz/Top 10). `mapMuralVoteRowsForScope` pula `attachTeamMatchVoteWeights` e `mapPerformanceRowsForMural` nao multiplica score quando `scope === 'event'` (peso 3x so em escopos multi-evento). `cloud/main.js` regenerado — **publicar no Back4App**

### 2026-09-27 — Mural do App: botao "?" com regra de calculo + ouvir (TTS)

- **Componente:** `app-mural-share-button` ganhou `@Input() ruleKey`; "?" + `ion-popover` so em `scope === 'app'`; fica em `.mural-share-exclude` (fora do PNG)
- **Textos:** i18n `mural.rule.<card>.<geral|peladas|confrontos>` com fallback `.default` (pt-BR/en-GB/es-ES); midia usa `mural.rule.media.<video|radio|journal>`
- **TTS:** `mural-rule-speech.service.ts` — `@capacitor-community/text-to-speech@8.0.2` via import dinamico; web usa `speechSynthesis`; para ao fechar popover
- **Cards:** highlights (craque, goleador, goleiro, time amado, promessa, master, juiz), app-feed (atletas, times, treinadores, apoio, palpites), Explorar (localizacao, desempenho, top local, midia, torcida). Aniversariantes nao aparece no mural do App
- **Gotcha:** ao mudar regra de ranking em `07-mural.js`/`mural-highlights.service.ts`, atualizar o texto `mural.rule.*` correspondente

### 2026-09-26 — Confronto: atleta na contratacao + mural GERAL 3x so no sort + nota arbitro

- **Hiring:** `hireableRolesForPanel` inclui `athlete` para presidente adversario; `createTeamMatchAthleteInvitation` no hiring panel; `teamSide` travado no lado do presidente
- **Mural GERAL:** peso 3x so em sort (`weightedGoals`/`rankingScore`); cards mostram gols/pts/votos reais (`totalScore` raw)
- **Placar:** `getTeamMatchMatchdaySummary` le `MuralVote` por `scope`/`scopeId` (+ fallback invitation)
- **Deploy:** `build:cloud` gerado (`cloud/main.js` ~20319 linhas) — **publicar no Back4App**; app build `2026.09.26.0178` (APK: conectar Samsung e `npm run install:android`)
- **Smoke:** presidente adversario ve Atleta em Negociacao; GERAL Messi 6 gols (nao 18); placar arbitro com Nota

### 2026-09-25 — Top 10 Atletas por nota + share escudo (sibling)

- **Sort:** Cloud `athleteDisplayNote` + client `athleteEntries()` — ordem = badge (averageScore)
- **Share:** img irmão antes de `app-team-shield` + `visibility:hidden` no host; resolve Cloud por nome
- **Perfis:** `buildMuralParticipantProfile` + `getMuralParticipantProfiles` lê FanProfile; reforço backfill Master/GK
- **Deploy:** `build:cloud` gerado; **publicar `cloud/main.js` no Back4App**; APK `2026.09.25.0177` no SM-A376B
- **Smoke:** Top 10 Atletas (1º = maior nota badge); share Melhor Goleiro / Time amado / Master (+ regressão Craque/Goleador/Promessa)

### 2026-09-25 — Share escudo: paridade com Craque/Goleador

- **Dados:** `ensureProfiles` + FanProfile; `backfillHighlightFavoriteProTeams` em Melhor Goleiro / Promessa / Master
- **Markup:** Time mais amado = `span.showcase-team[data-pro-team]` + `team-shield sm`; Promessa e Master em **dois** `ion-card`
- **Share:** `scrollIntoView` + `inlineProTeamShieldsInPlace` (escreve PNG no `img.team-shield`, sem exclude do host)
- **Smoke:** Craque, Goleador, Melhor Goleiro, Time amado, Promessa, Master

### 2026-09-25 — Share escudo: crash Promessa/Master + Goleiro/Time amado

- **Causa crash Promessa/Master:** `data-prefetched-shield` + `favoriteProTeamShieldUrl` com data URL base64 no DOM → html-to-image OOM/`toPng` falha
- **Causa escudo ausente:** `mural-share-exclude` no `app-team-shield` pai excluía o img injetado filho do PNG
- **Fix:** remove enrich/prefetched data URLs; inject resolve só por nome no share; não exclude o host; captura degrada sem re-prepare aninhado; backfill `favoriteProTeam` no goleiro
- **Cloud:** `build:cloud` (batch 24) — **publicar `cloud/main.js`**
- **Smoke:** Melhor Goleiro, Time mais amado, Promessa e Master (sem erro + escudos)

### 2026-09-24 — Share escudo: pré-busca data URL + perfis GK/Master

- **`mural-highlights.service.ts`:** `enrichHighlightsProTeamShields` via Cloud `resolveTeamShieldImageBase64`; `favoriteProTeamShieldUrl` / `timeMaisAmado.shieldUrl`; fix merge `collectAthleteProfiles` (não apagar `favoriteProTeam` do participante); `ensureProfilesForUserIds` lê time do coração do User
- **UI:** `app-team-shield` `[prefetchedShieldUrl]`; `data-prefetched-shield` no share inject
- **Build:** release **2026.09.24.0173** no Samsung
- **Smoke:** Melhor Goleiro, Time mais amado, Master no card Promessa e Master

### 2026-09-24 — Mural App: share escudo/avatar + "Há: …" no destaque

- **Share (`mural-share.service.ts`):** imagens via Cloud `fetchShareImagesAsDataUrls` + `resolveTeamShieldImageBase64` (evita CORS no WebView); raster SVG→PNG; waits reduzidos; Time mais amado `data-pro-team`
- **Tenure:** Cloud `07b-mural-highlight-tenure.js` — classe `MuralHighlightTenure`, `syncMuralHighlightTenures`, `configureMuralHighlightTenurePermissions`; cliente `formatHighlightTenure` + merge em `mural-highlights.service` por bucket (`merged`/`pelada`/`team_match`)
- **Deploy:** publicar `cloud/main.js` (~20063 linhas) + rodar `configureMuralHighlightTenurePermissions` (Master Key); build app `2026.09.24.0162`
- **Smoke:** compartilhar PNG Craque/Goleador/Goleiro/Time amado/Promessa/Master no Samsung release; conferir linha tenure após deploy Cloud

### 2026-09-23 — Top 10 Times/Treinadores + Ajuda + share escudo

- **Cloud `17-team-match-stats.js`:** confrontos contabilizados com sumula (`ready`) mesmo sem `isFinished`; enrich escudo/presidente/sede; empates no top; treinador com idade e qtd times
- **UI:** botão **Ajuda** com rótulo na toolbar; cards detalhados Top Times/Treinadores; fallback `teamRankFallback` no mural
- **Share:** `favoriteProTeamShieldUrl` + espera de imagens antes do PNG (Craque/Goleador e demais showcase)
- **Deploy:** publicar `cloud/main.js` (~19913 linhas); build app `2026.09.23.0157`

### 2026-09-23 — UX Ajuda + correções Mural Geral

- **UI:** `app-screen-help` (popover) em Mural App, Peladas, Confrontos; textos longos removidos das telas; botão **Entrar** nos cards (mesmo efeito do toque); confrontos: **Marcar novo confronto/jogo**
- **Mural:** label **Posição** no showcase; highlights com bucket não zeram mais Promessa/Master/Juiz/Time amado; fallback `getMuralTeamMatchDashboard` (`topTeams`/`topCoaches`) + `enrichDashboardTeamRanks`
- **Share:** `mural-share.service` inline de imagens remotas antes do PNG (Craque/Goleador + demais cards)
- **Cloud:** `17-team-match-stats.js` — dashboard com tops; **Deploy:** `npm run build:cloud` + publicar `cloud/main.js`
- **Build OK:** release `2026.09.23.0155`

### 2026-09-22 — Mural App: Geral / Peladas / Confrontos

- **Cloud `07-mural.js`:** `getMuralAppDashboard` → `buckets` (merged/pelada/team_match), goleador 3x na merged, palpites filtrados, desempate idade; papéis `fan`/`gatekeeper` em `MURAL_TARGET_ROLES`
- **Cloud `17-team-match-stats.js`:** `buildTopTeamsByMatchPoints`, `buildTopCoachesByMatchPoints`
- **UI:** `app-mural-app-feed`, tab segment 3 vias, acordeões Profissionais + Explorar; share `appMuralVariant`
- **Deploy:** `npm run build:cloud` + publicar `cloud/main.js`

### 2026-09-22 — Reportagem, confrontos UI, inbox contratacao

- **Cloud `12-event-media.js`:** `publishEventJournalReportage` — avatar/URL robustos, foto http(s), push `event_journal_reportage` para confirmados
- **Cloud `16-match-challenge.js`:** `getTeamMatchMatchdaySummary` — escudos + `teamName` por goleador
- **UI:** `app-team-match-headline` (nome + escudo + placar); hints confrontos/scroll; placar com time do artilheiro
- **Inbox:** secao "Contratacoes confirmadas" + badge e-mail; card removido no painel participantes (contratados)
- **Deploy:** republicar `cloud/main.js`

### 2026-09-21 — Sumula confronto: regras 01.0–01.4

- **01.0** Confronto: `getRefereeSumulaBoard` consulta para qualquer usuario logado; `canEdit` so arbitro confirmado na janela `sumula*` e `!isFinished`. Tile no event-detail aberto a todos em `team_match`
- **01.1/01.2** Campo `goalsConceded` (`refereeGoalsConceded`) na sumula do goleiro; validacao soma sofridos <= gols adversario; placar = so gols marcados
- **01.3** `buildPerformanceTopEntries(goals)` usa `resolveEffectiveGoalsForCounting` (referee ao salvar)
- **01.4** Mural goleador: empate → um card por atleta (`pickAllTiedWithLabel` / listas)
- **Deploy:** republicar `cloud/main.js`

### 2026-09-21 — Sumula confronto: ordem por time + placar

- Cloud `getRefereeSumulaBoard`: atletas ordenados home→away; retorna `eventType`, nomes dos times e `homeScore`/`awayScore` = soma `refereeGoals` por `teamSide`
- `buildEventActualPredictionResults` / matchday: placar do confronto so pelos gols do arbitro
- UI `event-sumula`: placar vivo + secoes Mandante/Visitante
- Modelo/servico: `teamSide`, `teamName`, scores no board
- **Deploy:** republicar `cloud/main.js` no Back4App

### 2026-09-21 — 10 ajustes confrontos/peladas/mural/sumula

- Idade: `calcAgeFromBirthDate` aceita Date/string; fallback idade no cliente em `toRegistrationListItem`
- Loop VOLTAR: `event-detail.goBack` com `replaceUrl: true` (evita empilhar evento↔pelada)
- Hiring: formulario do convite acima da lista de enviados + scroll ao selecionar candidato
- Confrontos: escudos `homeTeamShieldUrl`/`awayTeamShieldUrl` no feed + UI
- Label **Media CB (Controle de Bola)** no painel de participantes
- Peladas: `avgParticipantsPerEvent` no Cloud `listPeladasForFeed`
- FE→DF no mural (Cloud + cliente)
- Top 10 Atletas/Goleiros: badge = media 0–10 (`averageScore`)
- Header bandeiras/tema so em `/tabs/peladas`
- Sumula: edicao apos `endTime` se janela aberta e `!isFinished` (Cloud + `isSumulaEditOpen`)
- **Deploy:** republicar `cloud/main.js`

### 2026-09-17 — Plano confrontos: participantes, arbitro, V/E/D, mural Confrontos

- **Item 0:** `sortTeamMatchParticipants` no cliente + agrupamento Mandante/Visitante no painel de participantes
- **Item 1:** labels taxa atleta em `athlete-profile-fields`
- **Item 2:** Cloud `createTeamMatchRefereeHiringInvitation` / `respond` / `list`; aprovacao presidente adversario; pagamento `free|split_50|home_pays`; inbox Entrada/Saida; hiring panel + `canManageTeamMatchHiring`
- **Item 3:** Cloud `17-team-match-stats.js` (`getUserTeamMatchRecord`, `getPresidentTeamMatchRecord`, `getAmateurTeamMatchRecord`, `getMuralTeamMatchDashboard`); perfis atleta/coach/presidente/time com V/E/D/%
- **Item 4:** Mural App segmento Geral | Confrontos + `app-mural-confrontos-panel` + `mural.service.loadTeamMatchDashboard`
- **Deploy:** `npm run build:cloud` (21 modulos) + publicar `cloud/main.js`; smoke: inbox arbitro, aba Confrontos, ordem participantes

### 2026-09-17 — Convocacao conflito, indicadores 3m, mural Pelada|Confronto, participantes, GK

- Convite cruzado: `createTeamMatchInvitation` filtra por `teamSide`; soft-warn agenda (`includePending`) + mesmo evento outro lado; aceite resolve conflitos / cancela outro lado
- Perfil atleta: Cloud `getAthleteActivityIndicators` (ultimos 3 meses) na aba info
- Mural App: Goleadores/Craque/Melhor goleiro + Top10 Atletas/Goleiros em colunas Pelada | Confrontos (`rankingsPelada`/`TeamMatch`, `voteAggregates*` , `peladaGoals`/`teamMatchGoals` sem peso 3x nos gols)
- Participantes `team_match`: `sortTeamMatchRegistrationRows` apos enrich (home → away → apelido)
- Alerta GK confronto: Cloud `getTeamMatchGoalkeeperAlerts` para presidente/treinador do lado; UI sem CTAs de pelada
- **Arquivos:** `09-events-*`, `16-match-challenge`, `11-profiles-search`, `07-mural`, convocation-panel, inbox, athlete-profile-view, mural*, event-detail
- **Deploy:** republicar `cloud/main.js`

### 2026-09-16 — Participantes, convocacao, mural 3x, CPF

- Participantes (admin/publico): `age`, `appAverageScore` (media ponderada app), `teamName` via `enrichEventRegistrationListRows`
- Confronto: card **Convocacao** (`event-detail-convocation-panel`) — add/remove atleta; `athleteConvocationBy` president|coach; Cloud `createTeamMatchAthleteInvitation` / `removeTeamMatchAthleteConvocation` / `setTeamMatchAthleteConvocationBy`
- Mural: votos e performance de `team_match` pesam **3x** (`07-mural.js`)
- Cadastro: CPF obrigatorio + unico (`registerUser` / `assertContactAvailable`); mensagem orienta login/recuperar senha
- **Arquivos:** `09-events-*`, `16-match-challenge`, `07-mural`, `04-auth-signup`, `02-core`, `event-detail`, `register`, `registration.service`
- **Deploy:** republicar `cloud/main.js`

### 2026-09-15 — Pagamento so se houve valor na convocacao

- Label verde do participante: texto de liberacao de pagamento so se `contractOfferedAmount > 0` (fallback: `RefereeInvitation.offeredAmount`)
- Aceite de convite grava `contractOfferedAmount`; join request grava 0
- Inbox: mensagem de pagamento so quando `offeredAmount > 0`

### 2026-09-15 — Confronto ≠ pelada; admin = mandante; aceite ida/volta

- Causa da "Pelada Legada": migracao legada anexava eventos sem `pelada` (incl. `team_match`) — agora exclui confrontos e desanexa pointer
- Cloud `repairTeamMatchOwnership`: unset pelada + admin/ACL = presidente do `homeTeam` (por perna)
- `goBack` de confronto → `/tabs/events` (fim do loop detalhe ↔ Pelada Legada)
- Ida: admin = presidente mandante; volta: admin = presidente do mandante da volta (desafiado)
- Desafio `hasReturnLeg`; no aceite o desafiado informa `returnChallengeConditions`
- Removido tipo `team_match` de `event-create` (pelada)
- **Deploy:** republicar `cloud/main.js`

### 2026-09-15 — Condicoes privadas + atletas nao convocados

- `getTeamMatchMatchdaySummary`: `challengeConditions` so para presidentes (ou admin do evento)
- Flags `homeAcceptsUninvitedAthletes` / `awayAcceptsUninvitedAthletes` (toggle por presidente no detalhe)
- Classe `TeamMatchJoinRequest` + Cloud `requestTeamMatchParticipation` / `respondTeamMatchParticipation` / `listMyTeamMatchJoinRequests` / `setTeamMatchAcceptsUninvitedAthletes`
- CTA confrontos: "Solicitar participacao" (sem inscricao aberta de atleta); inbox Entrada/Saida + ver perfil; push `team_match_join_*`
- beforeSave `EventRegistration`: bloqueia atleta em `team_match` sem `invitedByContract` (exceto master)
- **Arquivos:** `16-match-challenge.js`, `10-pelada.js`, `event-detail`, `inbox`, `team-match-join-request.service.ts`, `registration.service.ts`
- **Deploy:** republicar `cloud/main.js`

### 2026-09-15 — Desafio com data/local + convocacao

- Desafio exige `proposedStart/End/Address`; Cloud `assertTeamsFreeForProposedMatch` no envio e no aceite
- Convocacao: perfil atleta + valor opcional (`matchRate` / `athleteInvites`); avatar do presidente no convite
- Convocacao ida+volta: um convite por data; titulo na inbox distingue Ida/Volta
- Aceite de convite: `checkInviteeScheduleConflict` antes de marcar accepted
- Feed publico de confrontos (proximidade) mantido

### 2026-09-15 — Confrontos publicos e volta

- **Arquivos:** `09-events-registrations.js`, `event.service.ts`, `events.page.*`, `event.model.ts`
- Feed `listTeamMatchesForFeed` (todos os usuarios); aba Confrontos ordena por proximidade + badge Proximo
- Busca de eventos ordena por proximidade; `team_match` tambem filtra por nome dos times
- Ida+volta: `returnEventId` no desafio; `attachReturnLegsForTeamMatches` no listMy; volta grava matchChallenge/conditions
- **Deploy:** republicar `cloud/main.js`

### 2026-09-15 — Desafio/confronto: inbox e lista

- **Arquivos:** `16-match-challenge.js`, `09-events-registrations.js`, `inbox.page.*`, `desafio-create`, `match-challenge.service.ts`, `referee-invitation.service.ts`, `user-bar`
- **0:** `challengeConditions` no `MatchChallenge` (envio no desafio; exibido na entrada; prefill em `confronto-create`; fallback no `createTeamMatch`)
- **1–2:** Inbox com segmento Entrada/Saida; desafios enviados pendentes/respondidos na Saida; badge soma convites + desafios pendentes + remarcacoes
- **3:** `listMyTeamMatches` usa pointers de time + merge via `MatchChallenge.eventId` (presidente desafiado)
- **Deploy:** publicar `cloud/main.js` gerado (build 2026.09.15.0118+)

---

## Mapa rapido — 13 perfis → superficies

| # | Papel | Codigo | Paginas / paineis principais | Servicos / Cloud |
|---|-------|--------|------------------------------|------------------|
| 01 | Atleta | `athlete` | `event-register`, `event-detail`, `event-team-split`, `event-mural`, `athlete-profile-*` | `registration`, `event`, `09-events-*` |
| 02 | Juiz | `referee` | `event-sumula`, inbox convite, hiring auxiliares | `referee-sumula`, `referee-invitation`, `08-*` |
| 03 | Scout / Mesario | `scout` | `event-scout-apontamento`, hiring auxiliares | `scout-apontamento`, `08-*` |
| 04 | Jornalista | `journalist` | `event-journalist-journal`, mural media jornal | `12-event-media` |
| 05 | Cinegrafista | `cameraman` | `event-cameraman-coverage`, mural media video | `12-event-media`, hiring |
| 06 | Narrador | `narrator` | `event-narrator-radio`, mural media radio | `12-event-media` |
| 07 | Treinador | `coach` | `event-coach-board` | `support-role-tools`, `14-support-roles` |
| 08 | Preparador Fisico | `physical_trainer` | `event-physical-trainer` | `support-role-tools`, `14-*` |
| 09 | Massagista | `masseur` | `event-masseur-treatments` | `support-role-tools`, `14-*` |
| 10 | Roupeiro | `kitman` | `material-inventory`, painel material em `event-detail` | `material-inventory`, `13-material` |
| 11 | Gandula | `gandula` | inscricao/chegada; apoio em campo (event-detail) | `registration`, `09-*` |
| 12 | Porteiro | `gatekeeper` | `event-gate-scan`, `event-gate-entries` | `event-gate-ticket`, `06-gate-tickets` |
| 13 | Torcedor | `fan` | `event-predictions`, `event-fan-checkin`, mural | `08-*` palpites, `14-*` check-in |

Rotas: `src/app/app-routing.module.ts`. Labels: `src/app/core/models/profile-role.model.ts`.

---

## Gotchas recorrentes (nao redescobrir)

1. Paginas Ionic cacheadas → recarregar em `ionViewWillEnter` + `cdr.markForCheck()` (OnPush).
2. `isEffectivelyConfirmed` define ingresso QR, votacao e limite de atletas (client + Cloud `09`).
3. Cloud Code: editar so `cloud/source/` → `npm run build:cloud` → publicar `cloud/main.js`.
4. Listas admin com ACL → preferir Cloud Function (master key no servidor).
5. Juiz entra so via convite (`RefereeInvitation`), nao inscricao aberta tipica.
6. Workspace atual **sem pasta `.git`** (2026-07-20) — backup por arquivo zip em `D:\Ita\git\backups\`.

---

## Backups conhecidos

| Data | Artefato | Notas |
|------|----------|-------|
| 2026-07-20 | `D:\Ita\git\backups\minhapelada-2026-07-20-pre-audit.zip` (~11 MB) | Snapshot pre auditoria: src, cloud, docs, scripts, android (sem builds), configs |

---

## Auditorias / sessoes

### 2026-09-14 — Remarcacao bilateral de confronto

- `rescheduleTeamMatch` grava proposta pendente; outro presidente aceita/recusa (`respondTeamMatchReschedule`).
- Inbox + detalhe do evento; push `team_match_reschedule_request` / `_response`.
- Sem presidente adversario: aplica na hora (comportamento anterior).

### 2026-09-14 — P2 varios times + historico na Busca

- Cap 5 times/presidente; `listMyAmateurTeams`; `createMatchChallenge` exige `challengerTeamId`.
- team-form lista/edicao; perfil “Meus times”; desafio com select do desafiante.
- Busca segment **Times** + Cloud `listAmateurTeamMatchHistory`.
- Remarcacao bilateral (P2 item 3) ainda nao implementada.

### 2026-09-14 — Push elenco + agenda confronto

- `collectTeamMatchNotifyUserIds` (elenco, presidentes, confirmados, contratados aceitos).
- Cloud `cancelTeamMatch` / `rescheduleTeamMatch`; card **Agenda do confronto** no detalhe.
- Push cancel/remarcacao inclui motivo (`lastScheduleChangeReason`).

### 2026-09-14 — Desafio + elenco + UX wizard/foto

- Wizard: passo atleta nao avanca ate salvar; overlay pausado em `/athlete-profile/form`.
- Image picker: ActionSheet i18n (sem `CameraSource.Prompt` em ingles).
- Team: fundacao, escudo, sede, descricao, venue; edicao; elenco `AmateurTeamMembership`; media idade em `listAmateurTeamsForLegend`.
- `MatchChallenge` antes de `createTeamMatch`; inbox aceitar/recusar; `/desafio-create`, `/team/:id`.
- Event detail: placar/gols/arbitro via `getTeamMatchMatchdaySummary`.
- Publicar `cloud/main.js` (modulos 15 e 16).

### 2026-09-12 — Screenshots cap. 09 (Push) integrados

- Recebidos de `D:\Ita\Projetos\Minha_Pelada_Controle_de_Bola\imagens\Manual`:
  - `26-menu-notificacoes.jpeg` (menu com toggle ativo)
  - `27-bandeja-push.jpeg` (aviso real na bandeja do Android)
  - `28-notificar-participantes.jpeg` (opcao com sino no detalhe do evento)
  - `28-2-notificar-participantes.jpeg` (modal de envio de mensagem)
  - `29-card-envio-push.jpeg` (card de confirmacao do envio ao criar evento)
- Copiados para `controledebolasite/public/guia/` e referenciados em `09-notificacoes.mdx`.
- Build do site validado sem erros (`npm run build`).

### 2026-09-12 — Notificar participantes sumia

- Tile so aparecia com `confirmedParticipants.length > 0`; grade some ao abrir Configuracoes/Participantes.
- Agora: botao fixo abaixo do resumo + tile sempre para admin + atalho em Configuracoes. Sem confirmados, explica em alerta.

### 2026-09-12 — Confrontos na barra + Buscar

- Buscar: `ion-segment` Eventos/Perfis em toolbar **dentro do content** (`search.page.html` + `.search-segment-bar`). Nao colocar segundo `ion-header` nas abas.
- Aba **Confrontos** em `tabs.page.html` (`/tabs/events`). Criar: `/confronto-create`. Cloud `createTeamMatch` / `listMyTeamMatches` / `listTeamMatchInboxNotices`. Publicar `main.js`.
- Mandante pode cadastrar time na hora (`returnUrl`). Visitante so pesquisa. Ida/volta + convocacao de atletas do mandante.
- Manual site: `controledebolasite/src/content/guia/10-confrontos.mdx`. Push ainda precisa dos prints 26–28.

### 2026-09-11 — P0 confrontos (times no Event)

- `Event.homeTeam`/`awayTeam` pointers + nomes. Inscricao/convite/admin: `teamSide`.
- Criar evento: picker `listAmateurTeamsForLegend`. Split de palpite/sumula usa `teamSide` (metade da lista so se ninguem tiver lado).
- Convocacao de atleta: hiring panel + inbox. Cloud `setEventRegistrationTeamSide`. Publicar `main.js`.
- P1 (elenco, proposta entre presidentes) ainda nao.

### 2026-09-11 — Push ok; lendas; confrontos (auditoria)

- Usuario confirmou push (menu + criar evento + card de aparelhos/pessoas). Removido **Testar notificacao** do menu. `sendTestPushToSelf` fica na Cloud so para diagnostico.
- Lendas: busca sem acento; hub/widget dizem “ja existe, use a lista” ou “cadastre nova”; Cloud recusa nome/apelido duplicado. Publicar `05-legends.js`.
- Confrontos: **nao ha fluxo de primeira classe**. `team_match` e evento de pelada com nomes string. Plano: `docs/PLANO-CONFRONTOS-TIMES.md` (reusar Event/inbox/mural; P0 pointer AmateurTeam). Nao implementar P1 sem combinado.
- Manual site cap. 09: prints `26-menu-notificacoes.jpeg` e `27-bandeja-push.jpeg`.

### 2026-09-11 — itacolomy nao recebeu push de evento novo (Uniao)

- Causa mais provavel: Cloud publicado ainda com `isNew()` (afterSave nunca disparava). Segundo risco: publico so de inscricoes antigas; `request.original` truthy no create.
- Agora: publico = socios ativos + inscricoes da pelada; create = sem `original.id`; app chama `notifyNewPeladaEventCreated`; flag `pushNewEventSentAt`. Diagnostico: `diagnoseNewPeladaEventPush`.
- Precisa publicar `cloud/main.js`. O aparelho do **admin que cria** o evento precisa da build nova so para o disparo explicito; o afterSave vale apos o publish.

### 2026-09-11 — Push + botao tapado na barra do Android

- `new_pelada_event` nao disparava: `afterSave` usava `isNew()` (sempre false apos save). Agora create = `!request.original`. Publicar `cloud/main.js`.
- Job `sendEventRemindersTwoHoursJob` continua dependendo de agendamento no Back4App (10–15 min).
- Samsung: `html.native-android` + `--app-bottom-inset` 56px em content/footer/tab-bar. `StatusBar.setOverlaysWebView(false)`.
- Manual: `controledebolasite` cap. 09. Faltam prints `26-menu-notificacoes`, `27-bandeja-push`, `28-notificar-participantes`.

### 2026-09-11 — Biometria falhava apos Sair do App

- Causa: o botao so reaproveitava a sessao Parse. `logout()` → `clearLocalSession()` apagava o token; o flag `biometric_enabled` sozinho nao reloga.
- Agora o aparelho guarda identificador+senha em `biometric_creds` (Ionic Storage). Logout nao apaga isso. Login mostra imagem da digital (`assets/icon/fingerprint.svg`). Menu **Cadastrar biometria**.
- Site Download: botoes Google Play (teste interno) e App Store (`id6801505260`) em `controledebolasite/src/pages/download.astro`.

### 2026-09-10 — PELADA DO UNIAO so mostrava evento com inscricao aberta

- `eventService.listForPelada` buscava so `endTime >= agora` + passados em que o usuario estava inscrito. Narrador/jornalista sem inscricao antiga via so o jogo aberto.
- Agora a aba Eventos da pelada lista todos. O feed (`listForFeed`) continua upcoming + participados.

### 2026-09-10 — Contato + SMTP sem env vars

- Charles: nao da para credencial de e-mail em Environment Variables. SMTP passa a ser a classe `MailSettings` (1 objeto, CLP so master). Cloud `configureMailSettingsClassPermissions`.
- Formularios `/contact/feedback` → contato@controledebola.com.br e `/contact/support` → suporte@controledebola.com.br (nome/apelido so leitura).
- Reset de senha usa o mesmo `sendAppMail`. Publicar `main.js` + criar o objeto MailSettings.

### 2026-09-10 — Reset de senha nao chegava no Hotmail

- Causa: `Parse.User.requestPasswordReset` depende do `emailAdapter` do suporte; o app fingia sucesso e o e-mail nao saia (Hotmail inbox/spam vazios).
- Fluxo novo: Cloud `requestPasswordResetEmail` + `confirmPasswordReset` (OTP 6 digitos, nodemailer, env `SMTP_*`). UI no login: codigo + senha nova.
- Header do login mostra `APP_RELEASE.label` para identificar a build.
- Publicar `cloud/main.js` e cadastrar `SMTP_HOST/PORT/USER/PASS/FROM` no Back4App — sem isso a Cloud falha de proposito. Doc: `docs/BACK4APP-ZOHO-SMTP.md`.

### 2026-09-09 — AAB 99 para Google Play

- Gerado `android/app/build/outputs/bundle/release/app-release.aab` (13.85 MB), `versionCode` 99 / `2026.09.09.0099`.
- IPA **nao** disparar agora: Apple ja rejeitou a 92 por screenshots; falta iPhone + TestFlight + 5 prints. Disparar `release-ipa` so apos o teste interno da Play neste codigo.

### 2026-09-09 — App Links: assetlinks.json no ar

- Site `controledebolasite` `731f9b4`: `public/.well-known/assetlinks.json` com SHA-256 da **upload key** (`64:A3:5D:86:...:89:5A`). Pacote `com.minhapelada.app`.
- AASA iOS **nao** publicado (placeholder `APPLE_TEAM_ID`).
- Falta SHA da **App signing key** da Play Console para APKs instalados pela Play.
- Manifesto do app ja tem `autoVerify` em `/app`, `/invite`, `/download`.

### 2026-09-09 — Pos-deploy: Sobre + landing /app

- Sobre: link **Manual de uso** → `https://controledebola.com/guia` (site ja tinha controledebola.com; "Em breve" e so redes sociais).
- Site: `/app`, `/invite` e `assetlinks.json` com SHA-256 da upload key. Falta SHA da Play App Signing e Team ID iOS.

### 2026-09-09 — Manual, Mural da pelada e inspect

- Site: prints em `controledebolasite/public/guia/`; MDX 01–06 ilustrados (mural evento 11–11-8 + **#12 mural da pelada**). Lista 1–20 completa.
- Pelada Mural: `ion-segment` no A37 nao dispara clique/ionChange (console vazio). Trocado por botoes HTML `.pelada-tab`.
- Inspect: `MainActivity` liga WebView debug so em `BuildConfig.DEBUG`. Doc `docs/ANDROID-CHROME-INSPECT.md` — nao se digita `com.minhapelada.app`. Print do usuario: so o SM-A376B, sem WebView (app fechado ou APK nao DEBUGGABLE).
- Charles: perguntou se o SMTP esta ok. Humano testa reset e responde o ticket (`docs/BACK4APP-ZOHO-SMTP.md`).

### 2026-09-09 — Login, Wizard por conta, mural e inspect

- Login: logo + **Controle de Bola** no header; "Entrar" no conteudo.
- Wizard: `wizard_tour_dismissed` / `offered` por `userId` (`app-storage.service.ts`). Troca de conta reseta `autoTried`. Card com X no header.
- Pelada Mural: `loadSegmentData` / `loadMural` com try/catch + `markForCheck`; `@for` com `?? []`.
- Chrome inspect no A37: APK **release** nao e debuggable. Usar `npm run install:android:debug` (app em primeiro plano → `chrome://inspect/#devices` → `com.minhapelada.app`). Repo GitHub permanece publico (Actions iOS gratis).

### 2026-09-09 — Alertas ilegíveis após paleta / Dark-Claro

- `ion-alert` e `ion-action-sheet` em `global.scss`: texto e botoes com contraste fixo por `data-surface` (nao usam o primary da paleta).
- Sair no menu: fecha `app-menu` antes do alerta. Cortina de tema: fecha o modal antes de perguntar.

### 2026-09-08 — Wizard sequencial (seguir / pular / fechar)

- `WizardTourService` + `app-wizard-tour` no `app.component`. Auto-abre so se o usuario nao fechou e nao tem pelada/socio/inscricao/time alem do perfil.
- Menu **Usar o Wizard** (`menu.wizard`) reabre do passo 1. Dicas de pagina (`app-coach-hint`) ficam ocultas; o cartao da home Peladas deixou de ser permanente.

### 2026-09-08 — Logo, Sair no menu e fundo Dark/Claro

- Logo `assets/icon/logo_controle_de_bola.png` no `user-bar` antes do avatar. Icones: home, mail, hamburger. Sair so no `ion-menu` (`app.component`).
- Superficie `dark` padrao (`dark.class.css` + `ion-palette-dark`); chip Claro na cortina; persistencia `app_surface`. Hex de papel claro so em `theme-palette.model.ts`.

### 2026-09-08 — Header: bandeiras de idioma e seletor visual de tema

- `app-locale-flags` e `app-theme-picker` no SharedModule; confirmacao via `AlertController` antes de `I18nService.setLocale` / `ThemePaletteService.setPalette`.
- Segunda toolbar em `user-bar` (bandeiras + botao Tema). Perfil reutiliza os mesmos componentes (sem `ion-select`).
- Swatches hex so em `theme-palette.model.ts`. Sem Cloud Code.

### 2026-07-27 — Doc: rodar Cloud Functions no Back4App

- Criado `docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md`: API Console so tem REST/GraphQL/JS; `configure*` via **REST POST** `/functions/NOME` + Master Key.
- `configureEventMediaClassPermissions` ok em producao (criou 5 classes de midia). Javascript sem Master Key falha com "Faca login...".
- Links em `AGENTS.md`, guia e `EVENT-MEDIA.md`.

### 2026-07-26 — Video de melhores momentos + engajamento imprensa

- Cobertura do cinegrafista: pagina `event-cameraman-coverage` (upload video ≤5 min, titulo/descricao, sobrescreve no mural).
- Hub Imprensa: botao **Video**; views unicas, reacoes Facebook, 1 comentario/usuario.
- Narrador: descricao obrigatoria; jornalista/narrador/cinegrafista com engajamento no mural do evento.
- Tops por views no mural da pelada e do app (`getTopEventMedia` + `app-mural-media-top-card`).
- Cloud 12 + docs `EVENT-MEDIA.md`. Apos deploy: `configureEventMediaClassPermissions`.

### 2026-07-20 — Setup cache + plano de testes por perfil

- Criados: este cache, regra `.cursor/rules/agent-activity-cache.mdc`, `docs/PLANO-TESTES-PERFIS.md`.
- Backup zip da versao atual (sem `node_modules` / artefatos de build).
- Delegacao de 13 agents exploradores (um por perfil) para bugs/UX.
- Resultados consolidados: ver `docs/AUDITORIA-PERFIS-RESULTADOS.md` (apos agents).

---

### 2026-09-07 — App Store aprovada + refinamentos (ondas)

- iOS 1.0 **Pronto para distribuicao**. Icone generico na lista do Connect e metadado 1024 da ficha; PNG de marca em `ios-config/AppIcon.appiconset/AppIcon-1024.png` (humano: Informacoes do app).
- Plano: `docs/PLANO-REFINOS-POS-APP-STORE.md`. Reset: `passwordResetEnabled: true` + `docs/BACK4APP-ZOHO-SMTP.md`. PIX Inter: so memo (`docs/VIABILIDADE-PIX-INTER.md`), sem API.
- i18n `I18nService` + pipe `t` + JSON em `src/assets/i18n/` (pt-BR, es-ES, en-GB). Seletor em Perfil.
- Paletas: `ThemePaletteService` + `html[data-palette]` em `src/theme/variables.scss`. Persistencia em `AppStorageService`.
- Coach: `CoachService` na home Peladas; overlays `app-coach-hint` em pelada-form, event-create, team-split, mural, sumula, scout, lendas, inscricao, atleta. Menu Ajuda + Manual (`AppGuideService` → https://controledebola.com/guia).
- Screenshots do manual: `docs/MANUAL-SCREENSHOTS-PEDIDOS.md` (usuario envia). Sem Lottie/API Inter/Cloud nesta leva.
- Zoho: senha antiga revogada; senha nova enviada so ao Charles (2026-09-07). Sem segunda troca apos o teste, salvo vazamento. Aguardando Charles ligar o `emailAdapter`.
- Cloud Code SMTP: `cloud/package.json` publicado em Functions & Web Hosting (`backend.back4app.com/…/cloud_code`). Modulos `parse-mail-smtp-adapter` + `nodemailer`. Sem senha no repo.
- Apple recusou IPA `1.0.3` (90062/90186): trem 1.0.3 ja aprovado/fechado. Marketing no `package.json` agora **1.0.4**. No Connect: criar versao 1.0.4 e anexar o novo build.

### 2026-09-02 — Visibilidade do repo GitHub

- Remote: `https://github.com/itacolomymariano/controledebola` permanece **publico** de proposito: no plano Free, Actions em repo privado cobra minuto de **macos** (10x) e o `release-ipa` estouraria a cota.
- Nao tornar privado enquanto o CI iOS rodar neste repo, salvo se houver plano pago ou outro runner.
- Agents locais nao dependem da visibilidade. Nao commitar `environment.local.ts` nem keystores.

### 2026-09-01 — Rejeicao 2.3.3 (screenshots) + iPhone-only

- Apple reviu **1.0 (92)** no iPad Air 11" (M3). Recusou screenshots 6.5" e 13" (nao mostram o app em uso).
- Sem Mac/iPad: binario **iPhone-only** (`TARGETED_DEVICE_FAMILY = 1` em `scripts/apply-ios-review-config.js`). Connect deixa de exigir slot 13".
- Proximo IPA: **1.0.3 (93)**. Reenviar so com 5 prints reais do iPhone (Peladas, evento, Mural, Buscar, Perfil).
- No iPad o app abre em modo compatibilidade.

### 2026-08-31 — Archive IPA falha em IONCameraLib

- Causa: `xcodebuild archive` com `PROVISIONING_PROFILE=UUID` aplica o perfil App Store a todos os targets SPM. `IONCameraLib` (dependencia de `@capacitor/camera`) nao aceita perfil.
- Fix: nao passar `PROVISIONING_PROFILE` / `CODE_SIGN_STYLE=Manual` no comando; `scripts/apply-ios-app-target-signing.js` assina so o target App. Export continua no `ExportOptions.plist`.
- Reexecutar **novo** `release-ipa` (nao Re-run do job antigo).

### 2026-08-31 — Segunda rejeicao ainda na 1.0 (79)

- Apple reviu o **mesmo** Submission ID / binary 1.0 (79), nao a 1.0.1 (92).
- Ajustes para 1.0.2: endereco **obrigatorio** (eventos proximos + rankings locais, com texto na UI e justificativa a Apple); foto via `@capacitor/camera`; exclusao direto no Perfil.
- Reenvio: selecionar compilacao 1.0.2 na ficha; video nas Notes; icone 1024 na metadata.
- Procedimento: `docs/APP-STORE-REVIEW.md`.

### 2026-08-27 — Rejeicao App Store (1.0/79)

- Icones: `resources/icon.png` + `ios-config/AppIcon.appiconset`; CI `scripts/apply-ios-review-config.js`.
- Cadastro/Meus dados: e-mail obrigatorio; celular, nascimento e endereco opcionais (`registerUser`, `updateUserAccount`).
- Foto de perfil: textos de camera/galeria no Info.plist iOS; compressao HEIC sem crash.
- Exclusao permanente: UI em Perfil/Meus dados + Cloud `deleteMyAccount`.
- Procedimentos (screenshots iOS + video): `docs/APP-STORE-REVIEW.md`.
- Marketing version iOS: `package.json` `1.0.1`.

## Pendencias abertas

- [ ] Publicar `cloud/main.js` no Back4App (inclui `deleteMyAccount` e campos opcionais)
- [ ] App Store 2.3.3: IPA 1.0.3 iPhone-only + 5 screenshots reais do iPhone; so entao Submit
- [x] Actions `release-ipa` 1.0 (92) no TestFlight / revisao 01/09
- [x] Consolidar achados dos 13 agents → `docs/AUDITORIA-PERFIS-RESULTADOS.md`
- [x] Correcoes P0/P1 iniciais (porteiro, material, scout, juiz accept, midia, palpites, hiring remoto cameraman/narrador, CTAs gandula/cinegrafista)
- [ ] Publicar tambem Cloud pendente anterior (votacao por usuario, sumula periodo, PF pre-inicio, hiring search, etc.)
- [x] Voto por `_User` (nao por perfil): ballot atomico + agregacoes dedupe + midia sem re-voto
- [x] Sumula: edicao so no periodo juiz; consulta apos encerramento para qualquer perfil
- [x] PF: `savePhysicalTrainerSession` so antes de `startTime`
- [ ] P1 restantes: times so apos fim; massagista edit; material reload
- [ ] Avaliar restaurar historico git ou `git init` + remoto

### 2026-07-23 — Push "Notificar participantes" nao chegava

- Causa: Installation Android sem `pushType=gcm`; query de Push reutilizada apos `count`; feedback contava usuarios e nao aparelhos.
- Fix: `registerPushDevice` grava `pushType/GCMSenderId/userId`; query fresca no send; `backfillAndroidPushInstallations`; UI reporta `devicesMatched`.
- Apos publicar Cloud: rodar `backfillAndroidPushInstallations` no Back4App; participante deve abrir o app logado 1x.

### 2026-07-23 — Push: admin nao recebia no proprio aparelho

- Causa: `sendEventConfirmedParticipantNotification` excluía `user.id` (remetente) da lista; admin testando em si mesmo nunca via a notificação.
- Fix: incluir remetente se for confirmado; resolver Installations por `objectId` antes do `Parse.Push.send`; payload com `android_channel_id`; canal Capacitor `event_messages`.
- Diagnóstico: Cloud `diagnosePushForContact({ email|phone })` e `sendTestPushToSelf()`.

### 2026-07-23 — Push FCM v1 sem bandeja (9 aparelhos / alvo real nao recebe)

- Causa: adaptador `@parse/push-adapter` FCM v1 so monta `android.notification` se o payload tiver chave `notification`; so `alert`/`title` vira data-only e o Capacitor nao exibe na bandeja.
- Fix: `rawPayload` com `notification` + `android.notification.channelId` + `data` plano; toast em foreground; `diagnoseEventPushTargets`.
- Conferir no Back4App: Android Push com **Firebase Service Account** (FCM HTTP v1), nao so Server Key legada.

### 2026-07-23 — rawPayload estava no lugar errado

- Causa: `rawPayload` ia dentro de `data`; o adaptador so honra `rawPayload` no **topo** do `Parse.Push.send` (irmão de `where`).
- Fix: `Parse.Push.send({ where, rawPayload, data })`; UI reporta se itacolomy (`P7BjbL2z5G`) entrou no lote.

### 2026-07-23 — Gemini Firebase: canal + token test

- Confirma: precisa `notification` + `android.notification.channel_id` = canal Capacitor (`event_messages`).
- `diagnosePushForContact` com Master Key devolve `deviceToken` completo para teste no Firebase Console.
- Atenção: os “N aparelhos” hipotéticos nao provam que o FCM esta ok — so o Motorola real conta.

### 2026-07-23 — Push: token segue o aparelho logado

- Causa do “nao chega no Motorola”: itacolomy logado no Samsung — FCM entrega no Samsung (deep link OK).
- Cleanup: removido focus hardcoded itacolomy na UI; `registerPushDevice` grava `deviceModel`/`deviceLabel` para o diagnose distinguir aparelhos.

### 2026-07-24 — Push P0 engajamento conservador

- Doc: `docs/PUSH-NOTIFICATIONS.md` (inventário + princípios).
- P0: lembrete 2h (`sendEventRemindersTwoHoursJob`), convite/resposta hiring (`afterSave RefereeInvitation`), remarcação/cancelamento (`afterSave Event`).
- Agendar job no Back4App a cada 10–15 min após publicar Cloud.

### 2026-07-22 — Admin na lista + birth-date-picker restaurado

- Lista Peladas: flag "Voce e o Admin" (texto visivel; `isCurrentUserAdmin` preserva flag Cloud + adminId).
- Meus dados: restaurado `app-birth-date-picker` (regressao `type="date"`). Docs: `docs/UI-DATAS-NASCIMENTO.md`, regra Cursor `birth-date-picker.mdc`, AGENTS.md.

### 2026-07-22 — Time amador em Meus dados + Voltar

- `suggestFavoritePeladaTeams`: prioriza `AmateurTeam` com varredura ate 500 (antes so primeiros 20 sem filtro util).
- Meus dados (`account-edit`): botao **Voltar** no header e no rodape.

### 2026-07-22 — Voto usuario / sumula periodo / PF pre-inicio

- Cloud `submitEventMuralBallot` + voto so com `isEffectivelyConfirmed`; rankings/agregados dedupe por `voterId`.
- `getFavoriteProTeamStats` ja contava por usuario; midia: 1 voto por usuario/categoria.
- Sumula: `canEdit` = juiz + janela `sumulaOpensAt/ClosesAt` + evento nao encerrado; tile/consulta pos-fim.
- PF: bloqueio Cloud + UI apos `event.startTime`.

### 2026-07-20 — Hiring PF/massagista/roupeiro + UF DF

- Busca em Negociacao: `searchProfiles` agora resolve RoleProfile por `userId` (nao so pointer), hidrata `_User` sem nome, e o client sempre mescla cloud + fallback server.
- Brasilia: geocode/display corrigem `FE` → `DF` (`address-geocoding`, `normalizeBrazilUf`, form + `formatAddress`).

### 2026-07-21 — Sumula consulta / contratados / vagas / goleiros

- Sumula: msg distinta para view-only (nao-juiz) vs evento encerrado.
- Contratados (`invitedByContract`): card sem PIX/pagamento validado; titulo "Contratacao confirmada".
- Lista eventos pelada: "vaga(s) restante(s) para atletas".
- Admin: alerta + banner se < 2 goleiros confirmados nas ultimas 48h de inscricao.

### 2026-07-21 — PF Personal Trainer + UF DF na lista de peladas

- Perfil Preparador Fisico: campo money `athleteRate` — "Por quanto atua como Personal Trainer?"
- Exibicao FE→DF: `normalizeAddress` em pelada/event load + `formatPeladaLocation` (lista Peladas).

### 2026-07-21 — Aceite de convite infinito ("Aceitando convite...")

- Inbox: loading ficava ativo durante `alert.onDidDismiss()` e bloqueava o dialogo — afetava Gandula e todos os perfis.
- Corrigido: dismiss do loading antes do alerta de sucesso/erro; mesmo padrao em confirmacao de pagamento, hiring pessoal e reset de senha.

### 2026-07-20 — Busca "prep" nao achava Preparador

- Alias de papel (`prep`/`pf`/…) + inclusao de `_User.primaryRole` em `searchProfiles`.
- ACL de leitura publica em `RoleProfile` (beforeSave + backfill em `configureMuralClassPermissions`) — ACL so do dono impedia find client-side.
- Client: `role-search.util.ts`, race guard na searchbar, filtro da contratacao pessoal usa aliases.

### 2026-07-20 — Contagem eventos realizados + complemento local

- Feed peladas: `heldEventCount` em `listPeladasForFeed` — conta eventos com `teamSplit` salvo (`hasSavedTeamSplit`); UI em `peladas.page.html`.
- Lista eventos da pelada: exibe so o texto de `locationComplement` (sem label).
- Publicar `cloud/main.js` no Back4App para a contagem server-side (ha fallback client).

### 2026-07-20 — Correcoes aplicadas pos-auditoria

- Porteiro: scan/entries no painel quando `canManageGateTools`
- Roupeiro: contagem cega exige campos preenchidos
- Scout Cloud: exclusividade de atleta no `incrementScoutApontamento`
- Juiz: aceite marca convite antes da inscricao (+ recover)
- Torcedor: `goalScorers.clear()` ao reentrar predictions
- Hiring: modo presencial/remoto para cameraman e narrator
- Jornal/Radio: `loadDashboard` no enter; timeout de gravacao fecha UI
- CTAs informativos: Cobertura (cinegrafista) e Apoio em campo (gandula)
