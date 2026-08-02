# Auditoria por Perfil — Resultados Consolidados

**Data:** 2026-07-20  
**Metodo:** 13 agents (analise estatica) + orquestracao  
**Plano:** `docs/PLANO-TESTES-PERFIS.md`  
**Backup pre-auditoria:** `D:\Ita\git\backups\minhapelada-2026-07-20-pre-audit.zip`

---

## Scorecard de facilidade (media 1–5)

| # | Perfil | Media | Destaque |
|---|--------|-------|----------|
| 01 | Atleta | 3,4 | Status/PIX escondido no overview |
| 02 | Juiz | 3,2 | Aceite de convite nao atomico (P0) |
| 03 | Scout | 3,2 | Exclusividade multi-scout so na UI (P0) |
| 04 | Jornalista | 3,4 | Editor nao pre-carrega publicacao |
| 05 | Cinegrafista | **2,0** | Sem CTA operacional; remoto inacessivel |
| 06 | Narrador | 3,2 | Timeout de gravacao nao fecha UI |
| 07 | Treinador | 3,0 | Titulares texto livre silenciosos |
| 08 | Prep. Fisico | 3,4 | Iniciar aquecimento silencioso se form invalido |
| 09 | Massagista | 3,2 | So cria ficha; nao edita |
| 10 | Roupeiro | 3,4 | Contagem cega vazia = 0 (P0) |
| 11 | Gandula | **2,2** | Sem superficie operacional pos-inscricao |
| 12 | Porteiro | **2,2** | Tile Portaria sem scan/entries (P0) |
| 13 | Torcedor | 3,2 | Palpites duplicam ao reentrar; CLP fraco |

---

## Backlog priorizado

### P0 — corrigir primeiro

| ID | Perfil | Problema | Status |
|----|--------|----------|--------|
| P0-1 | Porteiro | Confirmado ve Portaria mas painel vazio (scan so admin) | **Corrigido** `event-detail.page.ts` |
| P0-2 | Roupeiro | Contagem cega vazia vira 0 → divergencia falsa | **Corrigido** `event-detail.page.ts` |
| P0-3 | Juiz | Inscricao criada antes de marcar convite `accepted` | **Corrigido** `referee-invitation.service.ts` |
| P0-4 | Scout | exclusividade multi-scout so na UI | **Corrigido** `08-scout-referee-performance.js` |
| P0-5 | Cinegrafista | Sem CTA + remoto so para fan no hiring | **Parcial** CTA info + attendanceMode hiring |

### P1 — alto impacto

- Atleta: voto sem `isEffectivelyConfirmed`; times so apos fim; status PIX fora do overview
- Juiz: janela sumula so no save; dirty sem guard; bandeira reabre hiring
- Scout: sem CTA auxiliares; UI liberada fora da janela Cloud
- Jornalista/Narrador: `loadDashboard` ausente no enter
- Narrador: timeout 40/50s nao sincroniza UI
- Massagista: submit sem `objectId` (so create)
- Material: reload apos sent; blind count sem status; invite kitman sem tile
- Torcedor: `goalScorers` duplica; palpites sem Cloud gate
- Gandula: sem CTA; chegada admin so atleta
- Support roles: admin le mas nao salva coach board

### P2 — melhoria

Labels Ropeiro/Roupeiro, CLP media, deep-links sem papel, empty states, etc.

---

## Agents

| Perfil | Agent |
|--------|-------|
| Atleta | [Atleta](6001e2ce-ae8a-4d97-af07-68cc719b16b3) |
| Juiz | [Juiz](f83c0307-892d-4f91-b0b5-972cee2ad78b) |
| Scout | [Scout](63ef4218-0cf0-4236-b874-9b5e9aeb2f09) |
| Jornalista | [Jornalista](8efebeef-64ba-482e-910c-f04a63dab7ae) |
| Cinegrafista | [Cinegrafista](5b8d9f25-9602-4f10-af2e-33eb7e320863) |
| Narrador | [Narrador](0e8650f8-42ed-4469-a7e8-7ed434b893ac) |
| Treinador | [Treinador](706e507b-ec24-4dbc-b265-9a73389fb649) |
| Prep. Fisico | [Prep. Fisico](7f3a4927-3c24-4ef5-83a4-6c0b22c3cb17) |
| Massagista | [Massagista](74490cbc-678b-4334-b2c2-df13053d7867) |
| Roupeiro | [Roupeiro](aa12718c-b36a-4128-9d64-62bbe29072ae) |
| Gandula | [Gandula](bd777803-ccb6-476b-b06b-b096d79faea8) |
| Porteiro | [Porteiro](c0698202-368d-43c9-a79f-b90446b9450f) |
| Torcedor | [Torcedor](f0c8ace1-702a-4b10-a1f6-10c564ea2e8d) |

Raw reports: `docs/_agent-qa-raw/*.md`
