import { MuralScope } from './mural.model';

/** Contexto de legenda ao compartilhar cards do mural. */
export interface MuralShareContext {
  scope: MuralScope;
  /** Titulo do card (ex.: Craque da rodada). */
  cardTitle?: string;
  peladaName?: string;
  peladaState?: string;
  peladaCity?: string;
  peladaNeighborhood?: string;
  eventName?: string;
  eventLocation?: string;
  eventStartTime?: Date | string;
}

export const MURAL_SHARE_BRAND = 'Controle de Bola App';
