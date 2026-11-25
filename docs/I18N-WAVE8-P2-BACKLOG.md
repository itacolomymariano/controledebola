# i18n onda 8 — backlog P2 (pós-Board)

Gerado após correção P0 da aba **Board** (`/tabs/mural`). Scan v2 com `PT_HINT` ampliado: **39** hits residuais (mural P0 fora da lista; ver `I18N-SCAN-V2-REPORT.json`).

## Prioridade smoke ([I18N-SMOKE-XAIANA.md](I18N-SMOKE-XAIANA.md))

| Item smoke | Arquivos com literais PT (amostra) |
|------------|-------------------------------------|
| 2 Peladas | (varrer `peladas-list` — scan p2) |
| 5 Evento detalhe | `event-detail.page.html` (`Participante anonimo`), `event-role-hiring-panel` |
| 5b Pelada detalhe | `pelada-detail.page.html` (strings admin socios) |
| 5c Sobre | verificar `about` |
| 7 Meus dados | `account-edit` |

## Mural / imprensa (P1, fora Board)

- `shared/components/mural-support-ops-card/*` — card inteiro PT (event-mural)
- `shared/components/mural-media-top-card/*` — fallback `Autor`, `visualização` (linhas meta)
- `pages/event-mural-media/*.html` — conteúdo indisponível
- `core/services/mural-highlights.service.ts` — mensagens `throw` (trilha onda 7 serviços)

## Próximo passo sugerido

Onda 8b: smoke itens 5 / 5b / hiring panel + `mural-support-ops-card`; manter `check:i18n:scan:v2` como gate em PRs de i18n.