export interface TeamUniformOption {
  id: string;
  teamName: string;
  serie: 'A' | 'B' | 'C';
  colors: [string, string, string];
}

function uniform(
  id: string,
  teamName: string,
  serie: 'A' | 'B' | 'C',
  colors: [string, string, string]
): TeamUniformOption {
  return { id, teamName, serie, colors };
}

export const TEAM_UNIFORM_OPTIONS: TeamUniformOption[] = [
  uniform('athletico-pr', 'Athletico-PR', 'A', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('atletico-mg', 'Atletico-MG', 'A', ['#000000', '#FFFFFF', '#A7A9AC']),
  uniform('bahia', 'Bahia', 'A', ['#0058A8', '#DA251D', '#FFFFFF']),
  uniform('botafogo', 'Botafogo', 'A', ['#000000', '#FFFFFF', '#A7A9AC']),
  uniform('bragantino', 'Bragantino', 'A', ['#FFFFFF', '#CC0000', '#000000']),
  uniform('ceara', 'Ceara', 'A', ['#000000', '#FFFFFF', '#FFCC00']),
  uniform('corinthians', 'Corinthians', 'A', ['#000000', '#FFFFFF', '#A7A9AC']),
  uniform('cruzeiro', 'Cruzeiro', 'A', ['#003A7D', '#FFFFFF', '#A7A9AC']),
  uniform('flamengo', 'Flamengo', 'A', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('fluminense', 'Fluminense', 'A', ['#7A263A', '#006241', '#FFFFFF']),
  uniform('fortaleza', 'Fortaleza', 'A', ['#CC0000', '#003A7D', '#FFFFFF']),
  uniform('gremio', 'Gremio', 'A', ['#0089CF', '#000000', '#FFFFFF']),
  uniform('internacional', 'Internacional', 'A', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('juventude', 'Juventude', 'A', ['#006241', '#FFFFFF', '#000000']),
  uniform('mirassol', 'Mirassol', 'A', ['#FFCC00', '#006241', '#000000']),
  uniform('palmeiras', 'Palmeiras', 'A', ['#006241', '#FFFFFF', '#000000']),
  uniform('santos', 'Santos', 'A', ['#FFFFFF', '#000000', '#A7A9AC']),
  uniform('sao-paulo', 'Sao Paulo', 'A', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('vasco', 'Vasco', 'A', ['#000000', '#FFFFFF', '#CC0000']),
  uniform('vitoria', 'Vitoria', 'A', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('america-mg', 'America-MG', 'B', ['#006241', '#FFFFFF', '#000000']),
  uniform('athletic', 'Athletic', 'B', ['#000000', '#FFFFFF', '#CC0000']),
  uniform('atletico-go', 'Atletico-GO', 'B', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('avai', 'Avai', 'B', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('botafogo-sp', 'Botafogo-SP', 'B', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('chapecoense', 'Chapecoense', 'B', ['#006241', '#FFFFFF', '#000000']),
  uniform('coritiba', 'Coritiba', 'B', ['#006241', '#FFFFFF', '#000000']),
  uniform('criciuma', 'Criciuma', 'B', ['#FFCC00', '#006241', '#000000']),
  uniform('crb', 'CRB', 'B', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('cuiaba', 'Cuiaba', 'B', ['#FFCC00', '#006241', '#000000']),
  uniform('ferroviaria', 'Ferroviaria', 'B', ['#8B4513', '#FFCC00', '#FFFFFF']),
  uniform('goias', 'Goias', 'B', ['#006241', '#FFFFFF', '#000000']),
  uniform('novorizontino', 'Novorizontino', 'B', ['#FFCC00', '#000000', '#FFFFFF']),
  uniform('operario-pr', 'Operario-PR', 'B', ['#000000', '#FFFFFF', '#CC0000']),
  uniform('paysandu', 'Paysandu', 'B', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('remo', 'Remo', 'B', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('sport', 'Sport', 'B', ['#CC0000', '#000000', '#FFFFFF']),
  uniform('vila-nova', 'Vila Nova', 'B', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('volta-redonda', 'Volta Redonda', 'B', ['#FFCC00', '#000000', '#FFFFFF']),
  uniform('amazonas', 'Amazonas', 'B', ['#FFCC00', '#000000', '#FFFFFF']),
  uniform('abc', 'ABC', 'C', ['#FFFFFF', '#000000', '#CC0000']),
  uniform('aparecidense', 'Aparecidense', 'C', ['#006241', '#FFFFFF', '#000000']),
  uniform('botafogo-pb', 'Botafogo-PB', 'C', ['#000000', '#FFFFFF', '#CC0000']),
  uniform('csa', 'CSA', 'C', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('figueirense', 'Figueirense', 'C', ['#000000', '#FFFFFF', '#CC0000']),
  uniform('floresta', 'Floresta', 'C', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('londrina', 'Londrina', 'C', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('manaus', 'Manaus', 'C', ['#FFFFFF', '#0066CC', '#000000']),
  uniform('nautico', 'Nautico', 'C', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('ponte-preta', 'Ponte Preta', 'C', ['#000000', '#FFFFFF', '#FFCC00']),
  uniform('sao-bernardo', 'Sao Bernardo', 'C', ['#FFCC00', '#0066CC', '#000000']),
  uniform('tombense', 'Tombense', 'C', ['#006241', '#FFFFFF', '#000000']),
  uniform('ypiranga-rs', 'Ypiranga-RS', 'C', ['#CC0000', '#FFFFFF', '#0066CC']),
  uniform('confianca', 'Confianca', 'C', ['#0066CC', '#FFFFFF', '#000000']),
  uniform('ferroviario', 'Ferroviario', 'C', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('guarani', 'Guarani', 'C', ['#006241', '#FFFFFF', '#000000']),
  uniform('ituano', 'Ituano', 'C', ['#CC0000', '#FFFFFF', '#000000']),
  uniform('noroeste', 'Noroeste', 'C', ['#FFCC00', '#000000', '#FFFFFF']),
  uniform('retro', 'Retro', 'C', ['#000000', '#FFCC00', '#FFFFFF']),
  uniform('sampaio-correa', 'Sampaio Correa', 'C', ['#CC0000', '#006241', '#FFFFFF']),
];

export const UNIFORMS_BY_SERIE = {
  A: TEAM_UNIFORM_OPTIONS.filter((item) => item.serie === 'A'),
  B: TEAM_UNIFORM_OPTIONS.filter((item) => item.serie === 'B'),
  C: TEAM_UNIFORM_OPTIONS.filter((item) => item.serie === 'C'),
};

export function getUniformById(id: string): TeamUniformOption | undefined {
  return TEAM_UNIFORM_OPTIONS.find((item) => item.id === id);
}
