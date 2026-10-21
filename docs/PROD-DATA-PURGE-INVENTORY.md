# Inventário pré-purge (preencher após backup)

Data do backup: _______________  
App ID Back4App: _______________  
Estratégia escolhida: A / B  

Cole abaixo o resultado de `prodDataPurgeInventory` (`wipeAll: true`) **ou** preencha counts manualmente no Browser.

## Contagens (meta: 0 após purge, exceto MailSettings)

| Classe | Count antes | Count depois | Notas |
|--------|-------------|--------------|-------|
| _User | | | |
| Pelada | | | |
| Event | | | |
| EventRegistration | | | |
| MuralVote | | | |
| AmateurTeam | | | |
| MatchChallenge | | | |
| AppMessage | | | |
| MailSettings | | | **deve permanecer ≥ 1** |

## JSON bruto (opcional)

```json
(cole aqui)
```

## Aprovações

- [ ] Backup verificado offline
- [ ] Dry-run `prodDataPurge` revisado
- [ ] Confirmação escrita para execução (`DELETE_ALL_TEST_DATA`)
