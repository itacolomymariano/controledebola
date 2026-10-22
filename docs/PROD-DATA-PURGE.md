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

- [X] **A** — purge no app `_________________` (App ID)
- [ ] **B** — novo app criado em `_________________` (data)

Responsável: _________________  Data: _________________

Recomendação do plano: volume grande de teste + família → **B** é mais seguro; builds já na loja com o App ID atual → **A** + purge.

---

## Pré-requisitos

1. **Backup** (ver seção [Backup no Back4App](#backup-no-back4app) abaixo) e marcar em [PROD-DATA-PURGE-INVENTORY.md](PROD-DATA-PURGE-INVENTORY.md) (linha *Backup offline* + checkbox *Backup verificado*).
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

**Back4App API Console (REST):** path **`/functions/prodDataPurgeInventory`** (relativo; host já vem do painel). URL completa duplicada → `Not Found`. Validado em produção out/2026 — inventário em [PROD-DATA-PURGE-INVENTORY.md](PROD-DATA-PURGE-INVENTORY.md).

### 1) Inventário (Fase 0 / dry-run)

```http
POST /functions/prodDataPurgeInventory
Content-Type: application/json

{"secret":"<PROD_PURGE_SECRET>","wipeAll":true}
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

## Backup no Back4App

Não existe um menu óbvio **“Backup / Export database”** no dashboard atual. Use **uma ou mais** opções:

| Opção | Onde no painel | Observação |
|-------|----------------|------------|
| **A — Clone App (recomendado se não achar export)** | **App Settings → General** → **Clone App** (ex.: `…/apps/<app-id>/settings/general`) | Marque **clone the database**. Cria **outro app** com cópia do banco **naquele instante**; original e clone **não sincronizam**. [Doc Clone App](https://www.back4app.com/docs/platform/app-settings#24---clone-app). |
| **B — Snapshot / restore via suporte** | Chat Back4App | Planos pagos costumam ter snapshots diários (~7 dias). Peça **restore do app MinhaPelada** se o purge der errado — não depende de você achar botão no painel. |
| **C — Export por classe** | **Database → Browser** → classe → **Edit** → **Export this data** | JSON (ZIP por e-mail) ou CSV. Trabalhoso, mas fica **offline** no seu PC. [FAQ export](https://help.back4app.com/hc/en-us/articles/115003457092). |
| **D — Inventário JSON** | `prodDataPurgeInventory` | Só contagens; **não** restaura dados. |

### Clone App serve para o purge (plano A)?

**Sim, como rede de segurança**, desde que:

1. **Nome claro** — ex. `MinhaPelada-backup-pre-purge-2026-10-21`.
2. **Checkbox “clone the database”** marcada (senão só copia config, não os dados).
3. **Custo** — é um **segundo app** na conta (mesma preocupação do app extra que você apagou). Depois do go-live estável, pode **apagar o clone** para não pagar dois apps para sempre.
4. **Rollback no mesmo App ID** — o clone **não** desfaz o purge dentro do MinhaPelada original. Se algo der errado, caminhos são: (i) pedir **restore** ao suporte no app original; (ii) consultar/copiar dados do **clone** (Browser, export por classe); (iii) em último caso, trocar builds para o App ID do clone (vira cenário tipo **B**).
5. **Arquivos** — fotos/arquivos Parse podem exigir checagem no clone (Browser / Files). Se forem críticos, exporte classes de mídia ou confirme no clone antes do purge.
6. **Cloud Code / env** — o clone pode herdar código; confira **Environment Variables** (`MailSettings` no banco, `PROD_PURGE_SECRET` só no app que você for purgar).

**MailSettings:** no app **MinhaPelada** (original), confira ≥ 1 linha no Browser antes do purge; o clone também deve mostrar a mesma linha se clonou o banco.

Registre no repo: `docs/PROD-DATA-PURGE-INVENTORY.md` — linha *Backup offline* + checkbox *Backup verificado* (método: `clone` / `export` / `suporte`).

## Rollback

- **Clone:** app separado = cópia consultável; voltar o **MinhaPelada** exige suporte ou migração manual, não botão “reverter purge”.
- **Export por classe / snapshot suporte:** restore conforme procedimento Back4App.
- Sem nenhuma das opções acima, **não há** desfazer purge.

---

## Opção B (app novo)

Não rode `prodDataPurge` no app antigo. Crie app, publique Cloud Code, configure MailSettings, atualize chaves no app/CI, rode só os `configure*`, smoke.
