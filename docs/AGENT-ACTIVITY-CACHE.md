# Cache de Atividades dos Agents — Controle de Bola App

Documento vivo para acelerar intervencoes futuras. Complementa `AGENTS.md` e `docs/GUIA-CICLO-DE-VIDA-E-ARQUITETURA.md` — nao os substitui.

**Ultima atualizacao:** 2026-07-27 (doc API Console Cloud Functions)

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

## Pendencias abertas

- [x] Consolidar achados dos 13 agents → `docs/AUDITORIA-PERFIS-RESULTADOS.md`
- [x] Correcoes P0/P1 iniciais (porteiro, material, scout, juiz accept, midia, palpites, hiring remoto cameraman/narrador, CTAs gandula/cinegrafista)
- [ ] Publicar `cloud/main.js` no Back4App (votacao por usuario, sumula periodo, PF pre-inicio, hiring search, etc.)
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
