# Auditoria Play Console e i18n — 2026-10-08 (atualizado 2026-10-09)

Escopo: revisão orientada a release (sem substituir smoke humano nem revisação jurídica da Play).

## Play Console (Android)

| Item | Estado | Referência |
|------|--------|------------|
| targetSdk / compileSdk 36 | OK | `android/variables.gradle`, `AGENTS.md` |
| R8 minify release | OK | `android/app/build.gradle` `minifyEnabled true` + `proguard-rules.pro` |
| Insets Android 15+ (Samsung) | OK | `StatusBar.setOverlaysWebView({ overlay: false })` + `html.native-android` / `--app-bottom-inset`; sem `EdgeToEdge` no `MainActivity` (regressao faixa nativa "Controle de Bola") |
| Pacote `com.minhapelada.app` | OK | `android/app/build.gradle` |
| Exclusão de conta no app | OK | Perfil → Excluir conta; Cloud `deleteMyAccount` |
| Política de privacidade / site | Verificar no Console | `APP_SITE_URL` em `app-invite-share.service.ts` |
| Permissões sensíveis (câmera, notificações) | Revisar declarações no Console | Capacitor plugins em `package.json` |
| Data safety (formulário Play) | Preenchimento manual | Auth Parse, mensagens, localização opcional |

## i18n (pt-BR, en-GB, es-ES)

| Área | Severidade | Achado | Status |
|------|------------|--------|--------|
| Separação de times | — | `teamSplit.*` (60 chaves) paridade pt/en/es; página migrada | **OK** (2026-10-09) |
| `coach.wizard.*` | — | Paridade 3 idiomas | OK |
| `team.requestJoin*` | — | Paridade 3 idiomas | OK |
| Inbox UI + alertas TS | — | `inbox.*` (~140 chaves) pt/en/es; página migrada | **OK** (2026-10-09) |
| `event-detail` alertas | Alta | Confronto/participação/cancelamento/remarcação + headers Erro/Sucesso | **Parcial** (2026-10-09) |
| `event-role-hiring-panel` | Alta | Convite, conflito de agenda, toasts | **OK** (2026-10-09) |
| `account-edit` / `profile` | Alta | Exclusão/senha/logout em PT | Pendente |
| Painéis evento (convocação, participantes, admin) | Média | Status/labels inline PT | Pendente |
| `team-profile` toast join | Média | Sucesso só em PT (botão já i18n) | Pendente |
| `team-form` | Média | Loading/erros PT | Pendente |
| Cards Melhor/Top Pelada | — | `\| t` | OK |
| Home Times FAB | — | `peladas.createTeam` | OK (en/es) |
| Wizard | — | `coach.back` + ramos | OK (en/es) |
| profile-setup / role-profile-fields | Média | Labels profissionais no modelo | Pendente |
| Formulário juiz (toggles) | — | Corrigido | OK |

## Smoke sugerido por idioma

1. Menu → **Idioma** → en-GB e es-ES: Home, Mural, **Evento → Separação de times** (modos manual, aleatório, soleiros×casados, coração, idade), Perfil, Caixa de entrada.
2. Confirmar que botões do wizard, mural e separação de times não misturam PT com EN/ES na mesma tela.
3. Play: instalar AAB de teste interno; login, exclusão de conta (conta descartável), push opt-in.

## Deploy Cloud desta entrega

Publicar `cloud/main.js` após: ranking peladas + join elenco + **persistência `splitMode` preset (`maritalSides`, `favoriteTeamSides`, `ageSides`) e `ageThreshold`**.
