## Perfil: Porteiro (gatekeeper)

### Fluxos analisados
O1 scan Â· O2 entries Â· O3 `gateTicketControlEnabled` Â· O4 ticket sÃ³ com `isEffectivelyConfirmed` (emissÃ£o Cloud/client) Â· CTAs Portaria em `event-detail`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P0** `event-detail.page.ts` (`gateActionTileRows` ~511â€“541 + `toggleGatePanel` ~1118â€“1121): porteiro confirmado (`canManageGateTools`) vÃª tile Portaria, mas aÃ§Ãµes scan/entries sÃ³ existem se `isAdmin`; ramo nÃ£o-admin sÃ³ â€œVisualizar ingressoâ€ com `canViewMyGateTicket===false` para gatekeeper â†’ painel vazio / toast â€œNenhuma acao de portariaâ€¦â€. Deep-link funciona; CTA nÃ£o.
- **P1** `06-gate-tickets.js` `validateEventGateTicket`: nÃ£o revalida `computeRegistrationEffectiveConfirmation` no scan â€” token ativo entra mesmo se confirmaÃ§Ã£o cair depois (O4 sÃ³ na emissÃ£o).
- **P1** `event-gate-entries.page.ts` `load()`: erro vira lista vazia (sem catch) â†’ â€œNenhum participanteâ€¦â€ enganoso.
- **P2** `event-gate-scan.page.html`: `alreadyEntered` + `valid:true` usa card success â€œIngresso validoâ€ (deveria ser aviso).
- **P2** `canViewMyGateTicket`: nÃ£o exige `isEffectivelyConfirmed` para atleta (sÃ³ bloqueia gatekeeper).

### Melhorias UX
Incluir scan/entries em `gateActionTileRows` quando `isGatekeeper`; feedback Ã¢mbar p/ reentrada; pull-to-refresh + erro explÃ­cito na lista; botÃ£o â€œLer outroâ€ no scan.

### Facilidade (1-5)
Descoberta **1** Â· Clareza **3** Â· Feedback **3** Â· Mobile **3** Â· Autonomia **1** â†’ **mÃ©dia 2,2**

### Arquivos-chave
`src/app/pages/event-detail/event-detail.page.ts` Â· `event-gate-scan/*` Â· `event-gate-entries/*` Â· `event-gate-ticket.service.ts` Â· `cloud/source/06-gate-tickets.js`
