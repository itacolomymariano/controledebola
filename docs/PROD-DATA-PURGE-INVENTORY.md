# Inventário pré-purge (MinhaPelada — plano A)

| Campo | Valor |
|-------|--------|
| Data inventário | 2026-10-21 |
| Função | `prodDataPurgeInventory` via REST path **`/functions/prodDataPurgeInventory`** |
| `wipeAll` | true |
| Estratégia | **A** (purge no app MinhaPelada) |
| Backup offline | _(preencher quando concluído)_ |

## Totais principais (count antes)

| Classe | Count antes | Count depois | Notas |
|--------|-------------|--------------|-------|
| _User | 121 | | |
| _Session | 159 | | |
| _Installation | 26 | | |
| Pelada | 12 | | |
| Event | 42 | | |
| EventRegistration | 279 | | |
| MuralVote | 633 | | |
| EventPerformance | 103 | | |
| RefereeInvitation | 99 | | |
| AppMessage | 126 | | |
| AthleteProfile | 99 | | |
| RoleProfile | 25 | | |
| PeladaMembershipFee | 94 | | |
| PeladaCashEntry | 80 | | |
| PeladaMembership | 51 | | |
| AmateurTeam | 7 | | |
| MatchChallenge | 4 | | |
| MailSettings | _(protected)_ | | **Não apagar** — conferir ≥ 1 linha no Browser antes do purge |

Demais classes (mídia, material, lendas, etc.): ver JSON abaixo.

## Aprovações

- [ ] Backup verificado offline
- [ ] Dry-run `prodDataPurge` (`/functions/prodDataPurge`, `dryRun: true`) revisado
- [ ] Confirmação escrita para execução (`DELETE_ALL_TEST_DATA`)

## JSON bruto (`prodDataPurgeInventory`, 2026-10-21)

```json
{
  "result": {
    "ok": true,
    "dryRun": true,
    "wipeAll": true,
    "createdBefore": null,
    "classes": [
      { "className": "EventMediaComment", "count": 5, "skipped": false },
      { "className": "EventMediaVote", "count": 4, "skipped": false },
      { "className": "EventMediaView", "count": 8, "skipped": false },
      { "className": "EventMediaReaction", "count": 5, "skipped": false },
      { "className": "EventMediaPublication", "count": 3, "skipped": false },
      { "className": "MuralVote", "count": 633, "skipped": false },
      { "className": "EventPerformance", "count": 103, "skipped": false },
      { "className": "FanPrediction", "count": 31, "skipped": false },
      { "className": "FanEventCheckIn", "count": 1, "skipped": false },
      { "className": "CoachEventBoard", "count": 0, "skipped": false },
      { "className": "MasseurTreatment", "count": 1, "skipped": false },
      { "className": "PhysicalTrainerSession", "count": 1, "skipped": false },
      { "className": "EventMaterialSession", "count": 4, "skipped": false },
      { "className": "MaterialInventoryItem", "count": 4, "skipped": false },
      { "className": "RefereeInvitation", "count": 99, "skipped": false },
      { "className": "TeamMatchJoinRequest", "count": 7, "skipped": false },
      { "className": "AmateurTeamJoinRequest", "count": 1, "skipped": false },
      { "className": "EventRegistration", "count": 279, "skipped": false },
      { "className": "MatchChallenge", "count": 4, "skipped": false },
      { "className": "Event", "count": 42, "skipped": false },
      { "className": "PeladaCotinhaPayment", "count": 2, "skipped": false },
      { "className": "PeladaCotinha", "count": 1, "skipped": false },
      { "className": "PeladaMembershipFee", "count": 94, "skipped": false },
      { "className": "PeladaCashEntry", "count": 80, "skipped": false },
      { "className": "PeladaMembership", "count": 51, "skipped": false },
      { "className": "Pelada", "count": 12, "skipped": false },
      { "className": "AmateurTeamMembership", "count": 11, "skipped": false },
      { "className": "AmateurTeam", "count": 7, "skipped": false },
      { "className": "AppMessage", "count": 126, "skipped": false },
      { "className": "MuralHighlightTenure", "count": 21, "skipped": false },
      { "className": "AmateurLegendAthlete", "count": 2, "skipped": false },
      { "className": "AmateurLegendTeam", "count": 1, "skipped": false },
      { "className": "ProLegendAthlete", "count": 5, "skipped": false },
      { "className": "AthleteProfile", "count": 99, "skipped": false },
      { "className": "RoleProfile", "count": 25, "skipped": false },
      { "className": "FanProfile", "count": 4, "skipped": false },
      { "className": "_Installation", "count": 26, "skipped": false },
      { "className": "_Session", "count": 159, "skipped": false },
      { "className": "_User", "count": 121, "skipped": false },
      { "className": "MailSettings", "count": null, "skipped": true, "reason": "protected" },
      { "className": "_GlobalConfig", "count": null, "skipped": true, "reason": "protected" }
    ]
  }
}
```
