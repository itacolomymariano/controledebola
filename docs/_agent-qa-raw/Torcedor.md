## Perfil: Torcedor (fan)
Documentacao: complexa â€” AGENTS.md + plano Â§13 (estatica)

### Fluxos analisados
F1 palpites (`event-predictions` + `FanPredictionService` + Cloud `08` rankings) Â· F2 check-in (`event-fan-checkin` + Cloud `14`) Â· F3 voto mural (`event-detail` + `mural-role.util`) Â· F4 remoto/presencial (FanProfile rates, hiring `in_person`, check-in `presential`) Â· CTAs `event-detail`

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `fan-prediction.service.ts` + CLP `FanPrediction` (`07-mural.js`): save client-side sem Cloud/`beforeSave` â€” UI fecha em `startTime`, mas API permite criar/alterar depois e sem papel fan/`isEffectivelyConfirmed`.
- **P1** `event-predictions.page.ts` `ionViewWillEnter`: `goalScorers.push` sem `clear()` â†’ linhas duplicadas ao reabrir a pagina (cache Ionic).
- **P1** `event-detail.page.ts` `canMakePredictions`: CTA â€œFazer palpitesâ€ para qualquer um antes do inicio; check-in exige `role==='fan'` + confirmado â€” inconsistente.
- **P2** hiring `AttendanceMode='in_person'` vs check-in `'presential'` + label â€œRemota (filmagem/narracao)â€ no painel fan â€” F4 confuso (Cloud 14 normaliza so `remote`).
- **P2** `splitAthletesByTeam` (mid da lista): mandante/visitante arbitrario em `team_match`.
- **P2** `event-fan-checkin.page.ts`: rota sem guard de papel; `canEdit = !!myCheckIn || true` sempre true.

### Melhorias UX
Cloud `saveFanPrediction` (horario + inscricao) Â· CTA palpites = fan confirmado Â· preencher modo do check-in a partir do convite Â· badge remoto/presencial no `event-detail` Â· copy FanProfile sem â€œfilmagem/narracaoâ€ para torcedor.

### Facilidade (1-5)
Descoberta **3** Â· Clareza **3** Â· Feedback **4** Â· Mobile **3** Â· Autonomia **3** â†’ **media 3,2**

### Arquivos-chave
`src/app/pages/event-predictions/*` Â· `event-fan-checkin/*` Â· `fan-profile-form/*` Â· `event-detail.page.ts` Â· `fan-prediction.service.ts` Â· `fan-profile.service.ts` Â· `mural-role.util.ts` Â· `event-role-hiring-panel/*` Â· `cloud/source/08-scout-referee-performance.js` Â· `cloud/source/14-support-roles.js` Â· `09-events-registrations.js` (`listEventAthletesForPredictions`)
