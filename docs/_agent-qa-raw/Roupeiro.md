## Perfil: Roupeiro (kitman)
DocumentaÃ§Ã£o: complexa â€” AGENTS.md + plano Â§10 (label UI: **Ropeiro**)

### Fluxos analisados
- **K1** InventÃ¡rio `ownerType=kitman` (Perfil â†’ Material do Ropeiro)
- **K2** Painel Material no `event-detail` (tile sÃ³ se `registration.role === 'kitman'`)
- **K3** SessÃ£o: origem pelada|kitman|none â†’ carregar â†’ enviar â†’ contagem cega/avarias â†’ (pelada) devoluÃ§Ã£o/baixas

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P0** `event-detail.page.ts` `onMaterialSubmitBlindCount`: campo vazio â†’ `?? 0` â†’ divergÃªncia falsa + avaria 0.  
- **P1** `event-detail-material-panel` `canLoad` + Cloud `loadEventMaterial`: sem trava de `status`; â€œCarregarâ€ apÃ³s `sent`/`received` zera linhas.  
- **P1** `13-material.js` `submitEventMaterialBlindCount`: nÃ£o exige `status==='sent'`; `applyInventoryDamagesFromConference` **soma** avarias de novo no reenvio.  
- **P1** UI `isEventKitman` sÃ³ vÃª `EventRegistration`; Cloud aceita tambÃ©m `RefereeInvitation` â€” tile Material pode sumir com convite ok.  
- **P2** Nomenclatura Ropeiro vs Roupeiro; troca de origem sem confirm apaga sessÃ£o.

### Melhorias UX
- Validar contagem cega obrigatÃ³ria por linha; confirmar reload/troca de origem; esconder Carregar pÃ³s-envio; unificar label Roupeiro; deep-link â€œMaterial do Ropeiroâ€ no hint do painel.

### Facilidade (1-5)
Descoberta **4** Â· Clareza **3** Â· Feedback **3** Â· Mobile **3** Â· Autonomia **4** â†’ **mÃ©dia 3,4**

### Arquivos-chave
`material-inventory.page.ts/html` Â· `event-detail-material-panel.*` Â· `event-detail.page.ts` Â· `material-inventory.service.ts` Â· `material-inventory.model.ts` Â· `cloud/source/13-material.js` Â· `profile.page.html`
