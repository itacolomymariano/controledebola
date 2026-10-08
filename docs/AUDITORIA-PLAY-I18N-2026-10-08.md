# Auditoria Play Console e i18n — 2026-10-08

Escopo: revisão orientada a release (sem substituir smoke humano nem revisão jurídica da Play).

## Play Console (Android)

| Item | Estado | Referência |
|------|--------|------------|
| targetSdk / compileSdk 36 | OK | `android/variables.gradle`, `AGENTS.md` |
| Pacote `com.minhapelada.app` | OK | `android/app/build.gradle` |
| Exclusão de conta no app | OK | Perfil → Excluir conta; Cloud `deleteMyAccount` |
| Política de privacidade / site | Verificar no Console | `APP_SITE_URL` em `app-invite-share.service.ts` |
| Permissões sensíveis (câmera, notificações) | Revisar declarações no Console | Capacitor plugins em `package.json` |
| Data safety (formulário Play) | Preenchimento manual | Auth Parse, mensagens, localização opcional |

## i18n (pt-BR, en-GB, es-ES)

| Área | Achado | Ação |
|------|--------|------|
| Cards Melhor/Top Pelada | Labels novos com `\| t` | OK nesta entrega |
| Home Times FAB | `peladas.createTeam` pt-BR; en/es pendente nesta rodada | Completar antes de loja |
| Pedir participação no time | `team.requestJoin*` pt-BR | en/es pendente |
| Wizard Voltar | `coach.back` pt-BR | en/es pendente |
| Inbox / pendências | Muitos títulos ainda hardcoded em PT | **Pendente** — migrar para i18n |
| profile-setup / role-profile-fields | Labels de perfil profissional em PT no modelo | **Pendente** — usar chaves i18n por role |
| Formulário juiz (toggles) | Rótulos sumiam com layout antigo | Corrigido (`ion-toggle` com label) |

## Smoke sugerido por idioma

1. Menu → **Idioma** → en-GB e es-ES: Home, Mural (Melhor Pelada), Perfil, Caixa de entrada.
2. Confirmar que botões do wizard, mural e time não misturam PT com EN/ES na mesma tela.
3. Play: instalar AAB de teste interno; login, exclusão de conta (conta descartável), push opt-in.

## Deploy Cloud desta entrega

Publicar `cloud/main.js` após ranking de peladas (admin/UF/desempate) e funções `requestAmateurTeamJoin` / `respondAmateurTeamJoin` / `listMyAmateurTeamJoinRequests`.
