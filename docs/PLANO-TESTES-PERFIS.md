# Plano de Testes — Funcionalidade e Facilidade de Operacao

**App:** Controle de Bola  
**Data:** 2026-07-20  
**Objetivo:** Validar fluxos dos 13 perfis (capacidade + UX) e alimentar correcoes priorizadas.

Complementa o smoke curto em `docs/SMOKE-TEST-PRE-INSTALL.md`.

---

## 1. Premissas

| Item | Valor |
|------|-------|
| Ambiente | Web `npm start` (http://localhost:8100) e/ou APK Android |
| Contas | Ideal: 1 conta por perfil (ou troca de `primaryRole` + inscricoes) |
| Evento fixture | Pelada com evento futuro/aberto, taxa conhecida, portaria QR opcional |
| Admin | Conta admin da pelada/evento para convites e chegada |
| Modo agents | Analise estatica de codigo + checklist operacional (runtime quando houver sessao) |

### Criterios de aceite (por perfil)

- **Funcional:** consegue cumprir a acao principal do papel sem erro bloqueante.
- **Operacional:** encontra a tela em ≤ 3 toques a partir do evento; labels claros; estados vazios explicativos.
- **Seguranca:** nao ve acoes de outro papel; Cloud rejeita chamada nao autorizada.

Severidade: **P0** bloqueia uso · **P1** atrito forte · **P2** cosmetico/melhoria.

---

## 2. Setup comum (antes dos perfis)

1. Login → tabs Peladas / Buscar / Mural / Perfil.
2. Abrir pelada → abrir evento.
3. Garantir perfil do papel em Perfil / profile-setup / role-profile form.
4. Admin: enviar `RefereeInvitation` quando o papel exigir contratacao.
5. Convidado: Inbox → aceitar → voltar ao evento com `isEffectivelyConfirmed`.

---

## 3. Matriz por perfil (agents)

Cada agent simula **um** papel. Entregavel padrao:

```
## Perfil: <nome>
### Fluxos executados / analisados
### Bugs (P0/P1/P2) — arquivo + sintoma
### Melhorias UX — impacto esperado
### Facilidade (1–5) — justificativa
```

### 01 — Atleta (`athlete`)

| ID | Caso | Esperado |
|----|------|----------|
| A1 | Inscricao no evento | Register + pagamento/isencao → confirmado efetivo |
| A2 | Chegada | Admin marca; ordem refletida no team-split |
| A3 | Team split | Toque atleta → time; media votos |
| A4 | Votacao mural | Dentro da janela; nota 0–10 |
| A5 | Perfil publico | `athlete/:userId` legivel |

**Agent foco:** `event-register`, `event-detail`, `event-team-split`, `event-mural`, `registration.service`.

### 02 — Juiz (`referee`)

| ID | Caso | Esperado |
|----|------|----------|
| J1 | Convite inbox | Aceitar gera inscricao juiz |
| J2 | Sumula | `/event/:id/sumula` salva apontamentos |
| J3 | Auxiliares bandeira | Hiring complementar se previsto |
| J4 | Sem convite | Nao se auto-inscreve como juiz aberto (regra de negocio) |

**Agent foco:** `event-sumula`, `referee-sumula.service`, `inbox`, Cloud `08`/`09`.

### 03 — Scout / Mesario (`scout`)

| ID | Caso | Esperado |
|----|------|----------|
| S1 | Board scout | `/event/:id/scout` incrementa stats |
| S2 | Persistencia | Reload mantem; conflito `statsConflictSource` |
| S3 | Auxiliares | Contratar marcadores se permitido |
| S4 | UX mobile | Controles usaveis com uma mao |

**Agent foco:** `event-scout-apontamento`, `scout-apontamento.service`, Cloud `08`.

### 04 — Jornalista (`journalist`)

| ID | Caso | Esperado |
|----|------|----------|
| N1 | Jornal | `/event/:id/journalist-journal` publica |
| N2 | Mural | Publicacao aparece no mural do evento |
| N3 | Permissao | So jornalista confirmado edita |

**Agent foco:** `event-journalist-journal`, Cloud `12-event-media`.

### 05 — Cinegrafista (`cameraman`)

| ID | Caso | Esperado |
|----|------|----------|
| C1 | Contratacao / inscricao | Fluxo hiring ou register claro |
| C2 | Presenca remota | Confirmacao visivel no event-detail |
| C3 | CTA | Entrada obvia para “cobertura / moments” (ou lacuna documentada) |

**Agent foco:** `event-detail` CTAs cameraman, hiring, registration.

### 06 — Narrador (`narrator`)

| ID | Caso | Esperado |
|----|------|----------|
| R1 | Radio | `/event/:id/narrator-radio` |
| R2 | Gol / entrevista | Publica narracao; feedback toast/erro |
| R3 | Ao vivo | Estados idle/live compreensiveis |

**Agent foco:** `event-narrator-radio`, Cloud `12`.

### 07 — Treinador (`coach`)

| ID | Caso | Esperado |
|----|------|----------|
| T1 | Board | `/event/:id/coach-board` escala/checklist/notas |
| T2 | Persistencia | Salvar e reabrir |
| T3 | Acesso | So coach confirmado (ou admin) |

**Agent foco:** `event-coach-board`, `support-role-tools`, Cloud `14`.

### 08 — Preparador Fisico (`physical_trainer`)

| ID | Caso | Esperado |
|----|------|----------|
| P1 | Plano | `/event/:id/physical-trainer` |
| P2 | Aquecimento / sessao | Campos obrigatorios claros |
| P3 | Integracao atleta | Hiring pessoal em `athlete-profile-hiring` se aplicavel |

**Agent foco:** `event-physical-trainer`, Cloud `14`.

### 09 — Massagista (`masseur`)

| ID | Caso | Esperado |
|----|------|----------|
| M1 | Fila | `/event/:id/masseur-treatments` |
| M2 | Ficha atendimento | Criar/atualizar status |
| M3 | Pos-jogo | Fluxo recuperacao compreensivel |

**Agent foco:** `event-masseur-treatments`, Cloud `14`.

### 10 — Roupeiro (`kitman`)

| ID | Caso | Esperado |
|----|------|----------|
| K1 | Inventario | `/material-inventory?ownerType=kitman` |
| K2 | Sessao evento | Painel material no `event-detail` |
| K3 | Envio / cego / danificado | Contagens e estados da sessao |

**Agent foco:** painel material, `material-inventory`, Cloud `13`.

### 11 — Gandula (`gandula`)

| ID | Caso | Esperado |
|----|------|----------|
| G1 | Inscricao papel | Register como gandula |
| G2 | Ferramentas | CTAs no event-detail (ou ausencia documentada) |
| G3 | Chegada / confirmacao | Status efetivo claro |

**Agent foco:** registration role `gandula`, event-detail shortcuts.

### 12 — Porteiro (`gatekeeper`)

| ID | Caso | Esperado |
|----|------|----------|
| O1 | Scan QR | `/event/:id/gate-scan` |
| O2 | Lista entradas | `/event/:id/gate-entries` |
| O3 | Flag evento | `gateTicketControlEnabled` respeitado |
| O4 | Ingresso atleta | Ticket so se `isEffectivelyConfirmed` |

**Agent foco:** gate pages, `event-gate-ticket.service`, Cloud `06`.

### 13 — Torcedor (`fan`)

| ID | Caso | Esperado |
|----|------|----------|
| F1 | Palpites | `/event/:id/predictions` |
| F2 | Check-in torcida | `/event/:id/fan-checkin` |
| F3 | Voto mural | Dentro da janela |
| F4 | Remoto vs presencial | Diferenca clara na UI |

**Agent foco:** predictions, fan-checkin, FanProfile, Cloud `08`/`14`.

---

## 4. Facilidade de operacao (scorecard)

Para cada perfil, o agent atribui 1–5:

| Dimensao | Pergunta |
|----------|----------|
| Descoberta | Acha a ferramenta do papel sem ajuda? |
| Clareza | Textos/estados vazios explicam o proximo passo? |
| Feedback | Salvar/erro tem toast ou mensagem util? |
| Mobile | Usavel em tela estreita durante o jogo? |
| Autonomia | Precisa do admin o tempo todo? |

Media ≤ 2 → P1 de UX automatico.

---

## 5. Pos-teste (orquestracao)

1. Agents gravam achados → consolidar em `docs/AUDITORIA-PERFIS-RESULTADOS.md`.
2. Atualizar `docs/AGENT-ACTIVITY-CACHE.md`.
3. Priorizar P0 → P1 → P2 e iniciar correcoes no codigo.
4. Revalidar com `npm run build` (+ smoke se Cloud tocado).

---

## 6. Checklist humano (runtime, opcional)

Usar apos agents estaticos, com contas reais:

- [ ] Convites inbox para referee/scout/profissionais
- [ ] Portaria QR com 1 ingresso valido e 1 invalido
- [ ] Sumula + scout no mesmo evento (conflito de fonte)
- [ ] Material: carregar → enviar → contagem cega
- [ ] Radio + jornal publicam e aparecem no mural
