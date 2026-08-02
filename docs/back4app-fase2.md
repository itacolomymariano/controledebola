# Back4App — setup Fase 2

## Classe AthleteProfile

| Campo | Tipo |
|-------|------|
| `user` | Pointer → `_User` |
| `primaryPosition` | String |
| `secondaryPosition` | String (opcional) |
| `thirdPosition` | String (opcional) |
| `shoeSize` | Number |
| `height` | Number |
| `weight` | Number |
| `favoriteProTeam` | String |
| `peladaRate` | Number (opcional — valor por pelada) |
| `teamMatchRate` | Number (opcional — valor por jogo entre times amadores) |
| `attendanceScore` | Number (default 100) |
| `totalPresent` | Number |
| `totalAbsent` | Number |
| `totalRegistered` | Number |

**CLP sugerida:** Create/Get/Find para autenticado; Update apenas owner (`user`).

## Classe EventRegistration

| Campo | Tipo |
|-------|------|
| `event` | Pointer → `Event` |
| `user` | Pointer → `_User` |
| `role` | String (`athlete`, `referee`, `scout`, `journalist`, `cameraman`, `narrator`, `fan`) |
| `apelido` | String (unico por evento) |
| `athlete` | Pointer → `AthleteProfile` (quando `role = athlete`) |
| `committed` | Boolean |
| `membershipType` | String (`socio` \| `convidado`) |
| `attendance` | String (`pending` \| `present` \| `absent`) |
| `paymentConfirmed` | Boolean (admin confirma pagamento) |
| `isEffectivelyConfirmed` | Boolean (confirmacao efetiva no evento) |
| `avatarUrl` | String (opcional — copia da foto do usuario na inscricao, para listas) |
| `peladaId` | String (opcional — copia do id da pelada do evento) |
| `participantUserId` | String (id do usuario inscrito) |
| `userApelido` | String (apelido do usuario na inscricao) |
| `userFullName` | String (nome completo do usuario) |
| `userDisplayName` | String (nome para exibicao em listas) |

**CLP sugerida:** Create/Get/Find para autenticado. Para o admin da pelada listar todos os participantes na aba Socios, use a Cloud Function `listPeladaEventParticipants` (ver `docs/back4app-cloud-functions.md`) ou permita Find de inscricoes de eventos da pelada. Update de `paymentConfirmed` apenas pelo admin do evento (ideal via Cloud Code; no app, validacao no servico). Usuarios autenticados devem poder ler `avatarUrl` em inscricoes do evento.

**Regra de confirmacao efetiva:** se `participationFee` do evento for 0, `isEffectivelyConfirmed = true` na inscricao. Se houver valor, so fica `true` quando `paymentConfirmed = true` (marcado pelo admin).

## Campos extras em Event

| Campo | Tipo |
|-------|------|
| `readOnlyAt` | Date (`endTime + 2h`) |
| `registrationOpensAt` | Date (inicio das inscricoes) |
| `registrationClosesAt` | Date (fim das inscricoes) |
| `useArrivalOrderForTeams` | Boolean (Pelada/Racha: ordem de chegada na formacao de times) |
| `isFinished` | Boolean (evento encerrado pelo admin) |
| `votingOpensAt` | Date (opcional — inicio da votacao; padrao: `startTime`) |
| `votingClosesAt` | Date (opcional — fim da votacao; padrao: `startTime + 24h`) |
| `adminApelido` | String (opcional — copia para exibir admin sem ler `_User`) |
| `adminName` | String (opcional — nome exibido do admin) |
| `adminAvatarUrl` | String (opcional — URL da foto do admin) |

Pode ser gravado na criacao do evento (ja feito pelo app). Padrao: inscricoes abrem na criacao e encerram no `startTime`.

## Indices uteis

- `EventRegistration`: `event`, `user`
- `AthleteProfile`: `user`
