# Relatório i18n — strings fixas (2026-11-13)

Gerado na correção completa (plano Xaiana / Play). Não bloqueia build.

## Migrado nesta entrega

| Área | Arquivo |
|------|---------|
| Evento — título, scroll, convite pós-evento, período votação | `event-detail.page.html` |
| Mural — resultados por período | `mural-period-rankings-card.*` |
| Mural — feed confrontos/pelada | `mural-app-feed.component.*` |
| Perfil — menus principais | `profile.page.html` |
| Conta — cabeçalho e validações curtas | `account-edit.page.html` (parcial) |

## Pendência conhecida (média)

- `event-detail.page.ts` — dezenas de `showError`/`showSuccess` com mensagem PT literal (headers já i18n).
- `account-edit.page.html` — wizard completo, labels de formulário e notas longas.
- `event-detail.page.html` — placar confronto, gols, árbitro (bloco team_match).
- `team-form`, `team-profile` — toasts/loading (auditoria 2026-10-08).

## Gate CI local

```bash
npm run check:i18n
```

Fonte da verdade: `src/assets/i18n/pt-BR.json` (1220 chaves, paridade en/es).