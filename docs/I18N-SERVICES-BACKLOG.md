# i18n — mensagens em `core/services` (onda 7+)

UI (ondas 1–6) com scan v2 **zerado**. Esta trilha cobre `throw new Error` com texto fixo nos serviços.

## Padrão

- `serviceError(key, params?)` em `src/app/core/utils/parse-error.util.ts` (usa `I18nService` via `setParseErrorI18n`).
- Chaves: `error.service.*` (genéricas) e `error.<dominio>.*` (por serviço).

## Concluído (2026-11-24)

| Serviço | Chaves |
|---------|--------|
| `role-profile.service.ts` | `error.service.loginToCreateProfile`, `loginToUpdateProfile`, `profileNotFound` |
| `referee-invitation.service.ts` | `error.refereeInvitation.*` (bloco completo) |

Script de chaves: `node scripts/i18n-wave7-services-extra.js`

## Próximos (por tamanho / impacto)

1. `registration.service.ts`
2. `auth.service.ts` (literais restantes além de `parseErrorMessage`)
3. `event-gate-ticket.service.ts`, `pelada-*.service.ts`
4. `mural.service.ts`, `event.service.ts`, `team-split.service.ts`

Estimativa residual: ~300+ literais em ~25 serviços (grep `throw new Error('`).