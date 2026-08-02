## Perfil: Cinegrafista (cameraman)

Documentacao: simples â€” AGENTS.md + secao 05 do plano.

### Fluxos analisados
- Inscricao aberta: `event-register` inclui `cameraman` em `EVENT_REGISTRATION_ROLES`.
- Hiring: painel admin em `event-detail` â†’ `event-role-hiring-panel` (role hireable).
- Presenca remota: API `confirmRemotePresence` + botao no hiring; guia promete â€œpresenca remota confirmavelâ€.
- CTAs midia em `event-detail`: Radio/Jornal existem; **nenhum** tile/rota para cameraman.
- Midia Cloud `12` / `EventMediaDashboard`: so radio + jornal â€” sem video/transmissao/highlights.

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
| Sev | Arquivo | Sintoma | Evidencia |
|-----|---------|---------|-----------|
| **P0** | `event-detail.page.ts` + rotas | Sem CTA â€œcobertura / momentsâ€ pos-confirmacao | Tiles so `narrator-radio` / `journalist-journal`; sem rota `event-*-cameraman` |
| **P0** | `event-role-hiring-panel.component.ts` | Presenca remota do cinegrafista inalcancavel | `showAttendanceMode` = so `fan`; `attendanceMode` so enviado se `isFanRole`; convite cameraman nunca fica `remote` |
| **P1** | `referee-invitation.service.ts` + hiring HTML | `confirmRemotePresence` inutil para o papel | Exige `attendanceMode === 'remote'`; botao so no painel admin; invitee sem UI propria |
| **P1** | `event-hiring.model.ts` | Hiring ignora â€œmelhores momentosâ€ | Perfil exige `*HighlightEditRate`; `suggestOfferAmount`/`formatCandidateRates` usam so `*LiveRate` |
| **P2** | `event-hiring.model.ts` | `remotePresenceRoles()` morto | Definido, nunca referenciado |

### Melhorias UX
- CTA event-detail: Transmissao / Melhores momentos (espelhar Radio/Jornal).
- Modo presencial/remoto no hiring de cameraman (e opcionalmente narrator); self-confirm no event-detail do convidado.
- Oferta com escolha Live vs Highlights (taxas ja no RoleProfile).
- Publicacao/link de stream ou clip no mural (paridade midia).

### Facilidade (1-5)
Descoberta **2** Â· Clareza **2** Â· Feedback **2** Â· Mobile **3** Â· Autonomia **1** â†’ **media 2.0**

### Arquivos-chave
`event-detail.page.ts` Â· `event-role-hiring-panel.*` Â· `event-hiring.model.ts` Â· `referee-invitation.service.ts` Â· `role-profile.model.ts` Â· `event-media.model.ts` Â· `event-register.page.ts` Â· `12-event-media.js`
