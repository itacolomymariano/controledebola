import { MuralTargetRole } from '../models/event-performance.model';
import { MuralAppShareVariant } from '../models/mural-share.model';
import { MuralAppBucketKey } from '../models/mural.model';

export type MuralAppTab = 'geral' | 'peladas' | 'confrontos';

export function muralTabToBucket(tab: MuralAppTab): MuralAppBucketKey {
  if (tab === 'peladas') return 'pelada';
  if (tab === 'confrontos') return 'team_match';
  return 'merged';
}

export function muralTabToShareVariant(tab: MuralAppTab): MuralAppShareVariant {
  if (tab === 'peladas') return 'peladas';
  if (tab === 'confrontos') return 'confrontos';
  return 'geral';
}

export interface MuralAppSupportRoleSection {
  role: MuralTargetRole;
  title: string;
}

const SUPPORT_REFEREE: MuralAppSupportRoleSection = {
  role: 'referee',
  title: 'Top 10 — Árbitros',
};
const SUPPORT_JOURNALIST: MuralAppSupportRoleSection = {
  role: 'journalist',
  title: 'Top 10 — Jornalistas',
};
const SUPPORT_SCOUT: MuralAppSupportRoleSection = {
  role: 'scout',
  title: 'Top 10 — Scouts / Mesários',
};
const SUPPORT_CAMERAMAN: MuralAppSupportRoleSection = {
  role: 'cameraman',
  title: 'Top 10 — Cinegrafistas',
};
const SUPPORT_NARRATOR: MuralAppSupportRoleSection = {
  role: 'narrator',
  title: 'Top 10 — Narradores',
};
const SUPPORT_PF: MuralAppSupportRoleSection = {
  role: 'physical_trainer',
  title: 'Top 10 — Preparadores Físicos',
};
const SUPPORT_MASSEUR: MuralAppSupportRoleSection = {
  role: 'masseur',
  title: 'Top 10 — Massagistas',
};
const SUPPORT_KITMAN: MuralAppSupportRoleSection = {
  role: 'kitman',
  title: 'Top 10 — Ropeiros',
};
const SUPPORT_GANDULA: MuralAppSupportRoleSection = {
  role: 'gandula',
  title: 'Top 10 — Gandulas',
};
const SUPPORT_GATE: MuralAppSupportRoleSection = {
  role: 'gatekeeper',
  title: 'Top 10 — Porteiros',
};
const SUPPORT_FAN: MuralAppSupportRoleSection = {
  role: 'fan',
  title: 'Top 10 — Torcedores',
};

export function supportRoleSectionsForTab(tab: MuralAppTab): MuralAppSupportRoleSection[] {
  const common = [
    SUPPORT_REFEREE,
    SUPPORT_JOURNALIST,
    SUPPORT_SCOUT,
    SUPPORT_CAMERAMAN,
    SUPPORT_NARRATOR,
    SUPPORT_PF,
    SUPPORT_MASSEUR,
    SUPPORT_KITMAN,
    SUPPORT_GANDULA,
    SUPPORT_GATE,
    SUPPORT_FAN,
  ];
  return common;
}

export function tabShowsTeamCoachResults(tab: MuralAppTab): boolean {
  return tab === 'geral' || tab === 'confrontos';
}

export function highlightTitlesForTab(tab: MuralAppTab): {
  craque: string;
  goalkeeper: string;
  scorer: string;
  athletes: string;
} {
  if (tab === 'peladas') {
    return {
      craque: 'Craque das Peladas',
      goalkeeper: 'Melhor Goleiro das Peladas',
      scorer: 'Maior Goleador das Peladas',
      athletes: 'Top 10 — Atletas das Peladas',
    };
  }
  if (tab === 'confrontos') {
    return {
      craque: 'Craque dos Confrontos',
      goalkeeper: 'Melhor Goleiro dos Confrontos',
      scorer: 'Maior Goleador dos Confrontos',
      athletes: 'Top 10 — Atletas de Confrontos',
    };
  }
  return {
    craque: 'Craque do App',
    goalkeeper: 'Melhor Goleiro do App',
    scorer: 'Maior Goleador do App',
    athletes: 'Top 10 — Atletas',
  };
}
