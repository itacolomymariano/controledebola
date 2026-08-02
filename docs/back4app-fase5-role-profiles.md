# Back4App — perfis profissionais e palpites (Fase 5)

## Classe RoleProfile

Perfil para Juiz, Scout, Jornalista, Cinegrafista e Narrador.

| Campo | Tipo | Uso |
|-------|------|-----|
| `user` | Pointer → `_User` | Dono do perfil |
| `role` | String | `referee`, `scout`, `journalist`, `cameraman`, `narrator` |
| `peladaRate` | Number | Juiz, Scout, Jornalista |
| `matchRate` | Number | Juiz, Scout, Jornalista |
| `athleteRate` | Number | Scout |
| `peladaLiveRate` | Number | Cinegrafista, Narrador |
| `matchLiveRate` | Number | Cinegrafista, Narrador |
| `peladaHighlightEditRate` | Number | Cinegrafista |
| `matchHighlightEditRate` | Number | Cinegrafista |
| `peladaGoalNarrationEditRate` | Number | Narrador |
| `matchGoalNarrationEditRate` | Number | Narrador |
| `hasOwnEquipment` | Boolean | Juiz |
| `pixKey1` | String | Todos os perfis profissionais |
| `pixKey2` | String | Opcional |
| `pixKey3` | String | Opcional |
| `userApelido` | String | Copia do apelido do usuario (busca de arbitros) |
| `userName` | String | Nome exibido na busca |
| `userCity` | String | Cidade do usuario |
| `userState` | String | Estado do usuario |
| `userLatitude` | String | Coordenada para ordenacao por proximidade |
| `userLongitude` | String | Coordenada para ordenacao por proximidade |
| `userAvatarUrl` | String | URL da foto do usuario |
| `userId` | String | ID do usuario (redundante para busca) |

**CLP sugerida:** Create/Get/Find para autenticado; Update apenas owner (`user`). Para a busca de arbitros no evento, usuarios autenticados precisam poder `find` em `RoleProfile` (incluindo campos `userApelido` e `userName`).

## Classe FanPrediction

Palpites do torcedor (sem classe de perfil dedicada).

| Campo | Tipo |
|-------|------|
| `user` | Pointer → `_User` |
| `event` | Pointer → `Event` |
| `topScorerUserId` | String | Pelada/Racha: atleta com mais gols |
| `leastConcededKeeperUserId` | String | Pelada/Racha: goleiro menos vazado |
| `homeScore` | Number | Partida: placar mandante |
| `awayScore` | Number | Partida: placar visitante |
| `homeTeamName` | String | Partida |
| `awayTeamName` | String | Partida |
| `goalScorers` | Array | `{ userId, goals }[]` |
| `expelledUserIds` | Array | String[] |
| `yellowCardUserIds` | Array | String[] |

**CLP sugerida:** Create/Get/Find para autenticado; um registro por `user` + `event`.

## Campos extras em Event (jogo entre equipes)

| Campo | Tipo |
|-------|------|
| `homeTeamName` | String (opcional) |
| `awayTeamName` | String (opcional) |

## Indices uteis

- `RoleProfile`: `user`
- `FanPrediction`: `event`, `user`
