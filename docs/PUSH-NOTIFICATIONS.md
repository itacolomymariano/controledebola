# Push notifications — inventário e engajamento

Complementa `AGENTS.md` e o guia de arquitetura. Envio real: `cloud/source/03-push-notifications.js`.

## Quem recebe (autorização)

Só chega push se **todas** forem verdadeiras:

1. Usuário está no público do disparo (tabela abaixo).
2. `_User.pushNotificationsEnabled !== false` (default: ligado; toggle no **menu** do app).
3. Existe `Installation` com `deviceToken` (permissão OS + registro no app).

Cloud: `setPushNotificationsEnabled` / `getPushNotificationsEnabled`. Desligar desvincula Installations.

## Disparos atuais (P0 + existentes)

| Tipo (`data.type`) | Quando | Destinatário | Origem |
|--------------------|--------|--------------|--------|
| `new_pelada_event` | Novo `Event` | Sócios ativos + quem já se inscreveu na pelada (admin do evento excluído) | `afterSave` Event (create = sem `original.id`) **e** Cloud `notifyNewPeladaEventCreated` após o save no app. Flag `Event.pushNewEventSentAt` evita duplicar |
| `team_match_created` | Cloud `createTeamMatch` | Elenco ativo dos dois times + presidentes + confirmados + contratados aceitos (exceto quem criou) | `collectTeamMatchNotifyUserIds` + `notifyTeamMatchStakeholders`. Convocados tambem recebem `hiring_invite` |
| `match_challenge` | Cloud `createMatchChallenge` | Presidente desafiado | Push + inbox |
| `match_challenge_response` | Cloud `respondMatchChallenge` | Presidente desafiante | Aceite ou recusa com motivo |
| `profile_presentation_request` | Registration → pending | Admin da pelada | `afterSave` EventRegistration |
| `profile_presentation_approved` / `_rejected` | Admin resolve apresentação | Participante | Cloud em `10-pelada.js` |
| `event_admin_message` | Admin “Notificar participantes” | Confirmados efetivos | Cloud + UI `event-detail` |
| `event_journal_reportage` | Cloud `publishEventJournalReportage` | Confirmados efetivos (exceto jornalista) | `12-event-media.js` |
| `hiring_invite` | Novo `RefereeInvitation` pending | Convidado | `afterSave` RefereeInvitation |
| `hiring_response` | Convite accepted/declined | Quem convidou | `afterSave` RefereeInvitation |
| `event_reminder_2h` | Job ~2h antes do `startTime` | Confirmados efetivos do evento | Job `sendEventRemindersTwoHoursJob` |
| `event_rescheduled` | `startTime` muda ≥15 min (ou aceite de remarcacao bilateral) | Confirmados efetivos; em `team_match`, elenco + contratados | `afterSave` Event; motivo via `lastScheduleChangeReason` |
| `event_cancelled` | `isFinished` antes do `startTime` | Confirmados efetivos; em `team_match`, elenco + contratados | `afterSave` Event; motivo via Cloud `cancelTeamMatch` |
| `team_match_reschedule_request` | Cloud `rescheduleTeamMatch` (proposta) | Presidente(s) adversario(s) | Push + inbox |
| `team_match_reschedule_response` | Cloud `respondTeamMatchReschedule` | Quem pediu a remarcacao | Aceite ou recusa |
| `team_match_join_request` | Cloud `requestTeamMatchParticipation` | Presidente do time solicitado | Push + inbox Entrada |
| `team_match_join_response` | Cloud `respondTeamMatchParticipation` | Atleta solicitante | Aceite (inscreve) ou recusa |
| `push_self_test` | Diagnóstico | Usuário logado | `sendTestPushToSelf` |

## Infra (sem mensagem ao usuário)

`registerPushDevice`, `unregisterPushDevice`, `setPushNotificationsEnabled`, `getPushNotificationsEnabled`, `notifyNewPeladaEventCreated`, `diagnoseNewPeladaEventPush`, `backfillAndroidPushInstallations`, `pruneStalePushInstallationsForUser`, `diagnosePushForContact`, `diagnoseEventPushTargets`.

## Job de lembrete (Back4App)

1. Cloud Code → **Jobs** → `sendEventRemindersTwoHoursJob` → agendar a cada **10–15 min**.
2. Ou chamar `runEventRemindersTwoHours` (Master Key) para teste manual.
3. Campo `Event.pushReminder2hSentAt` evita reenvio; é limpo se o evento for remarcado.

## Princípios anti-spam

- Push só com ação clara ou risco de perder o evento.
- Preferir inbox/in-app para ranking e curiosidade.
- Não implementar broadcasts de marketing / streaks / like a like.
- Roadmap P1 (votação mural, cotinha) só após medir abertura dos P0.

## Deep links (cliente)

`src/app/core/services/push-notification.service.ts` → `navigateFromPayload`.

## UI

Menu lateral → toggle **Notificacoes**. Ao criar evento, o admin ve quantos aparelhos receberam o aviso. `sendTestPushToSelf` permanece na Cloud só para diagnóstico (sem botão no app).
