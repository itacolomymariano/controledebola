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
  titleKey: string;
}

const SUPPORT_REFEREE: MuralAppSupportRoleSection = {
  role: 'referee',
  titleKey: 'mural.app.support.referee',
};
const SUPPORT_JOURNALIST: MuralAppSupportRoleSection = {
  role: 'journalist',
  titleKey: 'mural.app.support.journalist',
};
const SUPPORT_SCOUT: MuralAppSupportRoleSection = {
  role: 'scout',
  titleKey: 'mural.app.support.scout',
};
const SUPPORT_CAMERAMAN: MuralAppSupportRoleSection = {
  role: 'cameraman',
  titleKey: 'mural.app.support.cameraman',
};
const SUPPORT_NARRATOR: MuralAppSupportRoleSection = {
  role: 'narrator',
  titleKey: 'mural.app.support.narrator',
};
const SUPPORT_PF: MuralAppSupportRoleSection = {
  role: 'physical_trainer',
  titleKey: 'mural.app.support.physical_trainer',
};
const SUPPORT_MASSEUR: MuralAppSupportRoleSection = {
  role: 'masseur',
  titleKey: 'mural.app.support.masseur',
};
const SUPPORT_KITMAN: MuralAppSupportRoleSection = {
  role: 'kitman',
  titleKey: 'mural.app.support.kitman',
};
const SUPPORT_GANDULA: MuralAppSupportRoleSection = {
  role: 'gandula',
  titleKey: 'mural.app.support.gandula',
};
const SUPPORT_GATE: MuralAppSupportRoleSection = {
  role: 'gatekeeper',
  titleKey: 'mural.app.support.gatekeeper',
};
const SUPPORT_FAN: MuralAppSupportRoleSection = {
  role: 'fan',
  titleKey: 'mural.app.support.fan',
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

export function highlightTitleKeysForTab(tab: MuralAppTab): {
  craque: string;
  goalkeeper: string;
  scorer: string;
  athletes: string;
} {
  if (tab === 'peladas') {
    return {
      craque: 'mural.app.titles.craque.peladas',
      goalkeeper: 'mural.app.titles.goalkeeper.peladas',
      scorer: 'mural.app.titles.scorer.peladas',
      athletes: 'mural.app.titles.athletes.peladas',
    };
  }
  if (tab === 'confrontos') {
    return {
      craque: 'mural.app.titles.craque.confrontos',
      goalkeeper: 'mural.app.titles.goalkeeper.confrontos',
      scorer: 'mural.app.titles.scorer.confrontos',
      athletes: 'mural.app.titles.athletes.confrontos',
    };
  }
  return {
    craque: 'mural.app.titles.craque.geral',
    goalkeeper: 'mural.app.titles.goalkeeper.geral',
    scorer: 'mural.app.titles.scorer.geral',
    athletes: 'mural.app.titles.athletes.geral',
  };
}

/** @deprecated use highlightTitleKeysForTab + i18n.t */
export function highlightTitlesForTab(tab: MuralAppTab) {
  return highlightTitleKeysForTab(tab);
}