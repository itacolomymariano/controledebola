## Perfil: Narrador (narrator)

Documentacao: complexa â€” AGENTS.md + plano Â§06 (estatico).

### Fluxos analisados
R1 rota `event/:id/narrator-radio` + CTA `event-detail` (`canAccessNarratorRadio`) Â· R2 gravar/upload â†’ `publishEventRadioNarration|Interview` Â· R3 estados gravando vs idle Â· feedback loading/alert Â· mural via `EventMediaPublication`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `audio-recorder.util.ts` + `event-narrator-radio.page.ts` â€” ao estourar 40/50s o `MediaRecorder` para sozinho, mas a pagina nao chama `stop*()`: botao fica â€œPararâ€, blob nao vira preview ate toque manual (`maxTimeout` chama `recorder.stop()` sem callback na page).
- **P1** `event-narrator-radio.page.ts` â€” `ionViewWillEnter` nao chama `loadDashboard`; narrador nao ve titulo/audio ja publicados antes de sobrescrever.
- **P2** `event-narrator-radio.page.html` â€” entrevista sem upload de arquivo (narracao tem); fallback fraco se mic falhar.
- **P2** mesma page â€” sem exclusao mutua: da para iniciar narracao e entrevista ao mesmo tempo (dois `getUserMedia`).
- **P2** rota aberta sem check de papel na page (so CTA + Cloud `assertConfirmedRoleRegistration`); deep-link mostra UI inutil.

### Melhorias UX
Badge idle/gravando/publicado; auto-finalizar UI no timeout; carregar midia atual; alinhar entrevista com upload; toast + link â€œver no muralâ€; CTA â€œRadio do narradorâ€.

### Facilidade (1-5)
Descoberta **4** Â· Clareza **3** Â· Feedback **3** Â· Mobile **3** Â· Autonomia **3** â†’ **media 3,2**

### Arquivos-chave
`src/app/pages/event-narrator-radio/*` Â· `src/app/core/services/event-media.service.ts` Â· `src/app/core/utils/audio-recorder.util.ts` Â· `src/app/pages/event-detail/event-detail.page.ts` Â· `cloud/source/12-event-media.js` Â· `src/app/pages/event-mural-media/event-mural-media-radio.page.*`
