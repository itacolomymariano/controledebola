# Back4App — convites de arbitro (Fase 6)

## Classe RefereeInvitation

| Campo | Tipo |
|-------|------|
| `event` | Pointer → `Event` |
| `pelada` | Pointer → `Pelada` |
| `invitedUser` | Pointer → `_User` |
| `invitedBy` | Pointer → `_User` |
| `status` | String (`pending`, `accepted`, `declined`, `cancelled`) |
| `offeredAmount` | Number |
| `responseDeadline` | Date (prazo definido pelo admin para aceitar ou recusar) |
| `responseAt` | Date (data/hora da resposta do arbitro) |
| `invitedUserApelido` | String (copia para exibicao) |
| `invitedUserFullName` | String (nome completo do arbitro) |
| `invitedUserAvatarUrl` | String (URL da foto do arbitro) |
| `invitedByApelido` | String (apelido do admin que enviou) |
| `invitedByFullName` | String (nome do admin) |
| `invitedByName` | String (apelido ou nome para exibicao) |
| `invitedByAvatarUrl` | String (foto do admin) |
| `registration` | Pointer → `EventRegistration` (apos aceite) |
| `presenceConfirmed` | Boolean |
| `arrivalAt` | Date (data/hora da chegada confirmada pelo admin) |
| `paymentConfirmedByAdmin` | Boolean |
| `paymentConfirmedByReferee` | Boolean |
| `paymentConfirmedByRefereeAt` | Date |
| `workCompleted` | Boolean (legado — espelha `paymentConfirmedByAdmin`) |
| `paymentReleased` | Boolean |
| `cashEntryId` | String |

**CLP sugerida:** Create/Find/Get para autenticado; Update por `invitedUser` (aceitar/recusar/confirmar pagamento) ou admin do evento (presenca/pagamento).

## Campos extras

### EventRegistration
| Campo | Tipo |
|-------|------|
| `invitedAsReferee` | Boolean (opcional) |

### PeladaCashEntry
| Campo | Tipo |
|-------|------|
| `refereeInvitation` | Pointer → `RefereeInvitation` (opcional) |

## Fluxo

1. Admin do evento convida arbitro com valor e **data/hora limite da resposta**.
2. Convites pendentes apos o prazo sao cancelados automaticamente pelo app.
3. Arbitro ve convite em **Caixa de entrada** (`/inbox`) com nome, apelido e foto do administrador.
4. Ao aceitar ou recusar, o app registra `responseAt` e exibe nome, apelido e foto do arbitro no evento.
5. Ao aceitar, cria `EventRegistration` com `role = referee`.
6. Admin confirma presenca com **data e hora da chegada** (`arrivalAt`).
7. Admin confirma **pagamento enviado** → gera saida no caixa (`Saida - Pagamento juiz/arbitro - {evento} - {arbitro}`).
8. Arbitro confirma **pagamento recebido** na caixa de entrada.

## Indices uteis

- `RefereeInvitation`: `event`, `invitedUser`, `status`
