# Imprensa / Midia do evento

Complementa `AGENTS.md` e o guia de arquitetura. Implementação: `cloud/source/12-event-media.js` + `event-media.service.ts`.

## Papéis e formatos

| Papel | Página produtor | Formato | Mural do evento |
|-------|-----------------|--------|-----------------|
| Cinegrafista | `/event/:id/cameraman-coverage` | Vídeo ≤5 min (melhores momentos) | Hub → **Vídeo** |
| Narrador | `/event/:id/narrator-radio` | Áudio (narração / entrevista) + título + descrição | Hub → **Rádio** |
| Jornalista | `/event/:id/journalist-journal` | Texto + foto (reportagem / entrevista) | Hub → **Jornal** |

Requisito: inscrição no papel **efetivamente confirmada**.

## Regras de publicação

- **1 publicação por slot** por evento (ex.: um vídeo de melhores momentos). Novo envio **substitui** o anterior e zera views/reações/comentários daquele slot.
- Antes de publicar: título + breve descrição (jornalista: manchete + corpo).
- Vídeo: duração validada no cliente e no Cloud (`durationSec` ≤ 300); arquivo até ~80 MB.

## Engajamento (todos os formatos)

| Mecânica | Regra |
|----------|--------|
| Visualizações | 1 por `_User` por categoria (`EventMediaView`). **Conta para TOP** só se viewer for participante efetivamente confirmado e **não** for o autor |
| Reações na mídia | Estilo Facebook; uma por usuário; autor **não** pode reagir na própria publicação |
| Comentários | Vários por usuário; respostas via `parentCommentId`. Disciplina (palavrões) + autor **não** comenta na própria publicação |
| Reações em comentário | `EventMediaReaction` com `commentId`; uma por usuário por comentário |

Nota 0–10 (`EventMediaVote`) foi **retirada** da UI de rádio/jornal/vídeo.

## Destaques nos murais

- TOP por **views que contam** (`*ViewCount`); exige quórum ≥ **3** views.
- Rádio/jornal: busca ordenada pelos campos de view (não amostra aleatória).
- CLP: create/update/delete de classes de mídia **só via Cloud** (`configureEventMediaClassPermissions`).

Cloud: `getTopEventMedia({ kind, scope, peladaId? })`. UI: `app-mural-media-top-card`.

## Operação Back4App

Após publicar `cloud/main.js`, rodar **uma vez** (REST + Master Key):

`configureEventMediaClassPermissions`

Procedimento completo (API Console REST/JS, erros, outras `configure*`):  
[BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md](BACK4APP-CLOUD-FUNCTIONS-CONSOLE.md).

### Consumo no mural do evento

1. Mural do evento → card **Imprensa / Midia** (mostra manchete/título se já houver publicação)
2. **Abrir cobertura** → hub Radio / Jornal / Video
3. Páginas do hub resolvem `eventId` via `resolveRouteParam` (`pathFromRoot`) — rotas aninhadas `/event/:id/mural/media/...`

Sucesso conhecido (primeira execução, classes novas):

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
