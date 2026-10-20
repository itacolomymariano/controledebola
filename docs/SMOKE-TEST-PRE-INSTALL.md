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
| 1 | Login / tabs | Entrada em **`/tabs/home`** (quatro portas): **nenhum** botão do rodapé destacado; toque **Peladas** → lista com botão Peladas destacado; portas confrontos/times/usuários sem destaque no rodapé |
| 2 | Pelada → Configurações | Toggles com texto completo (quebra de linha) |
| 3 | Evento → Participantes (admin) | Inscritos pendentes com card completo; **confirmados** só foto, apelido, perfil, posição (atleta), idade e média CB + controles (chegada, ingresso, time) abaixo |
| 4 | Evento → Negociação/Contratações | Enviar convite; badge na carta do convidado |
| 5 | Caixa de entrada (convidado) | Convite visível; aceitar/recusar; voltar após aceitar |
| 6 | Separação de times | Toque no atleta → barra de times; média de votos; ordem de chegada |
| 7 | Portaria / PIX | Botões copiar PIX; ingresso QR se aplicável |
| 8 | Tab Mural | Abas Geral / Peladas / Confrontos; pódio (craque, goleiro, goleador); acordeões Profissionais e Explorar; share com titulo da aba |
| 9 | Voto mural evento | Torcedor e porteiro aparecem na votacao e entram no Top 10 da aba correspondente; max. 2 notas 10 por cedula |
| 10 | Esqueci senha | Enviar codigo → card com e-mail mascarado → digitar codigo no app (nao e link) |
| 11 | Mural Geral craque | Hint de confianca; card mostra “X pessoas avaliaram” quando houver votos |
| 12 | Cadastro | Subtitulo curto na tela Criar conta; hints de apelido/CPF legiveis |
| 13 | Pelada ? (toolbar) | Ajuda com botao Ouvir (TTS) no popover |
| 14 | Separação de times | Salvar desabilitado se nada mudou; desfazer separacao salva (admin) |
| 15 | Scout + sumula | Gols do juiz aparecem no apontamento; scout so classifica tipo |

## Quando rodar

- Após alterações em **Cloud Code**
- Após alterações em **serviços compartilhados** (`registration`, `referee-invitation`, `event`)
- Antes de pedir instalação nos dispositivos Motorola/Samsung

## Regressões comuns (atenção extra)

- Listas admin que dependem de ACL → preferir Cloud Function com master key
- Componentes cacheados pelo Ionic → recarregar em `ionViewWillEnter`
- Badge de convites → atualizar ao navegar, retomar app e periodicamente
