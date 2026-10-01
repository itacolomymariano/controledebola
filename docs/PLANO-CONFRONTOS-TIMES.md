# Plano — Times amadores e confrontos

Complementa `AGENTS.md` e o guia. **Nao criar classe `Confronto`.** Reusar `Event` (`type = team_match`), `RefereeInvitation`, inbox e mural.

**Status:** P0 + P0.5 + P1 + P2 (2026-09-14): varios times, Busca Times, remarcacao bilateral.

## P1 — confronto de verdade (feito)

1. ~~`AmateurTeamMembership`~~ — Cloud `list/add/removeTeamMember` + UI no team-form; media de idade.
2. ~~Proposta/aceite~~ — `MatchChallenge` (`createMatchChallenge` / `respondMatchChallenge`); `/desafio-create` → inbox → `/confronto-create?challengeId=`.
3. ~~UI de cancelar / adiar com motivo~~ — card no detalhe + Cloud `cancelTeamMatch` / `rescheduleTeamMatch` (presidentes ou admin).
4. ~~Publico do push = elenco dos dois times + contratados~~ — `collectTeamMatchNotifyUserIds` no create e em cancel/remarcacao.
5. ~~Mensagem presidente↔presidente na inbox~~ — desafios + respostas na inbox.
6. ~~Evento `team_match` sem pelada~~ — feito em P0.5.
7. ~~Perfil publico do time~~ — `/team/:id` + `getAmateurTeamPublicProfile`.
8. ~~Placar / gols / arbitro no detalhe~~ — `getTeamMatchMatchdaySummary`.

| Recurso | Onde | Limite atual |
|---------|------|----------------|
| Cadastro de time | `/team/form`, lista + edicao, elenco | Ate **5** times por presidente; desafio exige `challengerTeamId` |
| Tipo de evento | `Event.type = team_match` | Aba **Confrontos** → desafio aceito → `createTeamMatch` **sem pelada** |
| Nomes casa/visitante | `homeTeam` / `awayTeam` + strings | Pointers `AmateurTeam` no create via desafio |
| Arbitro, scout, ropeiro, massagista, imprensa | Hiring + `RefereeInvitation` + paineis do evento | Ja funcionam em qualquer `Event` |
| Mural, portaria, midia, votos | Mesmo fluxo do evento de pelada | Ja funcionam se o confronto for um `Event` |
| Cancelar | Cloud `cancelTeamMatch` ou admin | Push ao elenco com motivo |
| Adiar | Cloud `rescheduleTeamMatch` (proposta) + `respondTeamMatchReschedule` | Aceite do presidente adversario; sem adversario aplica na hora |
| Comunicacao | Inbox desafios + contratacao + “Notificar participantes” | Desafio/aceite/recusa entre presidentes |
| Convocacao de atletas | Elenco + hiring `role: athlete` no create | Push de marcacao inclui elenco ativo |

## Resposta a 3.1

**Nao** ha um fluxo de confronto entre times amadores de primeira classe. Ha um evento `team_match` com nomes digitados. Split de times no palpite/sumula usa **metade da lista** quando o tipo e `team_match` (`fan-prediction.service.ts`, `08-scout-referee-performance.js`) — fragil.

Itens 3.1.7 e 3.1.8 **ja existem** no Event generico. Nao duplicar.

## P0 — ligar time ao evento (sem fork) — feito

1. `Event.homeTeam` / `Event.awayTeam` → Pointer `AmateurTeam`; strings `homeTeamName` / `awayTeamName` continuam como fallback.
2. `EventRegistration.teamSide` = `home` \| `away` (inscricao, convite e ajuste do admin).
3. Criar evento `team_match`: picker de times cadastrados + nome digitado.
4. Split casa/visitante usa `teamSide`; metade da lista so se ninguem tiver lado.
5. Convocar atleta no painel de contratacao escolhendo o time; inbox + push `hiring_invite` ja existentes.
6. Cloud `setEventRegistrationTeamSide` para o admin corrigir o lado.

## P0.5 — aba Confrontos (2026-09-12)

- Aba inferior **Confrontos** (`/tabs/events`) + `/confronto-create`.
- Mandante: busca + cadastro do proprio time (`/team/form?returnUrl=/confronto-create`). Visitante: **so busca** (ja precisa existir).
- Ida e volta: dois `Event`s (`hasReturnLeg` / `returnOf`; volta inverte casa/visitante).
- Convocacao do mandante: busca de atletas → `RefereeInvitation` (`role: athlete`).
- Push `team_match_created` ao presidente visitante; atletas recebem `hiring_invite` + inbox. Quem cria nao recebe.
- Inbox: secao `listTeamMatchInboxNotices` para o presidente visitante.

## P2 (feito)

- ~~Varios times por usuario~~ — ate 5; lista em `/team/form`; select no desafio.
- ~~Tabela/historico na Busca~~ — segment **Times** + `listAmateurTeamMatchHistory`.
- ~~Remarcacao com aceite do outro presidente~~ — proposta no detalhe; inbox/push; `respondTeamMatchReschedule`.

## Nao fazer

- Nova classe `Confronto` paralela a `Event`.
- Segundo mural / segunda portaria / segundo hiring.
- Implementar P1 antes do P0 estar no aparelho.

## Ordem de Cloud

Modulos: `15-amateur-teams.js`, `16-match-challenge.js`, `09-events-registrations.js`, `03-push-notifications.js`, `05-legends.js`. `npm run build:cloud` → publicar `cloud/main.js`. CLP: escrita de `AmateurTeamMembership` / `MatchChallenge` so via Cloud.
