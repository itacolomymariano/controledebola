# Back4App — setup Fase 3 (imagens e times)

## Campo extra em `_User`

| Campo | Tipo |
|-------|------|
| `avatar` | File (foto de perfil) |

**CLP sugerida:** Update apenas owner (`objectId` = usuário logado).

## Classe AmateurTeam

| Campo | Tipo |
|-------|------|
| `name` | String |
| `president` | Pointer → `_User` |
| `teamImage` | File (escudo/imagem do time) |
| `presidentImage` | File (foto do presidente) |
| `uniformId` | String (id do catalogo de uniformes no app) |
| `uniformColors` | Array de 3 strings hex (#RRGGBB) |

**CLP sugerida:** Create/Get/Find para autenticado; Update apenas `president`.

**Indice util:** `president`

## Uniformes no app

O app mantém o catalogo local de camisetas com 3 cores por time das series A, B e C (`src/app/core/data/team-uniforms.data.ts`). O Back4App armazena apenas o `uniformId` e as cores selecionadas.
