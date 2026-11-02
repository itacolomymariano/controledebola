# Auditoria operacional — sandbox (Clone_MinhaPelada)

**Data:** 2026-11-01  
**App:** `com.minhapelada.app.sandbox` · Back4App **Clone_MinhaPelada** (não MinhaPelada produção)  
**Roteiros:** [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md), [FLUXO-TESTES-CICLO-DE-VIDA.md](FLUXO-TESTES-CICLO-DE-VIDA.md), [PLANO-TESTES-PERFIS.md](PLANO-TESTES-PERFIS.md)  
**APK demo:** [SANDBOX-CLONE-APK.md](SANDBOX-CLONE-APK.md)

---

## 1. Pré-voo estático (2026-11-01)

| Item | Status | Notas |
|------|--------|--------|
| `npm run build:cloud` | OK | `cloud/main.js` — 25 módulos, ~25207 linhas |
| `npm run check:cloud-parity` | OK | 185 `Cloud.run` no cliente ↔ 212 `define` no bundle; **P0 demo todas no main.js** |
| `npm run probe:sandbox-cloud` | **FALHA** | **6 funções P0** retornam `Invalid function` no clone publicado |
| Causa erro Home Confrontos | Confirmada | Cliente chama `listTeamMatchesForFeed`; função **não deployada** no clone |

### Probe clone (automático)

Comando: `npm run probe:sandbox-cloud` (usa `environment.sandbox.local.ts`).

| Função | Clone publicado |
|--------|-----------------|
| `listTeamMatchesForFeed` | **Não** (141) |
| `listHomeDirectoryUsers` | **Não** |
| `listPeladasForFeed` | **Não** |
| `getMuralAppDashboard` | **Não** |
| `searchProfiles` | **Não** |
| `listHomeDirectoryTeams` | **Não** |

**Ação P0 antes da apresentação:** Back4App → app **Clone_MinhaPelada** → Cloud Code → colar [`cloud/main.js`](../cloud/main.js) → Deploy. Rodar `npm run probe:sandbox-cloud` até **todas OK**.

---

## 2. Smoke → Cloud must-have (sandbox demo)

Referência produção: [PROD-OPERATIONAL-AUDIT-2026-10.md](PROD-OPERATIONAL-AUDIT-2026-10.md) §2.

| Smoke | Rota / gesto | Cloud must-have |
|-------|----------------|-----------------|
| 1 | `/tabs/home` — 4 portas + rodapé | `resolveLoginUsername`, `listPeladasForFeed`, **`listTeamMatchesForFeed`**, `listHomeDirectoryTeams`, `listHomeDirectoryLegendTeams`, `listHomeDirectoryUsers` |
| 1b | Home → card **Confrontos** | **`listTeamMatchesForFeed`** |
| 1c | Aba **Confrontos** | **`listTeamMatchesForFeed`**, opcional `repairTeamMatchOwnership` |
| 2 | Pelada config | ACL + queries locais; `getPeladaDisplayInfo` |
| 3 | Evento participantes admin | `listEventRegistrationsForAdmin`, `updateEventRegistrationPayment`, `06` portaria |
| 5 | Inbox | `16` desafios/join, `18` mailbox, `listMyLegendTeamJoinRequests` |
| 8–9 | Mural | `getMuralAppDashboard`, `07` votos |
| 16–20 | Home/Busca/lendas | `searchProfiles`, `getRolePublicProfile`, `getAmateurLegendTeam`, join lenda |

Paridade completa cliente↔bundle: `npm run check:cloud-parity`.

---

## 3. Execução no dispositivo (sandbox)

**Pré-requisito:** probe clone **OK** (§1).

**APK:** `releases/ControleDeBola-sandbox-2026-11-01.apk` (ou data atual) · Samsung `RXGL406LWRM`.

**Go/no-go apresentação:** zero **P0** (`Invalid function`, tela amarela, crash, login impossível).

### Smoke (itens 1–20)

| # | OK | Sev. | Observação |
|---|-----|------|------------|
| 1 Home + rodapé + **Confrontos** | [ ] | P0 | Após deploy Cloud |
| 2 Pelada config | [ ] | | |
| 3 Evento participantes | [ ] | | |
| 4 Contratação | [ ] | | |
| 5 Inbox | [ ] | | |
| 6 Team split | [ ] | | |
| 7 Portaria / PIX | [ ] | | |
| 8 Tab Mural | [ ] | P0 | `getMuralAppDashboard` |
| 9 Voto mural evento | [ ] | | |
| 10 Esqueci senha | [ ] | P1 | SMTP no clone opcional |
| 11 Mural craque | [ ] | | |
| 12 Cadastro | [ ] | P1 | SMTP / anti-bot |
| 13 Ajuda TTS | [ ] | | |
| 14 Team split salvar | [ ] | | |
| 15 Scout + súmula | [ ] | | |
| 16 Home Usuários | [ ] | P0 | |
| 17 Home Novo Time | [ ] | | |
| 18 Join time lenda | [ ] | | |
| 19 Busca proximidade/ID | [ ] | P0 | `searchProfiles` |
| 20 ID cadastro | [ ] | | |

### FLUXO fases A–G (amostra demo)

| Fase | OK | P0/P1/P2 | Notas |
|------|-----|----------|-------|
| A Entrada | [ ] | | Contas existentes no clone |
| B Pelada | [ ] | | |
| C Evento | [ ] | | |
| D Contratação | [ ] | | |
| E Dia do jogo | [ ] | | |
| F Mural | [ ] | | |
| G Regressão | [ ] | | |

---

## 4. Registro pós-deploy Cloud

| Campo | Valor |
|-------|--------|
| Data deploy clone | _preencher_ |
| Quem publicou | _preencher_ |
| `probe:sandbox-cloud` | [ ] OK |
| Home Confrontos no device | [ ] OK |

---

## 5. Achados

| ID | Sev. | Descrição | Status |
|----|------|-----------|--------|
| SB-01 | **P0** | Clone sem Cloud recente → `Invalid function` em Confrontos/Home/Mural/Busca | **Aberto** — deploy `cloud/main.js` |
| SB-02 | — | Bundle local e paridade cliente OK | Fechado (estático) |

**Código app:** sem alteração necessária para SB-01; alinhar **deploy Back4App clone** com APK sandbox.
