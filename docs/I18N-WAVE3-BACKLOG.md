# i18n onda 3 — backlog (scan 2026-11-14)

| Tier | Hits | Ordem |
|------|------|--------|
| **Core** | modelos/utils | 1 — `event.model`, `event-detail-display.util`, `locale-datetime`, `registration.formatRole` |
| **P0** | 70 | 2 — `pelada-detail`, `event-mural`, `mural-highlights` |
| **P1** | 61 | 3 — `event-detail-*` panels, `pelada-form`, admin-settings |
| **P2** | 96 | 4 — wizards, register, event-create |
| **P3** | 143 | 5 — restante |

## Core (bloqueia capturas en-GB)

- `src/app/core/models/event.model.ts` — `getRegistrationStatusLabel`, `getVotingStatusLabel`
- `src/app/core/utils/event-detail-display.util.ts` — overview rows + `formatEventDate` pt-BR fixo
- `src/app/core/services/registration.service.ts` — `formatRole`, `formatDateTime`
- `src/app/core/services/event.service.ts` — `registrationStatusLabel`
- `src/app/pages/pelada-detail/pelada-detail.page.html` — chip compara string PT

## P0 amostra (ver I18N-FULL-INVENTORY.md)

- `pelada-detail.page.html` (24)
- `event-mural.page.html` (24)
- `mural-highlights-panel` (19)
- `event-detail-participants-panel` (3+ no inventário P1)

## Shell

- `about.page.html`, `profile.page.html`, `legends-hub.page.html`