## Perfil: Gandula (gandula)

### Fluxos analisados
- G1 InscriÃ§Ã£o: `gandula` em `EVENT_REGISTRATION_ROLES` + `RoleProfile` (taxas) + hiring (`HIREABLE_ROLES`)
- G2 CTAs `event-detail`: **zero** refs a `gandula` na pasta; tiles sÃ³ Material (kitman) / Portaria (gatekeeper) / coach|PF|massagista
- G3 Chegada/confirmaÃ§Ã£o: badge Confirmado/Pendente via `isEffectivelyConfirmed`; check-in â€œChegouâ€ **sÃ³** `role === 'athlete'`
- Comparativo UI: kitman = tile+painel+`material-inventory`; gatekeeper = tile+scan/entries; gandula = sÃ³ inscriÃ§Ã£o/perfil

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `event-detail.page.ts` (action tiles ~444â€“495): pÃ³s-inscriÃ§Ã£o sem atalho operacional â€” contraste kitman (`isEventKitman`) / gatekeeper (`isGatekeeper`+Portaria); `rg gandula` em `event-detail/` = 0
- **P1** `event-detail-participants-panel.component.html` (~103â€“140): chegada admin sÃ³ atleta â†’ gandula nunca â€œChegouâ€/ordem; plano G3 e cache falam â€œchegadaâ€
- **P2** `docs/AGENT-ACTIVITY-CACHE.md` L23 vs cÃ³digo: â€œapoio em campo (event-detail)â€ sem superfÃ­cie; guia omite capacidades de gandula/kitman na tabela de papÃ©is

### Melhorias UX
- CTA pÃ³s-confirmaÃ§Ã£o (â€œvocÃª Ã© gandula neste eventoâ€) ou checklist leve (bolas/Ã¡gua) se o papel for sÃ³ presenÃ§a
- Alinhar chegada staff (gandula/kitman/porteiro) ou documentar â€œsÃ³ atletaâ€
- Corrigir cache/guia para lacuna explÃ­cita

### Facilidade (1-5)
Descoberta **2** Â· Clareza **2** Â· Feedback **3** Â· Mobile **3** Â· Autonomia **1** â†’ **mÃ©dia 2,2**

### Arquivos-chave
`profile-role.model.ts` Â· `role-profile.model.ts` Â· `event-register.page.ts` Â· `event-hiring.model.ts` Â· `event-detail.page.ts/.html` Â· `event-detail-participants-panel.component.html` Â· `registration.service.ts` Â· (refs) `13-material.js` / gate pages
