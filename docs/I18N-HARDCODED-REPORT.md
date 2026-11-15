# Relatório i18n — strings fixas (2026-11-15)

## Onda 6 — concluída

| Gate | Resultado |
|------|-----------|
| `npm run check:i18n` | **2510** chaves pt/en/es, paridade OK |
| `npm run check:i18n:scan` (v1) | **0** hits P0–P3 |
| `npm run check:i18n:scan:v2` (ampliado) | **0** hits P0–P3 |
| `npm run check:i18n:strict` | OK (P0+P1 v1) |
| `npm run check:i18n:strict:v2` | OK (P0+P1 v2) |
| `npm run build` | OK |

### Infra nova

- [`scripts/scan-i18n-hardcoded-v2.js`](../scripts/scan-i18n-hardcoded-v2.js) — `alertCtrl` / `loadingCtrl`, tags HTML extras, PT sem acento
- [`scripts/i18n-wave6-extra.js`](../scripts/i18n-wave6-extra.js) — chaves onda 6 (mesclado em `i18n-coverage-extra.js`)
- Inventário: [`I18N-WAVE6-BACKLOG.md`](I18N-WAVE6-BACKLOG.md), [`I18N-SCAN-V2-REPORT.json`](I18N-SCAN-V2-REPORT.json)

### Áreas migradas (resumo)

| Tier | Escopo |
|------|--------|
| T1 | `event-detail.page.html`, pelada-detail (TS alerts/erros) |
| T2 | `athlete-profile-view`, `profile-view` |
| T3 | `profile`, `login`, `account-edit` (reuso parcial) |
| T4 | imprensa/apoio (narrador, jornalista, cinegrafista, massagista, técnico, súmula, scout…) |
| T5 | `confronto-create`, `desafio-create`, `team-form`, `team-profile` |
| T6 | `event-role-hiring-panel`, `user-bar`, `mural-share` |

### Fora do escopo desta onda

- Cloud Code (`cloud/source/`) — mensagens server-side
- `throw new Error` massivo em `core/services/` (~200) — candidato W6-G futuro
- Recursos nativos Android/iOS

## Comandos (gate local)

```bash
npm run check:i18n
npm run check:i18n:scan
npm run check:i18n:scan:v2
npm run check:i18n:strict
npm run check:i18n:strict:v2
```

Fonte da verdade: `src/assets/i18n/pt-BR.json`.