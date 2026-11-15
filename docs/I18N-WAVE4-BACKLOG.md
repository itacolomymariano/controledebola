# i18n onda 4 — backlog (scan 2026-11-15)

| Tier | Hits (pós onda 4) | Foco |
|------|-------------------|------|
| **P0** | alvo 0 após pelada cotinhas | smoke Xaiana |
| **P1** | convocação, material, pelada-form, events | concluído (agente) |
| **P2/P3** | **0** hits (scan 2026-11-15 pós-onda 5) | `scripts/i18n-wave5-extra.js` concluído |

## Infra (onda 4)

- Menu idioma: Action Sheet + `I18nService.applyAppLocale`
- `ApplicationRef.tick()` em `setLocale`
- `locale$` em tabs, mural hub, profile
- `scripts/i18n-wave4-extra.js` (cotinhas, caixa, mensalidades, P1)

## Comandos

```bash
npm run check:i18n
npm run check:i18n:scan
npm run check:i18n:strict
node scripts/apply-i18n-code-migration.js
```

Inventário: [I18N-FULL-INVENTORY.md](I18N-FULL-INVENTORY.md)