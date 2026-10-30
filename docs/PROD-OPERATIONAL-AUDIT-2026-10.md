# Auditoria operacional — produção (MinhaPelada)

**Data:** 2026-10-29  
**App:** `com.minhapelada.app` · Back4App **MinhaPelada** (não sandbox)  
**Roteiros:** [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md), [FLUXO-TESTES-CICLO-DE-VIDA.md](FLUXO-TESTES-CICLO-DE-VIDA.md), [PLANO-TESTES-PERFIS.md](PLANO-TESTES-PERFIS.md)

---

## 1. Pré-voo (auditoria estática — concluída)

| Item | Status | Notas |
|------|--------|--------|
| Mapa roteiro → rotas/serviços/Cloud | OK | Ver §2 abaixo |
| Divergências doc interno vs app | **P1 doc** | FLUXO ainda cita só 4 abas e `tabs/peladas` como destino; app usa **`/tabs/home`** + **5 abas** (Confrontos) |
| Cloud smoke #1–#15 | Checklist | Publicar `cloud/main.js` após qualquer edit em `cloud/source/` |
| Manual/site vs app | **P1 doc** | Cap. 15 (Usuários na Home), cap. 09 (tabela MDX quebrada) — correção em `controledebolasite` |
| Screenshots manual | **P1 conteúdo** | 19 prints faltando, 4 refazer — [MANUAL-SCREENSHOT-MATRIX-2026-10.md](MANUAL-SCREENSHOT-MATRIX-2026-10.md) |

**P0 de código (app):** nenhum identificado na auditoria estática; validar no dispositivo (§3).

---

## 2. Resumo — rotas e Cloud (smoke)

Referência completa: subagent explore 2026-10-29.

| Smoke | Rota principal | Cloud must-have |
|-------|----------------|-----------------|
| 1 | `/tabs/home`, `/tabs/peladas/lista`, login | `resolveLoginUsername`, `listPeladasForFeed`, `listTeamMatchesForFeed` |
| 3 | `/event/:id` participantes | `listEventRegistrationsForAdmin`, `updateEventRegistrationPayment`, chegada/QR `06` |
| 5 | `/inbox` | `09` conflitos + `16` desafios + opcional `18` mailbox |
| 8–9 | `/tabs/mural`, `/event/:id/mural` | `07` mural + `01e` peso votante |
| 10 | `/login` reset | `requestPasswordResetEmail`, `confirmPasswordReset` + SMTP |
| 12 | `/register` | `prepareSignupChallenge`, `registerUser` |

**Divergências doc ↔ app (priorizar atualizar FLUXO):**

- Pós-login: `profile-setup` → `/tabs/peladas` redireciona para **`/tabs/home`**
- Rodapé: **Peladas, Buscar, Confrontos, Mural, Perfil**
- Criar pelada: rota **`/pelada-create`** (não `pelada-form`)
- Inbox agrega desafios, remarcações, join requests, não só `RefereeInvitation`

---

## 3. Execução no dispositivo (produção)

**APK:** `npm run install:android` com `environment.local.ts` → MinhaPelada.  
**Registro:** marque `[x]` e anote falhas **P0 / P1 / P2**.

### Smoke (15 itens)

| # | OK | Severidade | Observação |
|---|-----|------------|------------|
| 1 Home + rodapé | [ ] | | |
| 2 Pelada config | [ ] | | |
| 3 Evento participantes | [ ] | | |
| 4 Convite contratação | [ ] | | |
| 5 Inbox | [ ] | | |
| 6 Team split | [ ] | | |
| 7 Portaria / PIX | [ ] | | |
| 8 Tab Mural | [ ] | | |
| 9 Voto evento | [ ] | | |
| 10 Esqueci senha (código) | [ ] | | |
| 11 Mural confiança / craque | [ ] | | |
| 12 Cadastro | [ ] | | |
| 13 Ajuda ? + TTS | [ ] | | |
| 14 Team split salvar/desfazer | [ ] | | |
| 15 Scout + súmula | [ ] | | |

### FLUXO fases A–G

| Fase | OK | P0/P1/P2 | Notas |
|------|-----|----------|-------|
| A Entrada | [ ] | | |
| B Pelada | [ ] | | |
| C Evento | [ ] | | |
| D Contratação | [ ] | | |
| E Dia do jogo | [ ] | | |
| F Pós-jogo / mural | [ ] | | |
| G Regressão | [ ] | | |

### Perfis (amostra)

| Perfil | OK | Notas |
|--------|-----|-------|
| Admin pelada | [ ] | |
| Atleta | [ ] | |
| Juiz | [ ] | |
| Torcedor | [ ] | |
| Presidente / confronto | [ ] | |

### Links app → site

| Teste | OK |
|-------|-----|
| Sobre → Manual → controledebola.com/guia | [ ] |

---

## 4. Ações derivadas

1. Atualizar [FLUXO-TESTES-CICLO-DE-VIDA.md](FLUXO-TESTES-CICLO-DE-VIDA.md) (Home + 5 abas) após smoke OK  
2. Fotos: [MANUAL-CAPTURE-PRINTS-PRIORITY.md](MANUAL-CAPTURE-PRINTS-PRIORITY.md)  
3. Prosa manual: [MANUAL-PROSE-REVIEW-2026-10.md](MANUAL-PROSE-REVIEW-2026-10.md)  
4. Deploy site: commit/push `controledebolasite` (prosa cap. 00–15 parcial + JPEGs obsoletos removidos) → Cloudflare
5. JPEGs novos em `public/guia/` + `{/* print */}` nos MDX
