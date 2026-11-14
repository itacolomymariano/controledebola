#!/usr/bin/env node
/** Adiciona chaves da migração HTML/TS (code-migration) aos 3 JSON e reordena en/es. */
const fs = require('fs');
const path = require('path');

const I18N = path.join(__dirname, '../src/assets/i18n');
const extra = require('./i18n-coverage-extra.js');
const triples = {
  'common.yes': ['Sim', 'Yes', 'Sí'],
  'common.no': ['Não', 'No', 'No'],
  'common.daysCount': ['{{days}} dia(s)', '{{days}} day(s)', '{{days}} día(s)'],
  'eventDetail.pageTitle': [
    'Detalhe do evento',
    'Event details',
    'Detalle del evento',
  ],
  'eventDetail.scrollHint': [
    'Role a tela para ver todas as opcoes do evento.',
    'Scroll down to see all event options.',
    'Desplázate para ver todas las opciones del evento.',
  ],
  'eventDetail.inviteAfterEvent.title': [
    'Chame a galera',
    'Rally the squad',
    'Llama al grupo',
  ],
  'eventDetail.inviteAfterEvent.body': [
    'Convide quem faltou ou amigos da pelada para o proximo jogo no Controle de Bola.',
    'Invite anyone who missed out or kickabout friends to the next match on Controle de Bola.',
    'Invita a quien faltó o amigos del partido al próximo juego en Controle de Bola.',
  ],
  'eventDetail.inviteAfterEvent.share': [
    'Compartilhar convite',
    'Share invite',
    'Compartir invitación',
  ],
  'eventDetail.inviteShare.introWithEvent': [
    'Bora de pelada de novo? {{event}} — chama a galera no Controle de Bola:',
    'Fancy another kickabout? {{event}} — get the squad on Controle de Bola:',
    '¿Otra pelada? {{event}} — llama al grupo en Controle de Bola:',
  ],
  'eventDetail.inviteShare.introGeneric': [
    'Chama a galera pro Controle de Bola App:',
    'Get your squad on Controle de Bola:',
    'Llama al grupo a Controle de Bola:',
  ],
  'eventDetail.inviteShare.dialogTitle': ['Convidar amigos', 'Invite friends', 'Invitar amigos'],
  'eventDetail.inviteShare.linkCopied': [
    'Link copiado para convidar a galera.',
    'Link copied — invite your squad.',
    'Enlace copiado para invitar al grupo.',
  ],
  'eventDetail.votingPeriod.title': ['Periodo de votacao', 'Voting period', 'Periodo de votación'],
  'eventDetail.votingPeriod.defaultHint': [
    'Padrao: inicio do evento ate 24h depois',
    'Default: from event start until 24h later',
    'Predeterminado: desde el inicio del evento hasta 24 h después',
  ],
  'eventDetail.peladaLink': ['Pelada: {{name}}', 'Kickabout: {{name}}', 'Pelada: {{name}}'],
  'mural.period.title': [
    'Resultados por período',
    'Results by period',
    'Resultados por período',
  ],
  'mural.period.week': ['Semana', 'Week', 'Semana'],
  'mural.period.month': ['Mês', 'Month', 'Mes'],
  'mural.period.year': ['Ano', 'Year', 'Año'],
  'mural.period.goals': ['GOLS', 'GOALS', 'GOLES'],
  'mural.period.yellowCards': ['AMARELOS', 'YELLOWS', 'AMARILLAS'],
  'mural.period.redCards': ['VERMELHOS', 'REDS', 'ROJAS'],
  'mural.period.noEntries': [
    'Sem apontamentos no período.',
    'No records in this period.',
    'Sin registros en el período.',
  ],
  'mural.period.caption': ['Período: {{period}}', 'Period: {{period}}', 'Período: {{period}}'],
  'mural.period.metric.craque': ['CRAQUE', 'STAR', 'CRACK'],
  'mural.period.metric.goleador': ['GOLEADOR', 'SCORER', 'GOLEADOR'],
  'mural.period.metric.melhorGoleiro': ['MELHOR GOLEIRO', 'BEST GK', 'MEJOR PORTERO'],
  'mural.period.metric.melhorJuiz': ['MELHOR JUIZ', 'BEST REF', 'MEJOR ÁRBITRO'],
  'mural.period.metricLabel.craque': ['Craque', 'Star player', 'Crack'],
  'mural.period.metricLabel.goleador': ['Goleador', 'Top scorer', 'Goleador'],
  'mural.period.metricLabel.melhorGoleiro': ['Melhor goleiro', 'Best goalkeeper', 'Mejor portero'],
  'mural.period.metricLabel.melhorJuiz': ['Melhor juiz', 'Best referee', 'Mejor árbitro'],
  'mural.period.metricLabel.yellowCards': ['Cartões amarelos', 'Yellow cards', 'Tarjetas amarillas'],
  'mural.period.metricLabel.redCards': ['Cartões vermelhos', 'Red cards', 'Tarjetas rojas'],
  'mural.period.metricLabel.goals': ['Gols', 'Goals', 'Goles'],
  'mural.period.cardTitleJoin': ['{{metric}} — {{title}}', '{{metric}} — {{title}}', '{{metric}} — {{title}}'],
  'mural.app.emptyRanking': [
    'Ainda não há dados para exibir no ranking.',
    'No ranking data to show yet.',
    'Aún no hay datos para el ranking.',
  ],
  'mural.app.teamMatch.matchesPlayed': ['Confrontos realizados:', 'Matches played:', 'Partidos jugados:'],
  'mural.app.teamMatch.wins': ['Vitória(s):', 'Win(s):', 'Victoria(s):'],
  'mural.app.teamMatch.draws': ['Empate(s):', 'Draw(s):', 'Empate(s):'],
  'mural.app.teamMatch.losses': ['Derrota(s):', 'Loss(es):', 'Derrota(s):'],
  'mural.app.teamMatch.winRate': ['Aproveitamento:', 'Win rate:', 'Rendimiento:'],
  'mural.app.teamMatch.unbeatenFor': ['Invicto há:', 'Unbeaten for:', 'Invicto desde:'],
  'mural.app.teamMatch.unbeatenDays': ['Dias invicto:', 'Unbeaten days:', 'Días invicto:'],
  'mural.app.teamMatch.matchesInStreak': ['Confrontos na sequência:', 'Matches in streak:', 'Partidos en la racha:'],
  'mural.app.teamMatch.since': ['Desde:', 'Since:', 'Desde:'],
  'mural.app.teamMatch.goalsFor': ['Gols marcados:', 'Goals scored:', 'Goles marcados:'],
  'mural.app.teamMatch.goalsPerMatch': ['Média de gols por partida:', 'Goals per match:', 'Media de goles por partido:'],
  'mural.app.teamMatch.teamScorer': ['Goleador do time:', 'Team top scorer:', 'Goleador del equipo:'],
  'mural.app.teamMatch.goals': ['Gols:', 'Goals:', 'Goles:'],
  'mural.app.teamMatch.goalsAgainst': ['Gols sofridos:', 'Goals conceded:', 'Goles encajados:'],
  'mural.app.teamMatch.goalsAgainstPerMatch': [
    'Média de gols sofridos por partida:',
    'Goals conceded per match:',
    'Media de goles encajados por partido:',
  ],
  'mural.app.teamMatch.topDefender': ['Defensor com mais pontos:', 'Top defender:', 'Defensor con más puntos:'],
  'mural.app.teamMatch.points': ['Pontos:', 'Points:', 'Puntos:'],
  'mural.app.teamMatch.pointsPerMatch': ['Média de pontos por partida:', 'Points per match:', 'Media de puntos por partido:'],
  'mural.app.pelada.votersAverage': ['Média de eleitores:', 'Avg. voters:', 'Media de votantes:'],
  'mural.app.pelada.votesAverage': ['Média de votos:', 'Avg. votes:', 'Media de votos:'],
  'mural.app.pelada.redCardsAverage': ['Média de vermelhos:', 'Avg. red cards:', 'Media de rojas:'],
  'mural.app.pelada.yellowCardsAverage': ['Média de amarelos:', 'Avg. yellow cards:', 'Media de amarillas:'],
  'mural.app.pelada.hasCash': ['Caixa:', 'Cash box:', 'Caja:'],
  'mural.app.pelada.hasCotinha': ['Cotinha:', 'Kitty:', 'Bote común:'],
  'mural.app.pelada.hasMailbox': ['Mensagens:', 'Messages:', 'Mensajes:'],
  'mural.app.team.president': ['Presidente:', 'President:', 'Presidente:'],
  'mural.app.team.founded': ['Fundação:', 'Founded:', 'Fundación:'],
  'mural.app.team.homeVenue': ['Sede:', 'Home ground:', 'Sede:'],
  'mural.app.team.matches': ['Confrontos:', 'Matches:', 'Partidos:'],
  'mural.app.team.performance': ['Rendimento:', 'Performance:', 'Rendimiento:'],
  'mural.app.coach.age': ['Idade:', 'Age:', 'Edad:'],
  'mural.app.coach.ageYears': ['{{age}} anos', '{{age}} years', '{{age}} años'],
  'mural.app.coach.teamsCoached': ['Times treinados:', 'Teams coached:', 'Equipos entrenados:'],
  'profile.primaryEventRole': [
    'Perfil principal nos eventos',
    'Primary profile in events',
    'Perfil principal en eventos',
  ],
  'profile.participationProfiles': [
    'Perfis de participacao',
    'Participation profiles',
    'Perfiles de participación',
  ],
  'profile.athleteProfile': ['Perfil de atleta', 'Athlete profile', 'Perfil de atleta'],
  'profile.personalHiring': ['Contratacao pessoal', 'Personal hiring', 'Contratación personal'],
  'profile.personalHiringHint': [
    'Preparador fisico e scout pessoal',
    'Personal trainer and scout',
    'Preparador físico y scout personal',
  ],
  'profile.roleProfileTitle': ['Perfil de {{role}}', '{{role}} profile', 'Perfil de {{role}}'],
  'profile.kitmanMaterial': ['Material do Roupeiro', 'Kit manager inventory', 'Material del utilero'],
  'profile.kitmanMaterialHint': [
    'Cadastrar material proprio para ceder ou alugar',
    'Register your own kit to lend or hire out',
    'Registrar material propio para ceder o alquilar',
  ],
  'profile.fanProfile': ['Perfil de torcedor', 'Fan profile', 'Perfil de hincha'],
  'profile.fanProfileHint': [
    'Cadastrar agora · Palpites antes de cada evento',
    'Register now · Predictions before each event',
    'Registrar ahora · Pronósticos antes de cada evento',
  ],
  'profile.fanProfileRegistered': [
    'Cadastrado · Palpites antes de cada evento',
    'Registered · Predictions before each event',
    'Registrado · Pronósticos antes de cada evento',
  ],
  'profile.otherRegistrations': ['Outros cadastros', 'Other registrations', 'Otros registros'],
  'profile.myTeams': ['Meus times', 'My teams', 'Mis equipos'],
  'profile.myTeamsManage': [
    '{{count}} time{{plural}} · Gerenciar',
    '{{count}} team{{plural}} · Manage',
    '{{count}} equipo{{plural}} · Gestionar',
  ],
  'profile.biometricLogin': ['Login por biometria', 'Biometric login', 'Inicio con biometría'],
  'profile.inviteFriends': ['Convidar Amigos', 'Invite friends', 'Invitar amigos'],
  'profile.inviteFriendsHint': [
    'Divulgar o Controle de Bola nas redes',
    'Share Controle de Bola on social media',
    'Compartir Controle de Bola en redes',
  ],
  'profile.registered': ['Cadastrado', 'Registered', 'Registrado'],
  'profile.registerNow': ['Cadastrar agora', 'Register now', 'Registrar ahora'],
  'accountEdit.title': ['Meus dados', 'My details', 'Mis datos'],
  'accountEdit.back': ['Voltar', 'Back', 'Volver'],
  'accountEdit.fullNameRequired': ['Informe o nome completo.', 'Enter your full name.', 'Indica el nombre completo.'],
  'accountEdit.emailRequired': ['Informe um e-mail.', 'Enter an email.', 'Indica un correo.'],
  'accountEdit.emailInvalid': ['Informe um e-mail valido.', 'Enter a valid email.', 'Indica un correo válido.'],
  'accountEdit.profilePrivacy': ['Privacidade do perfil', 'Profile privacy', 'Privacidad del perfil'],
  'accountEdit.changePassword': ['Alterar senha', 'Change password', 'Cambiar contraseña'],
  'accountEdit.currentPasswordRequired': [
    'Informe sua senha atual.',
    'Enter your current password.',
    'Indica tu contraseña actual.',
  ],
  'profile.deleteAccount': ['Excluir conta', 'Delete account', 'Eliminar cuenta'],
  'profile.deleteAccountHint': [
    'Apagar definitivamente seus dados pessoais',
    'Permanently delete your personal data',
    'Borrar definitivamente tus datos personales',
  ],
  'profile.logout': ['Sair do App', 'Log out', 'Salir de la app'],
};
for (const [key, val] of Object.entries(extra)) {
  triples[key] = val;
}

const ptPath = path.join(I18N, 'pt-BR.json');
const enPath = path.join(I18N, 'en-GB.json');
const esPath = path.join(I18N, 'es-ES.json');

const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

for (const [key, [ptv, env, esv]] of Object.entries(triples)) {
  pt[key] = ptv;
  en[key] = env;
  es[key] = esv;
}

function reorderFromPt(target) {
  const out = {};
  for (const k of Object.keys(pt)) {
    if (target[k] !== undefined) out[k] = target[k];
  }
  for (const k of Object.keys(target)) {
    if (!(k in out)) out[k] = target[k];
  }
  return out;
}

fs.writeFileSync(ptPath, JSON.stringify(pt, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(reorderFromPt(en), null, 2) + '\n', 'utf8');
fs.writeFileSync(esPath, JSON.stringify(reorderFromPt(es), null, 2) + '\n', 'utf8');
console.log('Applied', Object.keys(triples).length, 'code-migration i18n keys.');
