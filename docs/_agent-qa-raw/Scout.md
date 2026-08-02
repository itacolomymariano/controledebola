## Perfil: Scout / Mesario (scout)

### Fluxos analisados
S1 board `/event/:id/scout` Â· S2 persistÃªncia/`statsConflictSource` Â· S3 auxiliares (`marking_assistant`) Â· S4 mobile Â· CTAs `event-detail`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P0** `cloud/source/08-scout-referee-performance.js` â€” `assertScoutAthleteAssignment` existe (L578) mas **nunca Ã© chamada** em `incrementScoutApontamento` (L823â€“894). Modo Geral usa `allAthletes` e altera qualquer atleta; exclusividade multi-scout Ã© sÃ³ UI.
- **P1** `event-detail.page.ts` â€” sem rota/CTA para `supplementary-hiring?mode=assistants`; S3 sÃ³ no alert pÃ³s-aceite em `inbox.page.ts` (L105â€“120).
- **P1** `event-detail` `canEditScoutApontamento` + board `locked` â€” UI libera se `!isFinished`; Cloud exige `scoutApontamentoOpensAt/ClosesAt` (`assertWithinApontamentoWindow`). Controles ativos fora da janela â†’ erro sÃ³ no save.
- **P1** `incrementScoutApontamento` â€” RMW sem atomicidade; dois scouts no mesmo atleta sobrescrevem.
- **P2** `statsConflictSource` â€” sÃ³ em `pelada-detail`; resoluÃ§Ã£o em `resolveEffectivePerformanceStats` (L199); board scout nÃ£o indica se scout ou juiz prevalece.
- **P2** `assignScoutApontamentoAthlete` â€” atribuiÃ§Ã£o irreversÃ­vel (â€œjÃ¡ apontando outro atletaâ€).

### Melhorias UX
Chamar `assertScoutAthleteAssignment` no increment (ou separar papel mesÃ¡rio). CTA â€œAuxiliaresâ€ no evento. Refletir janela no `locked`. Badge da fonte vencedora. Atalhos gerais fixos (menos scroll).

### Facilidade (1-5)
Descoberta **3** Â· Clareza **3** Â· Feedback **4** Â· Mobile **3** Â· Autonomia **3** â†’ **mÃ©dia 3,2**

### Arquivos-chave
`src/app/pages/event-scout-apontamento/*` Â· `src/app/core/services/scout-apontamento.service.ts` Â· `cloud/source/08-scout-referee-performance.js` Â· `event-detail.page.ts` Â· `event-supplementary-hiring` Â· `inbox.page.ts` Â· `pelada-detail` (`statsConflictSource`)
