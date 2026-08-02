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
npm run install:android      # build + sync + APK release assinado (dispositivo)
npm run build:android:aab    # AAB para Google Play Console (teste interno / producao)
```

**Google Play (AAB):** saídas em `android/app/build/outputs/bundle/release/app-release.aab`. Pacote: `com.minhapelada.app` (nao alterar apos o 1º upload). A Play exige AAB (nao APK) para apps novos. Keystore local (`android/keystore.properties` + `android/*.keystore`, no `.gitignore`) e a **upload key** — faca backup seguro; com Play App Signing a Google guarda a chave de assinatura do app.

**iOS (GitHub Actions, sem Mac local):**

```bash
# CI: build production + cap sync ios (apos pasta ios/ existir no runner)
npm run build:ios:ci
```

Workflow: `.github/workflows/ios-capacitor-build.yml` (runner `macos-15`). Guia completo: [docs/IOS_GITHUB_ACTIONS.md](docs/IOS_GITHUB_ACTIONS.md). Bundle ID: `com.minhapelada.app`. Secrets: `ENVIRONMENT_LOCAL_TS` (obrigatorio); `IOS_DISTRIBUTION_*` so para IPA.

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
| Contratacao | `event-detail` (hiring panel), `inbox` | `referee-invitation.service` |
| Push | (Cloud + bandeja) | `push-notification.service` — inventário em `docs/PUSH-NOTIFICATIONS.md` |
| Mural | `mural`, `event-mural` | `mural.service`, `mural-highlights.service` |
| Imprensa / Midia | `event-cameraman-coverage`, `event-narrator-radio`, `event-journalist-journal`, `event-mural-media` | `event-media.service` — [docs/EVENT-MEDIA.md](docs/EVENT-MEDIA.md) |
| Perfis | `profile`, `profile-setup`, `role-profile-form` | `athlete/role/fan-profile.service` |
| Portaria | `event-gate-scan`, `event-gate-entries` | `event-gate-ticket.service` |
| Apoio (treinador/PF/massagista/torcida) | `event-coach-board`, `event-physical-trainer`, `event-masseur-treatments`, `event-fan-checkin` | `support-role-tools.service` |

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
| `02-core.js` | Conta, login |
| `03-push-notifications.js` | Push |
| `04-auth-signup.js` | Cadastro anti-bot |
| `05-legends.js` | Lendas |
| `06-gate-tickets.js` | Ingressos QR |
| `07-mural.js` | Rankings, votos, CLP |
| `08-scout-referee-performance.js` | Scout, sumula, palpites |
| `09-events-registrations.js` | Inscricoes, chegada, convites |
| `10-pelada.js` | Socios, apresentacao perfil |
| `11-profiles-search.js` | Busca perfis |
| `12-event-media.js` | Radio, jornal, video (melhores momentos), engajamento |
| `13-material.js` | Inventario pelada/ropeiro, sessao de material no evento |
| `14-support-roles.js` | Treinador, preparador fisico, massagista, check-in torcedor |

Apos deploy: rodar `configureMuralClassPermissions`, `configureMaterialClassPermissions`, `configureSupportRolesClassPermissions` e `configureEventMediaClassPermissions` no Back4App (CLP de `MuralVote` e classes de midia: escrita so via Cloud).

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

---

## Documentacao adicional

- [README.md](README.md) — setup inicial
- [docs/UI-DATAS-NASCIMENTO.md](docs/UI-DATAS-NASCIMENTO.md) — anti-regressao do picker dia/mes/ano
- [docs/back4app-cloud-functions.md](docs/back4app-cloud-functions.md)
- [docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](docs/BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md) — rodar Cloud Functions no API Console (REST + Master Key)
- [docs/back4app-fase1.md](docs/back4app-fase1.md) … [fase6](docs/back4app-fase6-referee-invitations.md)
- [docs/IOS_GITHUB_ACTIONS.md](docs/IOS_GITHUB_ACTIONS.md) — build iOS na nuvem (GitHub Actions)
