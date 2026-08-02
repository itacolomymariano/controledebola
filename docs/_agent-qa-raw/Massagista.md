## Perfil: Massagista (masseur)
DocumentaÃ§Ã£o: complexa â€” AGENTS.md + plano Â§09

### Fluxos analisados
- M1 Fila: CTA `event-detail` â†’ `/event/:id/masseur-treatments` â†’ `listMasseurTreatments`
- M2 Ficha: form â†’ `upsertMasseurTreatment` (sempre create; sem `objectId`)
- M3 PÃ³s-jogo: sÃ³ option `phase=post`; sem fluxo/recuperaÃ§Ã£o dedicado
- Auth Cloud: upsert exige `masseur` + `isEffectivelyConfirmed`; list admin OU prÃ³prio massagista
- Alertas mural: `getEventSupportOpsSnapshot` (limited/out); CF `getEventMasseurAlerts` sem client

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `event-masseur-treatments.page.ts` â€” nÃ£o atualiza ficha (M2): `submit()` nunca envia `objectId`; itens da lista nÃ£o editÃ¡veis; Cloud aceita update mas UI sÃ³ cria.
- **P1** `event-masseur-treatments.page.html` â€” pÃ³s-jogo (M3) incompleto: â€œRetorno ao jogoâ€ + default `pre`/`cleared` nÃ£o guiam recuperaÃ§Ã£o; fase `post` Ã© sÃ³ select.
- **P2** `event-detail.page.ts` `canAccessMasseurTreatments` â€” admin sem CTA (Cloud lista para admin; UI sÃ³ `role === 'masseur'`).
- **P2** `support-role-tools.service.ts` â€” `getEventMasseurAlerts` Ã³rfÃ£o no client.
- **P2** HTML form â€” lista de atletas vazia deixa submit sempre invÃ¡lido, sem empty-state.

### Melhorias UX
- Tap no histÃ³rico â†’ editar status/fase; chips para regiÃ£o/tipo; filtro por momento.
- PÃ³s-jogo: preset recuperaÃ§Ã£o + label â€œStatusâ€ condicional Ã  fase.
- CTA â€œAtendimentos do massagistaâ€; bloco â€œAlertas (limited/out)â€ na prÃ³pria tela.

### Facilidade (1-5)
Descoberta **4** Â· Clareza **3** Â· Feedback **3** Â· Mobile **3** Â· Autonomia **3** â†’ **mÃ©dia 3,2**

### Arquivos-chave
`event-masseur-treatments.page.ts/html` Â· `support-role-tools.service.ts` Â· `support-role-tools.model.ts` Â· `event-detail.page.ts` Â· `cloud/source/14-support-roles.js` Â· `mural-support-ops-card`
