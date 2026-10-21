# Limpeza da base para produção (Back4App / Parse)

Procedimento operacional. Cloud: [cloud/source/19-prod-data-purge.js](../cloud/source/19-prod-data-purge.js).

**Nunca** use Master Key ou `PROD_PURGE_SECRET` no app cliente ou no Git.

---

## Decisão estratégica (registrar antes de apagar)

| Opção | Descrição | Quando usar |
|-------|-----------|-------------|
| **A — Purge no app atual** | Mesmo App ID / chaves nos builds da Play e TestFlight | Manter um único backend; aceitar job ordenado + backup |
| **B — Novo app Back4App** | Base vazia; trocar `environment.local.ts` + secret `ENVIRONMENT_LOCAL_TS` | Go-live “zero lixo”; app antigo vira sandbox |

**Registro da escolha (preencher antes da Fase 3):**

- [ ] **A** — purge no app `_________________` (App ID)
- [ ] **B** — novo app criado em `_________________` (data)

Responsável: _________________  Data: _________________

Recomendação do plano: volume grande de teste + família → **B** é mais seguro; builds já na loja com o App ID atual → **A** + purge.

---

## Pré-requisitos

1. Backup Back4App (Database → Export ou backup do plano).
2. Tag Git: `pre-prod-purge-YYYY-MM-DD`.
3. Congelar testes (ninguém cria pelada/evento na janela).
4. Back4App → App Settings → **Environment Variables** → `PROD_PURGE_SECRET` (string longa aleatória; só no painel).
5. `npm run build:cloud` → publicar [cloud/main.js](../cloud/main.js) no Cloud Code.

---

## Funções Cloud

| Função | Uso |
|--------|-----|
| `prodDataPurgeInventory` | Contagens por classe (sempre seguro) |
| `prodDataPurge` | `dryRun: true` → contagens; `dryRun: false` → apaga em lotes |

Headers REST: ver [BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md) (`X-Parse-Master-Key`, `X-Parse-Application-Id`).

### 1) Inventário (Fase 0 / dry-run)

```http
POST /functions/prodDataPurgeInventory
Content-Type: application/json

{
  "secret": "<PROD_PURGE_SECRET>",
  "wipeAll": true
}
```

Guarde o JSON em [PROD-DATA-PURGE-INVENTORY.md](PROD-DATA-PURGE-INVENTORY.md) (coluna “count”).

### 2) Simulação (Fase 2)

```http
POST /functions/prodDataPurge
Content-Type: application/json

{
  "secret": "<PROD_PURGE_SECRET>",
  "dryRun": true,
  "wipeAll": true
}
```

Revise `steps[].remaining` (usuários, peladas, eventos).

### 3) Execução (Fase 3 — só após confirmação escrita)

Segunda confirmação humana: você deve ter escrito explicitamente **“pode executar purge”** no canal acordado.

```http
POST /functions/prodDataPurge
Content-Type: application/json

{
  "secret": "<PROD_PURGE_SECRET>",
  "dryRun": false,
  "wipeAll": true,
  "confirmPhrase": "DELETE_ALL_TEST_DATA"
}
```

Repita até `prodDataPurgeInventory` mostrar `_User`, `Pelada`, `Event` = 0. Se uma classe ficar com `remaining > 0`, rode de novo com:

```json
{ "startAtClass": "EventRegistration", ... }
```

Limite por invocação: até 40 lotes × 200 linhas por classe (~8000/class/run). Classes grandes exigem várias chamadas.

---

## Preservado

- Classe **MailSettings** (SMTP)
- Schemas / CLPs (só linhas apagadas)
- Cloud Code e env vars do app (exceto dados)

---

## Pós-purge (Fase 3)

Rodar no API Console (REST + Master Key), uma vez:

- `configureMailSettingsClassPermissions`
- `configureMuralClassPermissions`
- `configureMaterialClassPermissions`
- `configureSupportRolesClassPermissions`
- `configureEventMediaClassPermissions`
- `configureAppMailboxClassPermissions`

Smoke: [SMOKE-TEST-PRE-INSTALL.md](SMOKE-TEST-PRE-INSTALL.md) + cadastro novo → pelada → evento.

---

## Rollback

Restaurar backup Back4App exportado na Fase 0. Não há “desfazer” purge sem backup.

---

## Opção B (app novo)

Não rode `prodDataPurge` no app antigo. Crie app, publique Cloud Code, configure MailSettings, atualize chaves no app/CI, rode só os `configure*`, smoke.
