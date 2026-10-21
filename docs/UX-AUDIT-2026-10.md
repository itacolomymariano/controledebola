# UX — auditoria rapida (testes familia, out/2026)

Escopo inicial (Xaiana Beliza): login, cadastro, mural, votacao, textos longos.

## Como validar (1º sprint — Xaiana / familia out/2026)

| Onde | O que ver |
|------|-----------|
| Login → Esqueci senha | Card com e-mail mascarado; hint de codigo 6 digitos no app |
| Tab Mural → Geral | Hint de confianca no ranking; craque com “X pessoas avaliaram” |
| Evento → votacao | Contador de notas 10; bloqueio na 3ª nota 10 |

Build minimo: **2026.10.19.0256+** + Cloud mural publicado.

## Quick wins — 3º sprint (2026-10-20, Primeiro Coordenador)

- **Home `/tabs/home`:** quatro portas; rodapé sem aba destacada na Home; ícone casa volta ao hub; rodapé **Peladas** → lista (`/tabs/peladas/lista`)
- **Participantes (admin):** confirmados em card compacto (6 campos) + controles abaixo
- **Ajuda ?:** `screen.help.home` mapeado; balão na Home
- Validar: smoke #1 e #3 em [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md)

## Quick wins — 2º sprint (2026-10-19, Primeiro Coordenador + Xaiana)

- **Register:** subtitulo curto; hints de apelido e CPF enxutos (`register.subtitle`, `register.cpfHint`)
- **Profile-setup:** intro atleta encurtada (`profileSetup.athleteIntro`)
- **Votacao evento:** subtitulo unico i18n (`eventDetail.voting.subtitle`)
- **Participantes / Chegou:** botao sem texto vertical; footnote curta i18n
- **Pelada ? (toolbar):** botao Ouvir no `app-screen-help` com `[enableSpeech]="true"`

## Quick wins aplicados (2026-10-19, 1º sprint)

- **Login / reset:** card fixo com e-mail mascarado apos envio do codigo; copy deixa claro que nao ha link magico (codigo 6 digitos no app).
- **Mural app:** hint de ranking com confianca; card craque mostra quantas pessoas avaliaram.
- **Votacao evento:** limite de 2 notas 10 por evento + contador na UI.

## Backlog sugerido (proximas rodadas)

| Area | Achado | Acao |
|------|--------|------|
| Event-detail | Painel votacao denso | Agrupar por time |
| Inbox / pelada-detail | Verbosidade em cards | Encurtar i18n + help balloon |
| Pontuacao pt-BR | Virgulas vs pontos em numeros | Padronizar pipes `number` |

Referencia: plano feedback familia 17–18/out/2026; Primeiro Coordenador out/2026.
