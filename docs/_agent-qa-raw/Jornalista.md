## Perfil: Jornalista (journalist)

### Fluxos analisados
N1 publicar reportagem/entrevista em `/event/:id/journalist-journal` â†’ Cloud `publishEventJournal*` Â· N2 mural `Imprensa/MÃ­dia` â†’ `mural/media/journal` Â· N3 CTA `Jornal` sÃ³ se `role===journalist` + `isEffectivelyConfirmed`; Cloud `assertConfirmedRoleRegistration`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `event-journalist-journal.page.ts` â€” editor nunca chama `loadDashboard`; formulÃ¡rio sempre vazio; republicar exige nova foto (Cloud exige `photoUrl`). EvidÃªncia: `ionViewWillEnter` sÃ³ zera `loading`.
- **P1** mesma pÃ¡gina / rota â€” qualquer logado abre o editor; bloqueio sÃ³ no publish. EvidÃªncia: `AuthGuard` sem checagem de papel; N3 incompleto no cliente.
- **P1 UX** (score Clareza=2) â€” sem empty state / â€œprÃ³ximo passoâ€; tÃ­tulo â€œJornal do jornalistaâ€.
- **P2** `12-event-media.js` â€” sem `configure*CLP` para `EventMediaPublication`/`EventMediaVote` (diferente de 07/13/14); risco de write direto se CLP default aberto.
- **P2** overwrite: confirma sempre (mesmo 1Âº envio); slot Ãºnico â€” qualquer jornalista confirmado sobrescreve.

### Melhorias UX
PrÃ©-carregar manchete/corpo/foto; link pÃ³s-sucesso para mural/journal; confirmar overwrite sÃ³ se jÃ¡ existir; `capture`/cÃ¢mera no mobile; copy â€œJornal do eventoâ€.

### Facilidade (1-5)
Descoberta **4** Â· Clareza **2** Â· Feedback **4** Â· Mobile **3** Â· Autonomia **4** â†’ **mÃ©dia 3,4**

### Arquivos-chave
`src/app/pages/event-journalist-journal/*` Â· `event-media.service.ts` Â· `cloud/source/12-event-media.js` Â· `event-detail.page.ts` (`canAccessJournalistJournal`) Â· `event-mural.page.html` Â· `event-mural-media-journal.page.*`
