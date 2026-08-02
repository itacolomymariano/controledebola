## Perfil: Treinador (coach)

Documentacao: complexa â€” AGENTS.md + plano Â§07 (anÃ¡lise estÃ¡tica).

### Fluxos analisados
- T1 Board: `/event/:id/coach-board` â€” checklist + notas (2 times) + titulares + rotaÃ§Ãµes
- T2 PersistÃªncia: `getCoachEventBoard` / `saveCoachEventBoard` via `SupportRoleToolsService`
- T3 Acesso: CTA `canAccessCoachBoard` vs Cloud `assertEventAdminOrSupportRole` / `assertConfirmedSupportRole`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `event-detail.page.ts` (`canAccessCoachBoard` ~691) â€” admin sem CTA â€œPainel do treinadorâ€; plano T3 inclui admin. Cloud `getCoachEventBoard` aceita admin; UI nÃ£o.
- **P1** `14-support-roles.js` (`saveCoachEventBoard` ~339) â€” admin lÃª board mas **nÃ£o salva** (`assertConfirmedSupportRole` sÃ³). Inconsistente com GET + T3.
- **P1** `event-coach-board.page.ts` (`parseStarterIds` ~156) â€” titulares por texto livre; tokens sem match sÃ£o **descartados sem aviso** â†’ escala salva incompleta.
- **P2** `event-coach-board.page.ts` â€” erro de load seta `readOnly` mas **nÃ£o** `form.disable()`; sÃ³ o botÃ£o fica disabled (~104 HTML).
- **P2** form fixo em 2 times (`createTeamNoteGroup` 0/1) â€” sem vÃ­nculo a times reais do evento/team-split.
- **P2** rota sÃ³ `AuthGuard` â€” nÃ£o-coach abre URL, recebe erro Cloud e UI semi-editÃ¡vel.

### Melhorias UX
- Picker de atletas (chips) em vez de â€œapelidos ou IDsâ€
- CTA/leitura admin + save admin ou label â€œsomente leituraâ€
- Corrigir â€œFoco tatticoâ€ â†’ â€œtÃ¡ticoâ€; feedback se titular nÃ£o resolveu
- Times dinÃ¢micos a partir do evento

### Facilidade (1-5)
| Descoberta | Clareza | Feedback | Mobile | Autonomia | **MÃ©dia** |
|---|---|---|---|---|---|
| 3 | 2 | 3 | 4 | 3 | **3,0** |

### Arquivos-chave
`src/app/pages/event-coach-board/*` Â· `src/app/core/services/support-role-tools.service.ts` Â· `cloud/source/14-support-roles.js` Â· `src/app/pages/event-detail/event-detail.page.ts` Â· `src/app/core/models/support-role-tools.model.ts`
