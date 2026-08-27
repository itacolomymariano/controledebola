/**
 * Gera planilha Excel do fluxo de testes (ciclo de vida + perfis)
 * para enviar aos testers.
 *
 * Uso:
 *   node scripts/generate-test-flow-xlsx.js
 *
 * Saida:
 *   exports/Fluxo-Testes-Controle-de-Bola.xlsx
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'exports');

function ensureXlsx() {
  try {
    return require('xlsx');
  } catch {
    console.log('Instalando dependencia xlsx (temporaria)...');
    execSync('npm install xlsx@0.18.5 --no-save', { cwd: root, stdio: 'inherit' });
    return require('xlsx');
  }
}

function sheetFromRows(rows) {
  const XLSX = ensureXlsx();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const colWidths = rows[0].map((_, colIdx) => {
    let max = 10;
    for (const row of rows) {
      const len = String(row[colIdx] ?? '').length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 55) };
  });
  ws['!cols'] = colWidths;
  return ws;
}

const instrucoes = [
  ['Controle de Bola App — Planilha de Testes'],
  [''],
  ['Objetivo'],
  [
    'Guiar testers passo a passo no ciclo de vida do app (cadastro → pelada → evento → jogo → mural) e na experiencia de cada perfil, sem duvida de quem faz o que.',
  ],
  [''],
  ['Como usar'],
  ['1. Leia a aba Contas e preencha e-mail/senha das contas de teste (nao compartilhe senhas em grupos publicos).'],
  ['2. Siga a aba Fluxo Ciclo de Vida na ordem (coluna Ordem). Cada linha e uma acao de um usuario/perfil.'],
  ['3. Na coluna Resultado do teste, marque: OK / FALHOU / PULEI.'],
  ['4. Se falhou, preencha Severidade (P0 = trava o uso; P1 = atrito forte; P2 = detalhe) e Observacao.'],
  ['5. Para aprofundar um papel, use a aba Por Perfil (casos especificos de cada um dos 13 perfis).'],
  ['6. Registre bugs na aba Registro de Bugs.'],
  [''],
  ['Ambiente'],
  ['Web: http://localhost:8100 (npm start)  |  Android: APK  |  iOS: TestFlight (quando Apple estiver ativa)'],
  [''],
  ['Ordem minima (1a sessao, ~45-90 min, so Admin + Atleta A)'],
  ['Fazer linhas do Fluxo com IDs: A3-A6, B1-B3, C1-C6, E1-E2, F1-F5.'],
  [''],
  ['Severidade'],
  ['P0 = Bloqueia o uso (nao consegue concluir a etapa)'],
  ['P1 = Consegue, mas com atrito forte ou confusao'],
  ['P2 = Cosmetico / melhoria'],
  [''],
  ['Documento de referencia no projeto'],
  ['docs/FLUXO-TESTES-CICLO-DE-VIDA.md'],
];

const contas = [
  [
    'Papel no teste',
    'Perfil no app',
    'Responsabilidade',
    'E-mail',
    'Senha',
    'Telefone',
    'Nome exibido',
    'Tester responsavel',
    'Pronto?',
  ],
  [
    'Admin',
    'Organizador (atleta ou perfil escolhido)',
    'Cria pelada e evento; aprova; confirma pagamento; marca chegada; envia convites; finaliza evento',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'Atleta A',
    'Atleta',
    'Se inscreve no evento; joga; vota no mural',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'Atleta B',
    'Atleta',
    'Segundo atleta (time / conflito de agenda) — opcional na 1a rodada',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'Contratado (Juiz ou Scout)',
    'Juiz ou Scout / Mesario',
    'Recebe convite na Caixa de Entrada; aceita; usa sumula ou board scout',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'Torcedor',
    'Torcedor',
    'Palpites e check-in de torcida — opcional na 1a rodada',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    'Outros perfis (sob demanda)',
    'Ver aba Por Perfil',
    'Narrador, Jornalista, Treinador, PF, Massagista, Roupeiro, Gandula, Porteiro, Cinegrafista',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
];

const fluxoHeader = [
  'Ordem',
  'Fase',
  'ID',
  'Quem opera',
  'Perfil / papel',
  'O que fazer (passo a passo)',
  'Onde no app',
  'Resultado esperado',
  'Obrigatorio?',
  'Resultado do teste',
  'Severidade se falhou',
  'Observacao',
  'Tester',
  'Data',
];

const fluxoRows = [
  // A
  [1, 'A - Entrada e cadastro', 'A1', 'Qualquer', '—', 'Abrir o app (ou o site local).', 'Tela inicial', 'Aparece splash e em seguida onboarding ou login.', 'Sim', '', '', '', '', ''],
  [2, 'A - Entrada e cadastro', 'A2', 'Usuario novo', '—', 'Se for a primeira vez, concluir o onboarding (3 telas) ate o fim.', 'Onboarding', 'Segue para login ou criar conta, sem travar.', 'Se 1a vez', '', '', '', '', ''],
  [3, 'A - Entrada e cadastro', 'A3', 'Admin', 'Organizador', 'Criar conta do Admin (e-mail/telefone, senha, captcha se pedir).', 'Criar conta', 'Conta criada; entra no app ou volta para login.', 'Sim', '', '', '', '', ''],
  [4, 'A - Entrada e cadastro', 'A4', 'Admin', 'Organizador', 'Completar montagem de perfil (wizard / profile-setup) escolhendo o caminho oferecido.', 'Montar perfil', 'Chega na aba Peladas com perfil pronto.', 'Sim', '', '', '', '', ''],
  [5, 'A - Entrada e cadastro', 'A5', 'Admin', 'Organizador', 'Sair da conta e entrar de novo com a mesma senha.', 'Menu → Sair → Login', 'Entra nas 4 abas: Peladas, Buscar, Mural, Perfil.', 'Sim', '', '', '', '', ''],
  [6, 'A - Entrada e cadastro', 'A6', 'Atleta A', 'Atleta', 'Criar conta do Atleta A e completar o perfil como Atleta.', 'Criar conta + Montar perfil', 'Atleta A entra nas tabs com perfil de atleta utilizavel.', 'Sim', '', '', '', '', ''],
  [7, 'A - Entrada e cadastro', 'A7', 'Qualquer', 'Qualquer', 'Em Meus dados, preencher data de nascimento usando dia / mes / ano (nao calendario nativo estranho).', 'Perfil → Meus dados', 'Data salva corretamente; campos claros.', 'Sim', '', '', '', '', ''],
  [8, 'A - Entrada e cadastro', 'A8', 'Admin', 'Organizador', 'Fechar o app por completo e abrir de novo.', 'Splash', 'Mantem a sessao e vai para Peladas (nao pede login de novo).', 'Sim', '', '', '', '', ''],
  // B
  [9, 'B - Pelada', 'B1', 'Admin', 'Organizador', 'Criar uma pelada nova (nome, local, dados basicos).', 'Peladas → Nova pelada', 'Pelada salva e aparece na lista.', 'Sim', '', '', '', '', ''],
  [10, 'B - Pelada', 'B2', 'Admin', 'Organizador', 'Abrir a pelada criada e percorrer os segmentos (Eventos, Socios, Cotinhas, Caixa, Mensalidades, Mural, Config).', 'Detalhe da pelada', 'Todas as secoes abrem sem erro.', 'Sim', '', '', '', '', ''],
  [11, 'B - Pelada', 'B3', 'Admin', 'Organizador', 'Abrir Configuracoes e ler os textos dos toggles / regras.', 'Pelada → Configuracoes', 'Textos legiveis (sem cortar); da para entender as regras.', 'Sim', '', '', '', '', ''],
  [12, 'B - Pelada', 'B4', 'Atleta A depois Admin', 'Atleta → Organizador', 'Atleta solicita ser socio (se existir); Admin aprova.', 'Pelada → Socios', 'Pedido e aprovacao claros (ou etapa marcada como N/A se nao usar socios).', 'Opcional', '', '', '', '', ''],
  [13, 'B - Pelada', 'B5', 'Admin', 'Organizador', 'Abrir o Mural da pelada (ainda vazio).', 'Pelada → Mural', 'Tela vazia compreensivel, sem erro.', 'Sim', '', '', '', '', ''],
  // C
  [14, 'C - Evento e inscricao', 'C1', 'Admin', 'Organizador', 'Criar um evento futuro (data/hora a frente; inscricoes abertas; taxa conhecida ou taxa zero).', 'Pelada → Eventos → Novo evento', 'Evento criado e listado na pelada.', 'Sim', '', '', '', '', ''],
  [15, 'C - Evento e inscricao', 'C2', 'Admin', 'Organizador', 'Abrir o detalhe do evento e localizar participantes e contratacoes.', 'Detalhe do evento', 'Painel do admin e secoes principais visiveis.', 'Sim', '', '', '', '', ''],
  [16, 'C - Evento e inscricao', 'C3', 'Atleta A', 'Atleta', 'Inscrever-se no evento (fluxo de inscricao / register).', 'Evento → Participar / Inscrever', 'Inscricao criada; aparece como pendente ou aguardando confirmacao.', 'Sim', '', '', '', '', ''],
  [17, 'C - Evento e inscricao', 'C4', 'Admin', 'Organizador', 'Se a pelada exigir apresentacao de perfil na 1a vez: aprovar o perfil do Atleta A.', 'Evento → Participantes ou solicitacoes', 'Perfil aprovado (ou N/A se a regra estiver desligada).', 'Se ligado', '', '', '', '', ''],
  [18, 'C - Evento e inscricao', 'C5', 'Admin', 'Organizador', 'Confirmar pagamento do Atleta A, OU isentar, OU usar taxa zero — ate ele ficar confirmado para jogar.', 'Evento → Participantes', 'Atleta A fica com status de confirmado efetivo (pode jogar / voto / ingresso).', 'Sim', '', '', '', '', ''],
  [19, 'C - Evento e inscricao', 'C6', 'Admin', 'Organizador', 'Revisar a lista de participantes.', 'Evento → Participantes', 'Atleta A aparece com status correto.', 'Sim', '', '', '', '', ''],
  [20, 'C - Evento e inscricao', 'C7', 'Atleta B + Admin', 'Atleta', 'Repetir inscricao + confirmacao para Atleta B.', 'Mesmo fluxo C3-C5', 'Dois atletas confirmados no evento.', 'Opcional', '', '', '', '', ''],
  [21, 'C - Evento e inscricao', 'C8', 'Atleta A', 'Atleta', 'Se houver outro evento no mesmo horario, tentar se inscrever nos dois.', 'Inscricao no 2o evento', 'App avisa ou bloqueia conflito de agenda.', 'Opcional', '', '', '', '', ''],
  // D
  [22, 'D - Contratacao', 'D1', 'Contratado', 'Juiz ou Scout', 'Completar o perfil profissional (Juiz ou Scout) na conta do Contratado.', 'Perfil / Montar perfil do papel', 'Perfil do papel preenchido e salvavel.', 'Sim (2a sessao)', '', '', '', '', ''],
  [23, 'D - Contratacao', 'D2', 'Admin', 'Organizador', 'No evento, enviar convite de contratacao para o Contratado (valor se pedir).', 'Evento → Negociacao / Contratacoes', 'Convite fica pendente; badge/aviso se o app mostrar.', 'Sim (2a sessao)', '', '', '', '', ''],
  [24, 'D - Contratacao', 'D3', 'Contratado', 'Juiz ou Scout', 'Abrir a Caixa de Entrada.', 'Inbox / Caixa de entrada', 'Convite do evento aparece.', 'Sim (2a sessao)', '', '', '', '', ''],
  [25, 'D - Contratacao', 'D4', 'Contratado', 'Juiz ou Scout', 'Aceitar o convite.', 'Inbox → Aceitar', 'Passa a constar no evento no papel convidado, confirmado.', 'Sim (2a sessao)', '', '', '', '', ''],
  [26, 'D - Contratacao', 'D5', 'Contratado', 'Juiz ou Scout', 'Voltar ao evento e procurar o botao da ferramenta do papel (Sumula ou Scout).', 'Detalhe do evento', 'CTA da ferramenta aparece e abre a tela certa.', 'Sim (2a sessao)', '', '', '', '', ''],
  [27, 'D - Contratacao', 'D6', 'Outro usuario', 'Qualquer papel contratavel', 'Recusar um convite de teste (se houver).', 'Inbox → Recusar', 'Admin ve recusa; estado claro.', 'Opcional', '', '', '', '', ''],
  // E
  [28, 'E - Dia do jogo', 'E1', 'Admin', 'Organizador', 'Marcar a chegada dos atletas confirmados.', 'Evento → Chegada / Participantes', 'Ordem de chegada fica registrada.', 'Sim', '', '', '', '', ''],
  [29, 'E - Dia do jogo', 'E2', 'Admin', 'Organizador', 'Separar times: tocar no atleta e colocar em um time.', 'Evento → Separacao de times', 'Atletas ficam nos times; media de votos aparece se houver.', 'Sim', '', '', '', '', ''],
  [30, 'E - Dia do jogo', 'E3', 'Admin + Atleta', 'Porteiro / Atleta', 'Se portaria QR estiver ligada: validar ingresso valido e um invalido.', 'Portaria / Scan QR', 'Valido entra; invalido e rejeitado.', 'Se ligado', '', '', '', '', ''],
  [31, 'E - Dia do jogo', 'E4', 'Atleta ou Admin', 'Atleta', 'Se houver taxa PIX: usar botao copiar PIX.', 'Evento / pagamento', 'Copia com feedback (toast/mensagem).', 'Se houver taxa', '', '', '', '', ''],
  [32, 'E - Dia do jogo', 'E5', 'Contratado Scout', 'Scout / Mesario', 'Abrir o board de scout e incrementar estatisticas; sair e voltar.', 'Evento → Scout', 'Numeros salvam e permanecem apos recarregar.', 'Se houver scout', '', '', '', '', ''],
  [33, 'E - Dia do jogo', 'E6', 'Contratado Juiz', 'Juiz', 'Abrir a sumula e salvar apontamentos.', 'Evento → Sumula', 'Dados salvam sem erro.', 'Se houver juiz', '', '', '', '', ''],
  [34, 'E - Dia do jogo', 'E7', 'Torcedor', 'Torcedor', 'Fazer palpites antes do horario de inicio.', 'Evento → Palpites', 'Palpite aceito; apos o inicio, fecha conforme regra.', 'Opcional', '', '', '', '', ''],
  [35, 'E - Dia do jogo', 'E8', 'Torcedor', 'Torcedor', 'Fazer check-in de torcida.', 'Evento → Check-in torcida', 'Fluxo claro e confirmacao visivel.', 'Opcional', '', '', '', '', ''],
  [36, 'E - Dia do jogo', 'E9', 'Narrador ou Jornalista', 'Narrador / Jornalista', 'Publicar na radio ou no jornal do evento.', 'Evento → Radio / Jornal', 'Publicacao aparece no mural do evento.', 'Opcional', '', '', '', '', ''],
  [37, 'E - Dia do jogo', 'E10', 'Papel de apoio', 'Treinador / PF / Massagista / Roupeiro', 'Abrir a ferramenta do papel no evento e salvar algo simples.', 'Evento → ferramenta do papel', 'Tela abre e salva.', 'Opcional', '', '', '', '', ''],
  // F
  [38, 'F - Pos-jogo e mural', 'F1', 'Atletas confirmados', 'Atleta', 'Votar no mural do evento (nota 0 a 10) dentro da janela de votacao.', 'Evento → Mural / Votacao', 'Voto aceito dentro da janela; fora da janela bloqueia.', 'Sim', '', '', '', '', ''],
  [39, 'F - Pos-jogo e mural', 'F2', 'Admin', 'Organizador', 'Marcar o evento como finalizado.', 'Evento (admin)', 'Evento fica finalizado; ferramentas de jogo fecham conforme a regra.', 'Sim', '', '', '', '', ''],
  [40, 'F - Pos-jogo e mural', 'F3', 'Qualquer', 'Qualquer', 'Abrir o mural do evento e olhar rankings / destaques.', 'Evento → Mural', 'Carrega sem erro; informacoes coerentes.', 'Sim', '', '', '', '', ''],
  [41, 'F - Pos-jogo e mural', 'F4', 'Qualquer', 'Qualquer', 'Abrir o mural da pelada.', 'Pelada → Mural', 'Reflete atividade do evento / carrega sem erro.', 'Sim', '', '', '', '', ''],
  [42, 'F - Pos-jogo e mural', 'F5', 'Qualquer', 'Qualquer', 'Abrir a aba Mural do app.', 'Aba Mural', 'Carrega sem erro.', 'Sim', '', '', '', '', ''],
  [43, 'F - Pos-jogo e mural', 'F6', 'Qualquer (celular)', 'Qualquer', 'Compartilhar um card do mural; depois cancelar o compartilhamento.', 'Botao compartilhar no mural', 'Abre share do sistema; cancelar nao deixa o app travado em loading.', 'Android/iOS', '', '', '', '', ''],
  [44, 'F - Pos-jogo e mural', 'F7', 'Qualquer', 'Qualquer', 'Abrir o perfil publico de um atleta.', 'Perfil / link do atleta', 'Pagina legivel com dados do atleta.', 'Sim', '', '', '', '', ''],
  // G
  [45, 'G - Regressao rapida', 'G1', 'Qualquer', 'Qualquer', 'Login, abas e menu cortina.', 'Tabs + menu', 'Navegacao ok.', 'Antes de release', '', '', '', '', ''],
  [46, 'G - Regressao rapida', 'G2', 'Admin', 'Organizador', 'Pelada → Configuracoes: textos completos.', 'Configuracoes', 'Sem corte de texto.', 'Antes de release', '', '', '', '', ''],
  [47, 'G - Regressao rapida', 'G3', 'Admin', 'Organizador', 'Evento → lista de participantes (admin).', 'Participantes', 'Lista completa.', 'Antes de release', '', '', '', '', ''],
  [48, 'G - Regressao rapida', 'G4', 'Admin', 'Organizador', 'Enviar convite de contratacao e ver badge/aviso.', 'Contratacoes', 'Convite e feedback visiveis.', 'Antes de release', '', '', '', '', ''],
  [49, 'G - Regressao rapida', 'G5', 'Contratado', 'Juiz/Scout', 'Aceitar ou recusar na inbox.', 'Caixa de entrada', 'Fluxo funciona.', 'Antes de release', '', '', '', '', ''],
  [50, 'G - Regressao rapida', 'G6', 'Admin', 'Organizador', 'Separacao de times.', 'Team split', 'Atribuicao de time ok.', 'Antes de release', '', '', '', '', ''],
  [51, 'G - Regressao rapida', 'G7', 'Admin / Atleta', 'Porteiro / Atleta', 'Portaria QR e/ou copiar PIX.', 'Portaria / PIX', 'Fluxos basicos ok.', 'Antes de release', '', '', '', '', ''],
];

const perfilHeader = [
  'Perfil',
  'ID caso',
  'Quem opera',
  'O que fazer',
  'Resultado esperado',
  'Resultado do teste',
  'Severidade se falhou',
  'Observacao',
  'Tester',
  'Data',
];

const perfilRows = [
  ['Atleta', 'AT1', 'Atleta', 'Inscrever-se no evento e aguardar confirmacao (pagamento/isencao/taxa zero).', 'Fica confirmado para jogar.', '', '', '', '', ''],
  ['Atleta', 'AT2', 'Admin marca; Atleta confere', 'Marcar chegada; conferir ordem na separacao de times.', 'Ordem de chegada aparece no team-split.', '', '', '', '', ''],
  ['Atleta', 'AT3', 'Admin / Atleta', 'Participar da separacao de times (tocar atleta → time).', 'Atleta fica no time escolhido; media de votos se houver.', '', '', '', '', ''],
  ['Atleta', 'AT4', 'Atleta confirmado', 'Votar no mural do evento (0 a 10) na janela correta.', 'Voto registrado; fora da janela bloqueia.', '', '', '', '', ''],
  ['Atleta', 'AT5', 'Qualquer', 'Abrir perfil publico do atleta.', 'Pagina clara e legivel.', '', '', '', '', ''],
  ['Juiz', 'JZ1', 'Juiz', 'Aceitar convite na Caixa de Entrada.', 'Vira inscricao de juiz no evento.', '', '', '', '', ''],
  ['Juiz', 'JZ2', 'Juiz', 'Preencher e salvar a sumula.', 'Apontamentos salvos.', '', '', '', '', ''],
  ['Juiz', 'JZ3', 'Admin', 'Contratar auxiliares de bandeira se a pelada usar.', 'Convites complementares funcionam.', '', '', '', '', ''],
  ['Juiz', 'JZ4', 'Usuario sem convite', 'Tentar entrar como juiz sem convite.', 'Nao se auto-inscreve como juiz aberto (regra do app).', '', '', '', '', ''],
  ['Scout / Mesario', 'SC1', 'Scout', 'Usar o board de scout e incrementar stats.', 'Contadores sobem e salvam.', '', '', '', '', ''],
  ['Scout / Mesario', 'SC2', 'Scout', 'Sair da tela e voltar (reload).', 'Dados permanecem; conflito de fonte tratado se existir.', '', '', '', '', ''],
  ['Scout / Mesario', 'SC3', 'Admin', 'Contratar marcadores auxiliares se permitido.', 'Fluxo de contratacao claro.', '', '', '', '', ''],
  ['Scout / Mesario', 'SC4', 'Scout', 'Usar o board no celular (uma mao).', 'Controles usaveis em tela estreita.', '', '', '', '', ''],
  ['Jornalista', 'JN1', 'Jornalista', 'Publicar no jornal do evento.', 'Publicacao salva.', '', '', '', '', ''],
  ['Jornalista', 'JN2', 'Qualquer', 'Ver a publicacao no mural do evento.', 'Aparece no mural.', '', '', '', '', ''],
  ['Jornalista', 'JN3', 'Outro usuario', 'Tentar editar jornal sem ser o jornalista confirmado.', 'App/Cloud bloqueia.', '', '', '', '', ''],
  ['Cinegrafista', 'CG1', 'Cinegrafista / Admin', 'Entrar via contratacao ou inscricao do papel.', 'Fluxo compreensivel.', '', '', '', '', ''],
  ['Cinegrafista', 'CG2', 'Cinegrafista', 'Confirmar presenca/cobertura no evento.', 'Status visivel no detalhe do evento.', '', '', '', '', ''],
  ['Cinegrafista', 'CG3', 'Cinegrafista', 'Achar o CTA de cobertura / moments.', 'Entrada obvia ou ausencia documentada na observacao.', '', '', '', '', ''],
  ['Narrador', 'NR1', 'Narrador', 'Abrir a radio do evento.', 'Tela abre.', '', '', '', '', ''],
  ['Narrador', 'NR2', 'Narrador', 'Publicar narracao (gol / entrevista).', 'Feedback de sucesso ou erro util.', '', '', '', '', ''],
  ['Narrador', 'NR3', 'Narrador', 'Alternar estados idle / ao vivo.', 'Estados compreensiveis.', '', '', '', '', ''],
  ['Treinador', 'TR1', 'Treinador', 'Abrir o board do treinador (escala/checklist/notas).', 'Consegue editar e salvar.', '', '', '', '', ''],
  ['Treinador', 'TR2', 'Treinador', 'Salvar, sair e reabrir.', 'Dados persistem.', '', '', '', '', ''],
  ['Treinador', 'TR3', 'Outro usuario', 'Tentar acessar sem ser treinador confirmado.', 'Acesso bloqueado (exceto admin, se permitido).', '', '', '', '', ''],
  ['Preparador Fisico', 'PF1', 'Preparador Fisico', 'Abrir o plano / ferramenta de PF no evento.', 'Tela abre.', '', '', '', '', ''],
  ['Preparador Fisico', 'PF2', 'Preparador Fisico', 'Preencher aquecimento / sessao.', 'Campos obrigatorios claros; salva.', '', '', '', '', ''],
  ['Preparador Fisico', 'PF3', 'Atleta / Admin', 'Se existir contratacao pessoal no perfil do atleta, testar o fluxo.', 'Fluxo claro ou N/A.', '', '', '', '', ''],
  ['Massagista', 'MS1', 'Massagista', 'Abrir a fila / tratamentos.', 'Lista/fila compreensivel.', '', '', '', '', ''],
  ['Massagista', 'MS2', 'Massagista', 'Criar ou atualizar ficha de atendimento.', 'Status atualiza.', '', '', '', '', ''],
  ['Massagista', 'MS3', 'Massagista', 'Fluxo pos-jogo / recuperacao.', 'Passos compreensiveis.', '', '', '', '', ''],
  ['Roupeiro', 'RP1', 'Roupeiro', 'Abrir inventario de material (kitman).', 'Inventario carrega.', '', '', '', '', ''],
  ['Roupeiro', 'RP2', 'Roupeiro', 'Usar sessao de material no evento.', 'Painel no evento funciona.', '', '', '', '', ''],
  ['Roupeiro', 'RP3', 'Roupeiro', 'Testar envio / contagem cega / item danificado.', 'Estados da sessao corretos.', '', '', '', '', ''],
  ['Gandula', 'GD1', 'Gandula', 'Inscrever-se no evento como gandula.', 'Inscricao do papel ok.', '', '', '', '', ''],
  ['Gandula', 'GD2', 'Gandula', 'Procurar ferramentas/CTAs no detalhe do evento.', 'Ha CTA util ou documentar ausencia.', '', '', '', '', ''],
  ['Gandula', 'GD3', 'Admin / Gandula', 'Confirmar chegada / status efetivo.', 'Status claro.', '', '', '', '', ''],
  ['Porteiro', 'PT1', 'Porteiro', 'Escanear QR de ingresso valido.', 'Entrada liberada.', '', '', '', '', ''],
  ['Porteiro', 'PT2', 'Porteiro', 'Ver lista de entradas.', 'Lista atualiza.', '', '', '', '', ''],
  ['Porteiro', 'PT3', 'Admin', 'Conferir se a flag de portaria do evento esta ligada.', 'Scan so funciona quando habilitado.', '', '', '', '', ''],
  ['Porteiro', 'PT4', 'Atleta nao confirmado', 'Tentar usar ingresso sem confirmacao efetiva.', 'Nao libera (ou nao emite ticket).', '', '', '', '', ''],
  ['Torcedor', 'TZ1', 'Torcedor', 'Registrar palpites antes do inicio.', 'Palpite aceito.', '', '', '', '', ''],
  ['Torcedor', 'TZ2', 'Torcedor', 'Fazer check-in de torcida.', 'Confirmacao clara.', '', '', '', '', ''],
  ['Torcedor', 'TZ3', 'Torcedor', 'Votar no mural na janela correta.', 'Voto aceito.', '', '', '', '', ''],
  ['Torcedor', 'TZ4', 'Torcedor', 'Entender diferenca remoto vs presencial na UI.', 'Textos/estados claros.', '', '', '', '', ''],
];

const bugsHeader = [
  'ID bug',
  'Data',
  'Tester',
  'Ambiente (Web/Android/iOS)',
  'Perfil / conta',
  'ID do passo (ex: C5 ou AT4)',
  'O que tentou fazer',
  'O que aconteceu',
  'O que esperava',
  'Severidade (P0/P1/P2)',
  'Print / anexo',
  'Status (Aberto/Corrigido)',
];

const bugsRows = [
  bugsHeader,
  ['', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', ''],
];

function main() {
  const XLSX = ensureXlsx();
  fs.mkdirSync(outDir, { recursive: true });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(instrucoes), 'Como usar');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(contas), 'Contas');
  XLSX.utils.book_append_sheet(wb, sheetFromRows([fluxoHeader, ...fluxoRows]), 'Fluxo Ciclo de Vida');
  XLSX.utils.book_append_sheet(wb, sheetFromRows([perfilHeader, ...perfilRows]), 'Por Perfil');
  XLSX.utils.book_append_sheet(wb, sheetFromRows(bugsRows), 'Registro de Bugs');

  const outPath = path.join(outDir, 'Fluxo-Testes-Controle-de-Bola.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`Planilha gerada:\n${outPath}`);
}

main();
