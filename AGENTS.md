# Controle de Bola App — Guia para Agentes

Leia este arquivo **antes** de alterar codigo, Cloud Code ou fluxos neste repositorio.

**Autoavaliacao (regra Cursor):** classifique a propria tarefa como **simples** ou **complexa** (`.cursor/rules/agent-documentation-gate.mdc`). Simples → este arquivo basta. Complexa → leia tambem o guia completo abaixo antes de editar.

**Guia completo:** [docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md](docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md)

---

## O que e este projeto

Rede social do **futebol amador** (Ionic + Angular + Capacitor + Back4App/Parse). Usuarios organizam **peladas**, participam de **eventos** com multiplos **perfis** (atleta, juiz, scout, torcedor, etc.), contratam profissionais, votam no **mural** e acompanham resultados/desempenho.

Objetivo central: **causar emocao** — refletir a pratica esportiva de forma que gere satisfacao e interacao social.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| UI | Ionic 8 + Angular 20 (NgModule, `standalone: false`, lazy modules) |
| Mobile | Capacitor 8 |
| Backend | Back4App / Parse Server 8 |
| Linguagem | TypeScript 5.9, Node 20+ |

---

## Comandos essenciais

```bash
npm install
npm start                    # http://localhost:8100
npm run build                # build producao
npm run build:cloud          # gera cloud/main.js
npx cap sync android         # sync para Android
```

**Android (PowerShell, JDK 21):**

```powershell
npm run build; npx cap sync android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run install:android        # build + sync + APK release assinado (dispositivo)
npm run install:android:debug  # APK debug — chrome://inspect/#devices (release nao inspeciona)
# Inspect: docs/ANDROID-CHROME-INSPECT.md — nao digitar o package; app aberto + DEBUGGABLE
npm run build:android:aab      # AAB para Google Play Console (teste interno / producao)
```

**Google Play (AAB):** saídas em `android/app/build/outputs/bundle/release/app-release.aab`. Pacote: `com.minhapelada.app` (nao alterar apos o 1º upload). A Play exige AAB (nao APK) para apps novos. Keystore local (`android/keystore.properties` + `android/*.keystore`, no `.gitignore`) e a **upload key** — faca backup seguro; com Play App Signing a Google guarda a chave de assinatura do app.

**Play — otimizacao DEX / Android 15+:** release com `minifyEnabled true` (`android/app/build.gradle`) e ProGuard em `proguard-rules.pro`. Android 15+ (targetSdk 36): manter `StatusBar.setOverlaysWebView({ overlay: false })` em `app.component.ts` e `--app-bottom-inset` em `global.scss` (`viewport-fit=cover`). **Nao** habilitar `EdgeToEdge.enable` no `MainActivity` ate `@capacitor/system-bars` com `insetsHandling: 'css'` estar no npm e validado na Home (manual `p23-home-portas`).

**iOS (GitHub Actions, sem Mac local):**

```bash
# CI: build production + cap sync ios (apos pasta ios/ existir no runner)
npm run build:ios:ci
```

Workflow: `.github/workflows/ios-capacitor-build.yml` (runner `macos-26`, Xcode 26). Guia completo: [docs/IOS_GITHUB_ACTIONS.md](docs/IOS_GITHUB_ACTIONS.md). Bundle ID: `com.minhapelada.app`. Secrets: `ENVIRONMENT_LOCAL_TS` (obrigatorio); `IOS_DISTRIBUTION_*` so para IPA.

**TestFlight / `release-ipa` — checklist antes do workflow (evitar falhas repetidas no altool)**

Dois numeros distintos no IPA:

| Campo iOS | Fonte no repo | Regra Apple |
|-----------|--------------|-------------|
| **CFBundleVersion** (build) | `versionCode` em [`.app-release-state.json`](.app-release-state.json) | Inteiro **maior** que o ultimo build ja enviado ao TestFlight |
| **CFBundleShortVersionString** (versao de loja) | `version` em [`package.json`](package.json) (ex. `1.0.6`) | Ate **3** segmentos numericos; **nao** usar o label `2026.10.20.0267` |

O job usa runner **`macos-26`** (Xcode 26 / iOS 26 SDK). Upload: `xcrun altool` + secrets `APP_STORE_CONNECT_*`.

**A) Build number (409 DUPLICATE / `previousBundleVersion`)**

1. App Store Connect → **TestFlight** → anote o **Build** mais recente (ex. 208).
2. Local: `versionCode` **>** esse numero.
3. Subir: `node scripts/bump-app-release.js` ou `npm run build` (prebuild).
4. **Commit + push** de `.app-release-state.json`, `app-release.ts`, `android/app/build.gradle`.
5. No log: `iOS version … (NNN)` com `NNN` novo.

**B) Chaves API App Store Connect (falha no step *Upload IPA to TestFlight*, log `ContentDelivery.Uploader` / autenticacao)**

Conferir **antes** de cada `release-ipa` (Settings → Secrets → Actions):

1. **`APP_STORE_CONNECT_KEY_ID`** — Key ID de 10 caracteres (igual ao nome `AuthKey_XXXXXXXXXX.p8`). **Nao** confundir com Team ID (`3MZ…`).
2. **`APP_STORE_CONNECT_ISSUER_ID`** — Issuer ID (UUID) no topo de App Store Connect → **Users and Access** → **Integrations** → App Store Connect API.
3. **`APP_STORE_CONNECT_API_KEY`** — conteudo **inteiro** do `.p8` (linhas `BEGIN PRIVATE KEY` / `END PRIVATE KEY`), colado como secret multilinha. Sem aspas extras; se colou com `\n` literais, o workflow normaliza — preferir quebras de linha reais.
4. Papel da chave: **Admin** ou **App Manager** com acesso ao app `com.minhapelada.app`.
5. Chave revogada ou `.p8` perdido → criar nova chave no Connect e **atualizar os 3 secrets**; depois **Run workflow** novo (nao so Re-run).

**C) Versao de marketing / trilha fechada (90186 / 90062)**

Quando o altool mostra **`Invalid Pre-Release Train`** (`90186`) ou **`CFBundleShortVersionString … must contain a higher version than … previously approved`** (`90062`), a versao de loja em [`package.json`](package.json) (ex. `1.0.6`) **ja foi aprovada ou fechada** no App Store Connect — nao aceita mais builds nessa trilha.

1. App Store Connect → app → **TestFlight** / versao em preparacao: confirme a ultima **versao de marketing** aprovada ou fechada (ex. `1.0.6`).
2. Suba **so** o marketing: edite `package.json` `"version"` para o proximo patch (ex. **`1.0.7`**). **Nao** confundir com `versionCode` / label `2026.*`.
3. **Commit + push** de `package.json` (e `package-lock.json` se alterado).
4. **Run workflow** `release-ipa` na `main` nova; no log: `iOS version 1.0.7 (267)` (build pode continuar o `versionCode` atual se ainda for > ultimo build TestFlight).
5. No Connect, crie ou selecione a versao **1.0.7** ao anexar o build (se o Connect pedir).

Outros:

- **SDK version issue** → workflow em `macos-26`.
- Acordos pendentes no Connect → resolver antes do upload.

**D) Depois do run**

1. Leia o log **completo** do step *Upload IPA to TestFlight* (linhas apos `ERROR: [ContentDelivery.Uploader…]` — `Validation failed`, `ITMS-`, `authentication`, `409`).
2. Se o upload falhar mas **Upload IPA artifact** tiver sucesso, baixe **`ios-release-ipa`** e envie manualmente (Transporter no Mac) ou corrija secrets e rode workflow novo.
3. **Nao** use *Re-run* para corrigir bump ou secrets — use **Run workflow** na `main` atualizada apos commit/push.

Detalhes: [docs/IOS_GITHUB_ACTIONS.md](docs/IOS_GITHUB_ACTIONS.md) (secoes 3 e 7).

---

## Estrutura rapida

```
src/app/core/     models, services (37), guards, utils
src/app/pages/    ~45 paginas lazy-loaded
src/app/shared/   componentes reutilizaveis
src/app/tabs/     navegacao (Peladas, Buscar, Mural, Perfil)
cloud/source/     Cloud Code modular (01-12) — EDITAR AQUI
cloud/main.js     GERADO — nao editar
docs/             documentacao (guia completo + fases Back4App + iOS Actions)
.github/workflows/  CI (iOS Capacitor Build)
```

---

## Regras criticas

### Faca

- Leia [docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md](docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md) para contexto de fluxos e modelo de dados
- Edite Cloud Code **somente** em `cloud/source/*.js`, depois `npm run build:cloud`
- Publique `cloud/main.js` no Back4App apos alterar Cloud Code
- Use `ionViewWillEnter` para recarregar dados (paginas sao cacheadas pelo Ionic)
- Chame `cdr.markForCheck()` em componentes `OnPush` apos operacoes async
- Use `parseErrorMessage()` e `handleApiError()` para erros Parse
- Configure chaves em `src/environments/environment.local.ts` (nao commitar)

### Nao faca

- **Nunca** editar `cloud/main.js` diretamente (e gerado)
- **Nunca** usar Master Key no app cliente
- **Nunca** commitar `environment.local.ts`
- Nao confiar so em ACL/CLP — autorizacao e manual nas Cloud Functions
- Nao carregar dados apenas em `ngOnInit` em paginas Ionic
- **Nunca** usar `type="date"` / calendario nativo para data de nascimento (Meus dados, cadastro, lendas). Use `app-birth-date-picker` — ver [docs/UI-DATAS-NASCIMENTO.md](docs/UI-DATAS-NASCIMENTO.md)

---

## Ciclo de vida resumido

```
splash → (onboarding?) → login/register → (profile-setup?) → tabs/peladas
```

- **AuthGuard** (`canMatch`) protege todas as rotas pos-login
- **Parse** init em `ParseService` (proxy `/parse` na web, URL real no nativo)
- **Sessao** validada server-side via `auth.validateSession()`

---

## Dominios principais

| Dominio | Paginas-chave | Servicos |
|---------|---------------|----------|
| Pelada | `pelada-detail`, `pelada-form` | `pelada.service`, `pelada-membership.service` |
| Evento | `event-detail`, `event-register`, `event-create` | `event.service`, `registration.service` |
| Confronto | aba `/tabs/events`, `desafio-create`, `confronto-create`, inbox, `team-profile` | `match-challenge.service`, `event.service` (`listTeamMatchesForFeed` publico + proximidade; `createTeamMatch` exige desafio aceito) |
| Contratacao | `event-detail` (hiring panel), `inbox` | `referee-invitation.service` |
| Push | (Cloud + bandeja) | `push-notification.service` — inventário em `docs/PUSH-NOTIFICATIONS.md` |
| Mural | `mural`, `event-mural` | `mural.service`, `mural-highlights.service` |
| Imprensa / Midia | `event-cameraman-coverage`, `event-narrator-radio`, `event-journalist-journal`, `event-mural-media` | `event-media.service` — [docs/EVENT-MEDIA.md](docs/EVENT-MEDIA.md) |
| Perfis | `profile`, `profile-setup`, `role-profile-form` | `athlete/role/fan-profile.service` |
| Portaria | `event-gate-scan`, `event-gate-entries` | `event-gate-ticket.service` |
| Apoio (treinador/PF/massagista/torcida) | `event-coach-board`, `event-physical-trainer`, `event-masseur-treatments`, `event-fan-checkin` | `support-role-tools.service` |
| Convite / App Links | Menu, Perfil, Sobre (`Convidar Amigos`) | `app-invite-share.service`, `deep-link.service` |
| Conta | `login` (reset), `register`, `account-edit`, Perfil (`Excluir conta`) | `auth.service` — reset por codigo. SMTP em `MailSettings` (nao env vars). Exclusao via `deleteMyAccount`. Biometria: `biometric-unlock.service` (credenciais no aparelho; logout nao apaga) |
| Contato | `contact/feedback`, `contact/support` | `contact-message.service` → Cloud `sendContactMessage` |
| Mensagens | `inbox` (icone de e-mail do cabecalho) | `app-message.service` → Cloud `18-app-mailbox.js`. Registro permanente por mensagem (`AppMessage`): Entrada/Saida, busca e nao lidas. Fora da caixa: socio de pelada, apresentacao de perfil e `sendContactMessage` |

**Deep links / convite:** "Convidar Amigos" compartilha o link de **teste interno** da Play
(`https://play.google.com/apps/internaltest/...`) enquanto nao houver listagem publica.
App Links do dominio: [docs/DEEP-LINKS-APP-LINKS.md](docs/DEEP-LINKS-APP-LINKS.md). Site: repo `controledebolasite`.

**Android / Play:** `compileSdk` e `targetSdk` = **36** (`android/variables.gradle`) — requisito Play a partir de 31/08/2026. AAB: `npm run build:android:aab`.

---

## Campo critico: `isEffectivelyConfirmed`

Determina confirmacao efetiva de inscricao (pagamento, isencao, convite, taxa zero). Afeta: lista publica, ingressos QR, votacao, limite de atletas. Logica em `event.model.ts` (client) e Cloud `09-events-registrations.js` (server).

---

## Event buses (RxJS)

Inscreva no construtor, recarregue em `ionViewWillEnter`, `unsubscribe` em `ngOnDestroy`:

- `eventService.onEventsChanged`
- `registrationService.onRegistrationsChanged`
- `peladaService.onPeladasChanged`
- `refereeInvitationService.onChanged`
- `authService.onProfileChanged`

---

## Cloud Code — modulos

| Arquivo | Dominio |
|---------|---------|
| `01-phone-helpers.js` | Telefone BR |
| `01b-comment-discipline.js` | Filtro de palavroes em comentarios |
| `01c-integrity-helpers.js` | Anti auto-voto / quorum / midia TOP |
| `01d-mail-helpers.js` | SMTP Zoho (`nodemailer`) via classe `MailSettings` |
| `01e-voter-reliability.js` | Peso de confiabilidade do avaliador no agregado do mural app |
| `02-core.js` | Conta, login, reset de senha (`requestPasswordResetEmail`, `confirmPasswordReset`), exclusao (`deleteMyAccount`) |
| `02b-contact-messages.js` | Criticas/sugestoes e relato de problema (`sendContactMessage`) |
| `03-push-notifications.js` | Push |
| `04-auth-signup.js` | Cadastro anti-bot |
| `05-legends.js` | Lendas |
| `06-gate-tickets.js` | Ingressos QR |
| `07-mural.js` | Rankings, votos, CLP |
| `08-scout-referee-performance.js` | Scout, sumula, palpites |
| `09-events-registrations.js` | Inscricoes, chegada, convites, `createTeamMatch` / `listMyTeamMatches` |
| `10-pelada.js` | Socios, apresentacao perfil |
| `11-profiles-search.js` | Busca perfis |
| `12-event-media.js` | Radio, jornal, video (melhores momentos), engajamento |
| `13-material.js` | Inventario pelada/ropeiro, sessao de material no evento |
| `15-amateur-teams.js` | Elenco `AmateurTeamMembership`, perfil publico, `listMyAmateurTeams`, historico |
| `16-match-challenge.js` | Desafio/aceite (`MatchChallenge`), placar, remarcacao, `TeamMatchJoinRequest` (solicitar participacao), contratacao arbitro confronto (aprovacao adversario) |
| `17-team-match-stats.js` | V/E/D e aproveitamento (usuario/time/presidente); `getMuralTeamMatchDashboard` |
| `18-app-mailbox.js` | Caixa de mensagens (`AppMessage`): `createAppMessage(s)` ao lado dos pushes, `listAppMessages`, leitura e contagem de nao lidas |

Apos deploy: rodar `configureMuralClassPermissions`, `configureMaterialClassPermissions`, `configureSupportRolesClassPermissions`, `configureEventMediaClassPermissions` e `configureAppMailboxClassPermissions` no Back4App (CLP de `MuralVote`, classes de midia e `AppMessage`: escrita so via Cloud).

**Limpeza de dados de teste (go-live):** [docs/PROD-DATA-PURGE.md](docs/PROD-DATA-PURGE.md) — Cloud `prodDataPurge` / `prodDataPurgeInventory`; exige `PROD_PURGE_SECRET` no Back4App e Master Key (nunca no cliente).

**Como rodar (API Console):** [docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md) — usar **REST POST** `/functions/NOME` com Master Key (o console nao tem opcao "Cloud Function"; Javascript sem Master Key falha nas `configure*`).

---

## Checklist rapido antes de intervir

1. Li o guia completo em `docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md`
2. Localizei pagina + servico + classe Parse / Cloud function afetados
3. Cloud Code: edito `cloud/source/` → `npm run build:cloud` → publicar
4. UI: respeito OnPush + `ionViewWillEnter`
5. Valido com `npm run build`
6. Antes de instalar no dispositivo: revisar [docs/SMOKE-TEST-PRE-INSTALL.md](docs/SMOKE-TEST-PRE-INSTALL.md)

---

## Documentacao

- **Nao e automatica** em cada ajuste pequeno: atualizo `docs/` e `AGENTS.md` quando a mudanca altera fluxo, Cloud Function, modelo de dados ou regra de negocio relevante.
- Tarefas **complexas** (multiplos modulos, Cloud Code, ACL): atualizar tambem o guia completo em `docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md`.
- Regressoes: preferir Cloud Functions para listas admin; recarregar dados em `ionViewWillEnter`; rodar smoke test antes de instalar.
- **Cache de atividades:** `docs/AGENT-ACTIVITY-CACHE.md` (mapa de perfis, gotchas, sessoes). Consultar no inicio de tarefas; atualizar apos intervencoes relevantes. Regra: `.cursor/rules/agent-activity-cache.mdc`.
- **Plano de testes por perfil:** `docs/PLANO-TESTES-PERFIS.md`.
- **Fluxo sequencial (ciclo de vida):** `docs/FLUXO-TESTES-CICLO-DE-VIDA.md` — cadastros → pelada → evento → dia do jogo → mural.

---

## Documentacao adicional

- [README.md](README.md) — setup inicial
- [docs/UI-DATAS-NASCIMENTO.md](docs/UI-DATAS-NASCIMENTO.md) — anti-regressao do picker dia/mes/ano
- [docs/back4app-cloud-functions.md](docs/back4app-cloud-functions.md)
- [docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md) — rodar Cloud Functions no API Console (REST + Master Key)
- [docs/back4app-fase1.md](docs/back4app-fase1.md) … [fase6](docs/back4app-fase6-referee-invitations.md)
- [docs/IOS_GITHUB_ACTIONS.md](docs/IOS_GITHUB_ACTIONS.md) — build iOS na nuvem (GitHub Actions)
- [docs/APP-STORE-REVIEW.md](docs/APP-STORE-REVIEW.md) — rejeicoes Apple e procedimentos no App Store Connect
- [docs/FLUXO-TESTES-CICLO-DE-VIDA.md](docs/FLUXO-TESTES-CICLO-DE-VIDA.md) — roteiro sequencial de testes (cadastros e ciclo de vida)
- [docs/SMOKE-TEST-PRE-INSTALL.md](docs/SMOKE-TEST-PRE-INSTALL.md) — smoke curto pre-instalacao
- [docs/PLANO-TESTES-PERFIS.md](docs/PLANO-TESTES-PERFIS.md) — matriz por perfil
- [docs/PLANO-CONFRONTOS-TIMES.md](docs/PLANO-CONFRONTOS-TIMES.md) — times amadores e confronto (`team_match`; nao forkar Event)
