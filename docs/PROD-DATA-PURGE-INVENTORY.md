# Inventário pré-purge (MinhaPelada — plano A)

**Onde marcar backup:** neste arquivo no repositório (`docs/PROD-DATA-PURGE-INVENTORY.md`), **não** no painel Back4App. Como exportar: [PROD-DATA-PURGE.md — Backup no Back4App](PROD-DATA-PURGE.md#backup-no-back4app).

| Campo | Valor |
|-------|--------|
| Data inventário | 2026-10-21 |
| Função | `prodDataPurgeInventory` via REST path **`/functions/prodDataPurgeInventory`** |
| `wipeAll` | true |
| Estratégia | **A** (purge no app MinhaPelada) |
| Backup offline | [x] Feito em 2026-10-21 — método: **clone app** `Clone_MinhaPelada` (conferir Browser no clone ≈ contagens abaixo) |
| **Execução purge** | **2026-10-21** — `prodDataPurge` `dryRun:false`, 1 rodada, `hint`: Rodada concluida |

## Totais principais (count antes)

| Classe | Count antes | Count depois | Notas |
|--------|-------------|--------------|-------|
| _User | 121 | **0** | deleted 121 |
| _Session | 159 | **0** | purge apagou 158 (pré-exec) |
| _Installation | 26 | **0** | |
| Pelada | 12 | **0** | |
| Event | 42 | **0** | |
| EventRegistration | 279 | **0** | |
| MuralVote | 633 | **0** | |
| EventPerformance | 103 | **0** | |
| RefereeInvitation | 99 | **0** | |
| AppMessage | 126 | **0** | |
| AthleteProfile | 99 | **0** | |
| RoleProfile | 25 | **0** | |
| PeladaMembershipFee | 94 | **0** | |
| PeladaCashEntry | 80 | **0** | |
| PeladaMembership | 51 | **0** | |
| AmateurTeam | 7 | **0** | |
| MatchChallenge | 4 | **0** | |
| MailSettings | _(protected)_ | _(n/a)_ | SMTP via **env vars** `SMTP_*`; não apagado |

Demais classes (mídia, material, lendas, etc.): ver JSON abaixo.

## Aprovações

- [x] Backup verificado offline (clone `Clone_MinhaPelada`: _User 121, Pelada 12, Event 42)
- [x] Dry-run `prodDataPurge` (`/functions/prodDataPurge`, `dryRun: true`) revisado — 2026-10-21; `deleted: 0` em todas as classes; `_User` 121, `Pelada` 12, `Event` 42, `MuralVote` 633; `_Session` 158 (inventário 159)
- [x] Confirmação escrita para execução (`DELETE_ALL_TEST_DATA`) — 2026-10-21, canal chat: **pode executar purge**
- [x] Pós-purge: 6× `configure*` CLPs (2026-10-21)
- [ ] Smoke: cadastro → pelada → evento
- [x] Inventário pós: `prodDataPurgeInventory` 2026-10-21 — todas classes `count: 0`; `MailSettings` / `_GlobalConfig` protected

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
