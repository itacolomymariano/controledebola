# Back4App — como rodar Cloud Functions (API Console)

Guia operacional para agents e humanos. Complementa `AGENTS.md` e o guia de arquitetura.

O console atual (**API → Console**) **não** tem opção “Cloud Function”. Use **REST** (preferido) ou **Javascript**.

---

## Pré-requisito

1. Alterar só `cloud/source/*.js`
2. `npm run build:cloud` → gera `cloud/main.js`
3. Publicar / substituir `cloud/main.js` no Back4App (**Cloud Code**) e aguardar o deploy
4. Confirmar no editor do Cloud Code que o `Parse.Cloud.define('nomeDaFuncao'` existe no arquivo publicado

Sem o passo 3, a API responde `Not Found` ou `Invalid function` (código 141).

---

## Opção A — REST (recomendada para `configure*`)

1. Back4App → app → **API** → **Console** → aba **REST**
2. Método: **POST**
3. Path (completo ou relativo ao host Parse):

   ```
   /functions/NOME_DA_FUNCAO
   ```

   Exemplo:

   ```
   /functions/configureEventMediaClassPermissions
   ```

   Host típico: `https://parseapi.back4app.com`

4. Headers (App Settings → **Security & Keys**):

   | Header | Valor |
   |--------|--------|
   | `X-Parse-Application-Id` | Application ID |
   | `X-Parse-Master-Key` | **Master Key** (obrigatória para funções `configure*` sem usuário logado) |
   | `Content-Type` | `application/json` |

5. Body:

   ```json
   {}
   ```

   (ou o JSON de params da função, se houver)

6. **Send**

### Sucesso típico (`configureEventMediaClassPermissions`)

```json
{
  "result": {
    "ok": true,
    "classes": 5,
    "created": [
      "EventMediaPublication",
      "EventMediaVote",
      "EventMediaView",
      "EventMediaReaction",
      "EventMediaComment"
    ],
    "updated": []
  }
}
```

`created` = schema/CLP criados agora; `updated` = classes que já existiam.

---

## Opção B — Javascript (API Console)

Na aba **Javascript**:

```javascript
Parse.Cloud.run('configureEventMediaClassPermissions', {})
  .then(console.log)
  .catch(console.error);
```

**Limitação:** o console JS em geral **não** envia Master Key nem sessão de usuário. Funções que exigem `request.master || request.user` retornam:

> Faca login no app ou chame com Master Key / REST API Key.

Nesses casos use a **Opção A (REST)** com Master Key.

---

## Erros frequentes

| Resposta | Causa | Ação |
|----------|--------|------|
| `Not Found` / `{}` | Função ausente no `main.js` publicado, path errado, ou chamada como Job | Republicar `main.js`; path `/functions/NomeExato`; não usar endpoint de Jobs |
| `Invalid function` (141) | Nome digitado errado ou Cloud Code antigo | Conferir `Parse.Cloud.define` no Cloud Code online |
| Login / Master Key obrigatórios | REST sem Master Key ou JS Console sem sessão | REST + `X-Parse-Master-Key` |
| `Class X does not exist` (103) | CLP via `schema.update()` em classe nova | Função deve fazer `update` e, se falhar, `schema.save()` (já corrigido em `configureEventMediaClassPermissions`) |

---

## Funções `configure*` após deploy Cloud

Rodar **uma vez** por ambiente (ou de novo se classes forem apagadas), via REST + Master Key:

| Função | Módulo | Classes |
|--------|--------|---------|
| `configureMuralClassPermissions` | `07-mural.js` | mural, perfis, eventos (CLP amplo) |
| `configureMaterialClassPermissions` | `13-material.js` | inventário / sessão material |
| `configureSupportRolesClassPermissions` | `14-support-roles.js` | torcida, treinador, massagista, PF |
| `configureEventMediaClassPermissions` | `12-event-media.js` | imprensa (publicação, votos, views, reações, comentários) |

Detalhes de mídia: [EVENT-MEDIA.md](EVENT-MEDIA.md).

---

## Segurança

- **Nunca** colocar Master Key no app cliente (`environment*.ts`, Capacitor, etc.)
- Usar Master Key só no dashboard / scripts de ops / Cloud Code com `useMasterKey`
- Não colar Master Key em issues, PRs ou chats públicos
