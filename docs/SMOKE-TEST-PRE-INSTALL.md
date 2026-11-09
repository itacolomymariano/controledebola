# Smoke test antes de instalar no dispositivo

Checklist manual (5–10 min) para reduzir regressões antes de `npm run install:android`.

## Build obrigatório

```bash
npm run build:cloud
npm run build
```

Publicar `cloud/main.js` no Back4App quando houver alteração em `cloud/source/`.

## Matriz wizard (cadastros)

| Tela | Modo |
|------|------|
| register, profile-setup, pelada/evento/confronto/desafio/team **criar**, perfis atleta/torcedor/pro **criar** | Wizard |
| **account-edit**, **event-register** | Wizard (2026-11) |
| pelada-form / team-form **edição** | Formulario unico |
| legend-*-form, contact/* | Excecao — formulario curto |

## Fluxos críticos

| # | Fluxo | O que validar |
|---|--------|----------------|
| 0 | Sobre (build UX) | Antes de validar wizard Xaiana/Nicole: **Versão** ≥ **1.0.10**, build **> 295**, release **≥ 2026.11.04.0298** — ver [XAIANA-VALIDACAO-UX-POS-BUILD.md](XAIANA-VALIDACAO-UX-POS-BUILD.md) |
| 1 | Login / tabs | **`/tabs/home`**: hero compacto (avatar ampliável ao toque), **grid 2×3** com **6 portas** (Peladas, Confrontos, Times, Usuários, Convidar amigos, Mural do app); logo/avatar na user-bar ampliam na Home; aba **Início** no rodapé; 2ª aba **Peladas** → lista com FAB **+** |
| 1a | Home → diretórios | Confrontos e Times (ativos): FAB **+** canto inferior direito (desafio / novo time); toque em **Convidar amigos** abre share |
| 1b | Wizard pelada/desafio | Progresso **Passo 1 de 4** (não `{current}`); **?** no passo; **Voltar** sem tela errada; **Sair e continuar depois** salva rascunho |
| 1c | Mural Geral | Hero **Craque do App** + grid **Conquistas** (playful); ranking com avatar |
| 1c | Mural Pelada / Evento | Aba **Mural** na pelada e **Mural do evento**: hero + conquistas, hubs com cartão porta, rankings em linhas playful |
| 1b | Perfil atleta | Labels completos das taxas pelada e **jogo entre times amadores (R$)** (sem reticências) |
| 1c | Tema | Menu → Cores e temas: paleta **Controle de Bola** visível; trocar claro/escuro muda toolbar, **fundo com orbes** (playful), **tab bar em cápsula** na aba ativa e tons pastel dos cartões “porta” |
| 16 | Perfis pro (wizard) | Perfil → criar função (ex. árbitro): passos intro / valores / equipamentos / Pix / histórico; **Sair e continuar depois**; editar perfil existente = formulário único |
| 15 | Playful UI | Login e **Cadastro** com cartões/fundo colorido; **Peladas** → lista em **grid 2 col** com cartões **pastéis + onda + seta** (itens clicáveis); **Buscar** → idem; **Perfil** / **Inbox** / filtros **Mural**: linhas em cartão elevado; **Detalhe evento** e **subtelas do evento** com fundo/orbes |
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
| 12 | Cadastro | Wizard **Criar conta** (5 passos): progresso, Continuar/Voltar; ajuda (?) em apelido/CPF/celular/endereco; criar conta teste ate profile-setup; **segundo CPF igual falha** (mensagem amigavel) |
| 12a | Meus dados | Perfil → **Meus dados**: wizard 3 passos (dados / contato / endereco); Salvar no ultimo passo |
| 12b | Inscricao evento | Evento → inscricao: wizard **papel** → **confirmacao** (PIX + compromisso); progresso no topo |
| 12c | User-bar inbox | 1 mensagem nao lida, 0 convites → ler Entrada → badge **vermelho 0**; convite pendente → badge **amarelo** separado (canto esquerdo do envelope) |
| 12d | Montar perfil | Wizard **profile-setup**: atleta 3 passos; torcedor 2; profissional por etapas (valores/Pix/equip.); Completar depois; rascunho ao voltar |
| 13 | Pelada ? (toolbar) | Ajuda com botao Ouvir (TTS) no popover |
| 14 | Separação de times | Salvar desabilitado se nada mudou; desfazer separacao salva (admin) |
| 15 | Scout + sumula | Gols do juiz aparecem no apontamento; scout so classifica tipo |
| 16 | Home → Usuarios | Porta Usuarios → card → hub do usuario → abrir **cada perfil listado** (torcedor, atleta, profissionais); torcedor/profissionais **sem** "Perfil nao encontrado" (Cloud `getRolePublicProfile` alinhado ao diretorio) |
| 17 | Home → Times → Novo Time | Aba **Novo Time** → cadastro time lenda (`/legends/team/new`); opcional `presidentUser` no form |
| 18 | Time lenda | Elenco com foto, apelido, idade ou **in memoriam**; **Solicitar participacao**; inbox (2 responsaveis) aceitar + **Ver perfil do atleta**; segundo aceite sem duplicar atleta |
| 19 | Busca | Resultados ordenados por proximidade (endereco do usuario); busca por **objectId** 24 hex (perfil/time lenda) |
| 20 | ID cadastro | Telas de visualizacao exibem **ID do cadastro** copiavel (time ativo/lenda, atleta lenda, usuario Home) |

## Quando rodar

- Após alterações em **Cloud Code**
- Após alterações em **serviços compartilhados** (`registration`, `referee-invitation`, `event`)
- Antes de pedir instalação nos dispositivos Motorola/Samsung

## Regressões comuns (atenção extra)

- Listas admin que dependem de ACL → preferir Cloud Function com master key
- Componentes cacheados pelo Ionic → recarregar em `ionViewWillEnter`
- Badge de convites → atualizar ao navegar, retomar app e periodicamente
