# CPF único em `_User` (produção)

## Regra

O campo `cpf` (11 dígitos, sem máscara) é **único** no app Controle de Bola. Duplicatas quebram integridade de conta, pagamento e rankings.

## Cloud Code

| Função | Uso |
|--------|-----|
| `inventoryDuplicateCpfs` | Lista CPFs com mais de um `objectId` (Master Key ou `secret` = `PROD_PURGE_SECRET`) |
| `registerUser` / `beforeSave(_User)` | Bloqueia novo cadastro com CPF já usado (checagem dupla anti-corrida) |

Módulo: `cloud/source/02d-user-cpf-integrity.js` + `04-auth-signup.js`. Após editar: `npm run build:cloud` → publicar `cloud/main.js`.

### Inventário (API Console)

REST POST `/functions/inventoryDuplicateCpfs` com Master Key, body:

```json
{ "secret": "<PROD_PURGE_SECRET>" }
```

Resposta: `duplicates[]` com `cpf`, `count`, `users[]` (objectId, username, email, createdAt, lastLoginAt).

**Decisão manual:** para cada CPF duplicado, manter uma conta e desativar/remover as outras no Dashboard (não há purge automático nesta função).

### Índice único (Back4App)

**Produção (2026-11-09):** índice manual `cpf_1` em `_User` — `{"cpf":1}`, **Unique: true**, **Sparse: false**, status SUCCESS.

O MongoDB rejeita qualquer `save` com CPF já existente (código **11000** / duplicate key), mesmo se o Cloud Code falhar. Mantenha `registerUser` + `beforeSave` publicados para mensagens amigáveis no app.

**Duplicatas legadas:** contas antigas com o mesmo `cpf` impedem o índice de “fechar” o universo até o inventário ser resolvido; com índice SUCCESS, novos duplicados já não entram — rode `inventoryDuplicateCpfs` e ajuste linhas na tabela abaixo.

## Cliente

Cadastro usa apenas `registerUser` (Cloud). O fallback `registerViaClient` **não** roda em build de produção.

## Registro de decisões (operacional)

| Data | CPF | Conta mantida | Contas removidas/desativadas | Operador |
|------|-----|---------------|-------------------------------|----------|
| | | | | |
