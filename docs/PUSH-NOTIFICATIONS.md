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
| `new_pelada_event` | Novo `Event` | Quem já participou de evento da pelada (admin excluído) | `afterSave` Event |
| `profile_presentation_request` | Registration → pending | Admin da pelada | `afterSave` EventRegistration |
| `profile_presentation_approved` / `_rejected` | Admin resolve apresentação | Participante | Cloud em `10-pelada.js` |
| `event_admin_message` | Admin “Notificar participantes” | Confirmados efetivos | Cloud + UI `event-detail` |
| `hiring_invite` | Novo `RefereeInvitation` pending | Convidado | `afterSave` RefereeInvitation |
| `hiring_response` | Convite accepted/declined | Quem convidou | `afterSave` RefereeInvitation |
| `event_reminder_2h` | Job ~2h antes do `startTime` | Confirmados efetivos do evento | Job `sendEventRemindersTwoHoursJob` |
| `event_rescheduled` | `startTime` muda ≥15 min | Confirmados efetivos | `afterSave` Event |
| `event_cancelled` | `isFinished` antes do `startTime` | Confirmados efetivos | `afterSave` Event |
| `push_self_test` | Diagnóstico | Usuário logado | `sendTestPushToSelf` |

## Infra (sem mensagem ao usuário)

`registerPushDevice`, `unregisterPushDevice`, `setPushNotificationsEnabled`, `getPushNotificationsEnabled`, `backfillAndroidPushInstallations`, `pruneStalePushInstallationsForUser`, `diagnosePushForContact`, `diagnoseEventPushTargets`.

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

Menu lateral → toggle **Notificacoes** (`app.component`).
