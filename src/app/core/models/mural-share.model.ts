import { MuralScope } from './mural.model';

export type MuralAppShareVariant = 'geral' | 'peladas' | 'confrontos';

export const MURAL_APP_SHARE_HEADERS: Record<MuralAppShareVariant, string> = {
  geral: 'Mural do Controle de Bola App (Geral)',
  peladas: 'Mural do Controle de Bola App (Peladas)',
  confrontos: 'Mural do Controle de Bola App (Confrontos)',
};

/** Contexto de legenda ao compartilhar cards do mural. */
export interface MuralShareContext {
  scope: MuralScope;
  /** Aba do mural global (titulo da faixa de compartilhamento). */
  appMuralVariant?: MuralAppShareVariant;
  /** Mural do evento: pelada comum ou confronto entre times. */
  eventKind?: 'pelada' | 'confronto';
  /** Titulo do card (ex.: Craque da rodada). */
  cardTitle?: string;
  peladaName?: string;
  peladaState?: string;
  peladaCity?: string;
  peladaNeighborhood?: string;
  /** Escopo app: filtro de regiao ativo no mural (nao confundir com o escopo pelada). */
  appFilterState?: string;
  appFilterCity?: string;
  appFilterNeighborhood?: string;
  eventName?: string;
  eventLocation?: string;
  eventStartTime?: Date | string;
  /** Confronto: placar e escudos no share e nos cards do mural. */
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamShieldUrl?: string;
  awayTeamShieldUrl?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  /** Reportagem / jornal do evento. */
  journalistName?: string;
}

export const MURAL_SHARE_BRAND = 'Controle de Bola App';
