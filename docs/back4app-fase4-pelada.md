# Back4App — Controle de Bola (Pelada e financeiro)

## Classe Pelada

```
name            String
sport           String   // campo | futsal | society | beach
admin           Pointer<_User>
adminPhoto      File     (opcional)
address         Object   (mesmo schema de Event.address)
locationPhoto   File     (opcional)
memberCount     Number
foundedAt       Date     (opcional)
monthlyFee      Number   (mensalidade padrao; 0 = sem mensalidade)
```

## Alteracao em Event

```
pelada          Pointer<Pelada>
```

## Classe PeladaMembership

```
pelada          Pointer<Pelada>
user            Pointer<_User>
status          String   // active | pending | inactive
role            String   // socio | admin
joinedAt        Date
memberApelido   String (opcional — copia para exibicao)
memberFullName  String (opcional)
memberDisplayName String (opcional)
memberAvatarUrl String (opcional)
memberUserId    String (id do usuario inscrito)
```

Indice unico recomendado: `pelada` + `user`.

## Campos extras em Pelada

```
adminApelido    String (opcional)
adminName       String (opcional — nome exibido do admin)
adminAvatarUrl  String (opcional)
```

## Classe PeladaCotinha

```
pelada          Pointer<Pelada>
title           String
description     String
targetAmount    Number
status          String   // open | closed
createdBy       Pointer<_User>
createdAt       Date
```

## Classe PeladaCotinhaPayment

```
cotinha         Pointer<PeladaCotinha>
user            Pointer<_User>
amount          Number
paidAt          Date
confirmedByAdmin Boolean
confirmedAt     Date     (opcional)
confirmedBy     Pointer<_User> (opcional)
cashEntryId     String   (opcional — entrada automatica no caixa)
```

## Classe PeladaCashEntry

```
pelada          Pointer<Pelada>
date            Date
type            String   // in | out
amount          Number
description     String
createdBy       Pointer<_User>
cotinha         Pointer<PeladaCotinha> (opcional)
```

## Classe PeladaMembershipFee

```
membership      Pointer<PeladaMembership>
pelada          Pointer<Pelada>
referenceMonth  Date
amount          Number
dueDate         Date
paymentConfirmed Boolean
confirmedAt     Date     (opcional)
confirmedBy     Pointer<_User> (opcional)
```

## Classe EventPerformance

```
event           Pointer<Event>
pelada          Pointer<Pelada> (opcional)
user            Pointer<_User>
role            String   // athlete | goalkeeper | referee | scout | journalist | cameraman | narrator
goals           Number
assists         Number
saves           Number
yellowCards     Number
redCards          Number
points          Number
```

## Classe MuralVote

```
scope           String   // app | pelada | event
scopeId         String   (opcional — peladaId ou eventId)
voter           Pointer<_User>
targetUser      Pointer<_User>
targetRole      String
score           Number   (0-10)
period          String
createdAt       Date
```

## CLP sugerida (resumo)

| Classe | Leitura | Escrita |
|--------|---------|---------|
| Pelada | Publico autenticado | Admin da pelada |
| PeladaMembership | Membros da pelada | Admin |
| PeladaCotinha | Membros | Admin cria; socios pagam |
| PeladaCotinhaPayment | Membros | Socio cria; admin confirma |
| PeladaCashEntry | Socios ativos | Admin |
| PeladaMembershipFee | Socios / admin | Admin |
| EventPerformance | Publico autenticado | Admin do evento |
| MuralVote | Publico autenticado | Voter = current user |

Ideal: regras finas via Cloud Code depois.

## Migracao de eventos legados

O app cria automaticamente uma pelada "Pelada Legada" para o admin com eventos sem `pelada` e vincula os eventos na primeira listagem de peladas.
