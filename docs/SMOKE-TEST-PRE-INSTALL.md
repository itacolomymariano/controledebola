# Smoke test antes de instalar no dispositivo

Checklist manual (5–10 min) para reduzir regressões antes de `npm run install:android`.

## Build obrigatório

```bash
npm run build:cloud
npm run build
```

Publicar `cloud/main.js` no Back4App quando houver alteração em `cloud/source/`.

## Fluxos críticos

| # | Fluxo | O que validar |
|---|--------|----------------|
| 1 | Login / tabs | Entrada no app, barra superior, menu cortina |
| 2 | Pelada → Configurações | Toggles com texto completo (quebra de linha) |
| 3 | Evento → Participantes (admin) | Lista completa de inscritos |
| 4 | Evento → Negociação/Contratações | Enviar convite; badge na carta do convidado |
| 5 | Caixa de entrada (convidado) | Convite visível; aceitar/recusar; voltar após aceitar |
| 6 | Separação de times | Toque no atleta → barra de times; média de votos; ordem de chegada |
| 7 | Portaria / PIX | Botões copiar PIX; ingresso QR se aplicável |

## Quando rodar

- Após alterações em **Cloud Code**
- Após alterações em **serviços compartilhados** (`registration`, `referee-invitation`, `event`)
- Antes de pedir instalação nos dispositivos Motorola/Samsung

## Regressões comuns (atenção extra)

- Listas admin que dependem de ACL → preferir Cloud Function com master key
- Componentes cacheados pelo Ionic → recarregar em `ionViewWillEnter`
- Badge de convites → atualizar ao navegar, retomar app e periodicamente
