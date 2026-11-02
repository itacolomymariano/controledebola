# Checklist prontidão produção — 2026-10-31

Ambiente alvo: **Back4App MinhaPelada** + `environment.local.ts` produção. Referência: [BUILD-ENVIRONMENTS-AGENTS.md](BUILD-ENVIRONMENTS-AGENTS.md).

Legenda: **OK** | **Pendente** (teste manual) | **Falha** | **N/A**

## Gate técnico (agente)

| Item | Status | Notas |
|------|--------|--------|
| `npm run build:cloud` após alteração `11-profiles-search.js` | OK | `cloud/main.js` gerado |
| Publicar `cloud/main.js` no Back4App produção | Pendente | Login Back4App → app **MinhaPelada** → Cloud Code → colar `cloud/main.js` (24680 linhas, inclui `userHasPublicRoleEvidence`) |
| `npm run build` app | OK | Build **2026.10.31.0288** (AAB usou mesmo prebuild) |
| AAB Play (`npm run build:android:aab`) | OK | `android/app/build/outputs/bundle/release/app-release.aab` (~11,45 MB) |
| APK release no dispositivo | Pendente | `adb` sem device no momento; reconectar USB + depuração → `npm run install:android` ou `gradlew installRelease` |
| Fix Home → perfil público (torcedor) no código | OK | Cloud + cliente |

## P0 — operacional (dispositivo / operador)

| Fluxo | Rota / smoke | Status | Notas |
|-------|----------------|--------|--------|
| Login + Home tabs | SMOKE #1 | Pendente | Samsung / TestFlight |
| **Home → Usuários → perfis listados** | SMOKE #16 | Pendente | Torcedor + ≥1 profissional + atleta |
| Pelada config | SMOKE #2 | Pendente | |
| Evento inscrição + conf. efetiva | FLUXO C | Pendente | Parar se QR/voto quebrar |
| Inbox / contratação juiz | SMOKE #4–5 | Pendente | |
| Team split | SMOKE #6, #14 | Pendente | |
| Portaria / PIX | SMOKE #7 | Pendente | |
| Mural app + voto evento | SMOKE #8–9, #11 | Pendente | |
| Scout + súmula | SMOKE #15 | Pendente | |
| Material roupeiro | PLANO §10 | Pendente | Contagem cega |
| Porteiro CTA (raw) | PLANO §12 | Pendente | Tile vazio conhecido — validar impacto |
| Cinegrafista cobertura (raw) | PLANO §05 | Pendente | Sem CTA — backlog pós-go-live? |

## P1 — pós P0 verde ou release patch

| Fluxo | Status |
|-------|--------|
| Torcedor palpites / check-in | Pendente |
| Treinador / prep. físico / massagista | Pendente |
| Jornalista / narrador mídia | Pendente |
| Gandula (sem CTA event-detail) | Pendente |

## Go / no-go Google Play

- [ ] Todos **P0** acima marcados **OK** no dispositivo release (`com.minhapelada.app`)
- [ ] Cloud produção publicado e smoke #16 passou
- [x] AAB gerado (`npm run build:android:aab`) — **0288** / marketing **1.0.9** — upload Play Console quando P0 device OK

## Matriz documental (Onda 1)

Consolidada pelo agente explore em 2026-10-31; detalhes em [FLUXO-TESTES-CICLO-DE-VIDA.md](FLUXO-TESTES-CICLO-DE-VIDA.md), [PLANO-TESTES-PERFIS.md](PLANO-TESTES-PERFIS.md), `docs/_agent-qa-raw/*.md`.

P0 adicionais conhecidos (não bloqueiam fix Home): porteiro tile, scout assignment, cinegrafista CTA — tratar como backlog ou hotfix conforme prioridade do Primeiro Coordenador.
