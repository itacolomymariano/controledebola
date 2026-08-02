## Perfil: Preparador Fisico (physical_trainer)

### Fluxos analisados
- P1 Plano: CTA `event-detail` â†’ `/event/:id/physical-trainer` (sÃ³ role + `isEffectivelyConfirmed`)
- P2 Aquecimento: salvar plano / iniciar / encerrar via `savePhysicalTrainerSession` (Cloud 14)
- P3 Hiring pessoal: `athlete-profile-hiring` segmento `trainer` â†’ `personalTrainerUserId`; hiring de evento via painel admin (`physical_trainer` em `HIREABLE_ROLES`)

### Bugs (P0/P1/P2) â€” arquivo + sintoma + evidencia
- **P1** `event-physical-trainer.page.ts` â€” deep-link sem papel: `getPhysicalTrainerSession` falha no catch, mas `event`/`athletes` jÃ¡ foram setados â†’ `@if (!loading && event)` ainda renderiza o formulÃ¡rio (sem redirect).
- **P1** `event-physical-trainer.page.ts` + `.html` â€” â€œIniciar/Encerrar aquecimentoâ€ chama `save()`; se `form.invalid`, early-return silencioso; botÃµes nÃ£o usam `form.invalid` (sÃ³ â€œSalvar planoâ€).
- **P2** Cloud `14-support-roles.js` â€” `warmupEnded` grava fim sem exigir `warmupStartedAt`; `clearWarmup` existe na API e no service, sem UI â†’ aquecimento errado nÃ£o dÃ¡ para desfazer.
- **P2** `athlete-profile-hiring.page.ts` â€” se `personalTrainerUserId` nÃ£o estÃ¡ em `listRoleCandidates`, `selectedCandidate` fica vazio e a UI pede busca como se nÃ£o houvesse seleÃ§Ã£o.

### Melhorias UX
- Bloquear/redirect na pÃ¡gina se Cloud negar; toast se aquecimento falhar por form invÃ¡lido.
- BotÃ£o â€œRefazer aquecimentoâ€ (`clearWarmup`); ordem visual plano â†’ aquecimento â†’ volta Ã  calma.
- Hiring: mostrar ID/nome do preparador jÃ¡ vinculado mesmo fora do pool local.

### Facilidade (1-5)
| DimensÃ£o | Nota |
|----------|------|
| Descoberta | 4 |
| Clareza | 3 |
| Feedback | 3 |
| Mobile | 3 |
| Autonomia | 4 |
| **MÃ©dia** | **3.4** |

### Arquivos-chave
`src/app/pages/event-physical-trainer/*` Â· `src/app/core/services/support-role-tools.service.ts` Â· `cloud/source/14-support-roles.js` Â· `src/app/pages/athlete-profile-hiring/*` Â· `src/app/pages/event-detail/event-detail.page.ts` (CTA `canAccessPhysicalTrainer`)
