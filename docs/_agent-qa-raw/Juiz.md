## Perfil: Juiz (referee)

### Fluxos analisados
J1 inbox aceitar â†’ `registerFromInvitation` + save `RefereeInvitation` Â· J2 `/event/:id/sumula` batch save Â· J3 hiring bandeiras (supplementary) Â· J4 `event-register` exclui `referee` Â· CTAs `event-detail` sumula

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P0** `referee-invitation.service.ts` `accept` + `registration.service.ts` `registerFromInvitation`: cria inscriÃ§Ã£o **antes** de marcar convite `accepted`; se o save do convite falha, retry â†’ â€œja esta inscritoâ€ e convite fica `pending`.
- **P1** `08` `assertCanViewRefereeSumula` vs `assertConfirmedRefereeForEvent`: GET com `canEdit=true` ignora `sumulaOpensAt/ClosesAt`; save chama `assertWithinApontamentoWindow` â†’ juiz edita e sÃ³ falha ao salvar.
- **P1** `event-sumula.page.ts`: dirty local sem `ionViewWillLeave`/guard â€” sair perde apontamentos (sÃ³ â€œSALVAR SUMULAâ€).
- **P1** `09` `createSupplementaryEventInvitation` + `inbox.page.ts`: bandeira usa `role: 'referee'`; ao aceitar, `needsSupplementary` dispara de novo â€œContratar bandeirasâ€.
- **P1** `registerFromInvitation`: qualquer inscriÃ§Ã£o prÃ©via no evento bloqueia aceite do convite de juiz (sem upgrade de papel).
- **P2** `event-sumula.page.html`: `isLocked = locked || !canEdit` mostra â€œEvento encerradoâ€ para consulta de nÃ£o-juiz mesmo com evento aberto.
- **P2** `08` penaltis em campos compartilhados (`penaltiesCommitted/Suffered`) â€” scout e juiz sobrescrevem (overlap sÃ³ em gols/faltas/cartÃµes).

### Melhorias UX
- CTA sumula: espelhar scout (`canAccessRefereeSumula` vs consultar); hoje `canAccessRefereeSumula` estÃ¡ morto.
- Mostrar janela de sÃºmula no board; autosave ou sticky save + confirmaÃ§Ã£o ao sair.
- Aceite/upgrade de papel via Cloud atÃ´mica; bandeira com `supplementaryKind` sem reabrir hiring.

### Facilidade (1-5)
Descoberta 3 Â· Clareza 3 Â· Feedback 3 Â· Mobile 4 Â· Autonomia 3 â†’ **mÃ©dia 3,2**

### Arquivos-chave
`src/app/pages/event-sumula/*` Â· `referee-sumula.service.ts` Â· `inbox.page.ts` Â· `referee-invitation.service.ts` Â· `registration.service.ts` Â· `event-detail.page.ts` Â· `event-register.page.ts` Â· `cloud/source/08-scout-referee-performance.js` Â· `cloud/source/09-events-registrations.js`
