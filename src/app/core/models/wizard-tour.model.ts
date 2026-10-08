export type WizardStepKind = 'route' | 'choices';

export type WizardChoiceAction = 'share_invite' | 'finish';

export interface WizardTourChoice {
  id: string;
  labelKey: string;
  route?: string;
  action?: WizardChoiceAction;
}

export interface WizardTourStep {
  id: string;
  kind: WizardStepKind;
  titleKey: string;
  bodyKey: string;
  /** Primary CTA for route steps */
  ctaKey?: string;
  /** Skip to next step without opening route (e.g. already found a pelada) */
  secondaryCtaKey?: string;
  route?: string;
  choices?: WizardTourChoice[];
  /** Hide overlay on this route until completePendingStep / completeStepById */
  pauseUntilComplete?: boolean;
}

export const WIZARD_TOUR_AUTH_ROUTES = [
  '/login',
  '/register',
  '/splash',
  '/onboarding',
  '/profile-setup',
];

const ATHLETE_STEP: WizardTourStep = {
  id: 'athlete',
  kind: 'route',
  titleKey: 'coach.athleteTitle',
  bodyKey: 'coach.athleteBody',
  ctaKey: 'coach.athleteCta',
  route: '/athlete-profile/form',
  pauseUntilComplete: true,
};

const PELADA_ROLE_STEP: WizardTourStep = {
  id: 'pelada-role',
  kind: 'choices',
  titleKey: 'coach.wizard.peladaRoleTitle',
  bodyKey: 'coach.wizard.peladaRoleBody',
  choices: [
    { id: 'admin', labelKey: 'coach.wizard.peladaAdmin' },
    { id: 'player', labelKey: 'coach.wizard.peladaPlayer' },
  ],
};

export const PELADA_ADMIN_CREATE_STEP: WizardTourStep = {
  id: 'pelada-admin-create',
  kind: 'route',
  titleKey: 'coach.hint.peladaCreateTitle',
  bodyKey: 'coach.hint.peladaCreateBody',
  ctaKey: 'coach.createPeladaCta',
  route: '/pelada-create',
  pauseUntilComplete: true,
};

export const PELADA_PLAYER_SEARCH_STEP: WizardTourStep = {
  id: 'pelada-player-search',
  kind: 'route',
  titleKey: 'coach.wizard.peladaSearchTitle',
  bodyKey: 'coach.wizard.peladaSearchBody',
  ctaKey: 'coach.wizard.openPeladaSearch',
  secondaryCtaKey: 'coach.wizard.continueWithoutJoin',
  route: '/tabs/peladas/lista?wizard=peladaJoin',
};

const TEAM_ROLE_STEP: WizardTourStep = {
  id: 'team-role',
  kind: 'choices',
  titleKey: 'coach.wizard.teamRoleTitle',
  bodyKey: 'coach.wizard.teamRoleBody',
  choices: [
    { id: 'president', labelKey: 'coach.wizard.teamPresident' },
    { id: 'player', labelKey: 'coach.wizard.teamPlayer' },
  ],
};

export const TEAM_PRESIDENT_CREATE_STEP: WizardTourStep = {
  id: 'team-president-create',
  kind: 'route',
  titleKey: 'coach.wizard.teamCreateTitle',
  bodyKey: 'coach.wizard.teamCreateBody',
  ctaKey: 'coach.wizard.teamCreateCta',
  route: '/team/form?new=1',
  pauseUntilComplete: true,
};

export const TEAM_PLAYER_SEARCH_STEP: WizardTourStep = {
  id: 'team-player-search',
  kind: 'route',
  titleKey: 'coach.wizard.teamSearchTitle',
  bodyKey: 'coach.wizard.teamSearchBody',
  ctaKey: 'coach.wizard.openTeamSearch',
  secondaryCtaKey: 'coach.wizard.continueWithoutJoin',
  route: '/tabs/peladas/times?wizard=teamJoin',
};

export const INVITE_FINISH_STEP: WizardTourStep = {
  id: 'invite-finish',
  kind: 'choices',
  titleKey: 'coach.hint.inviteTitle',
  bodyKey: 'coach.wizard.inviteFinishBody',
  choices: [
    { id: 'share', labelKey: 'coach.wizard.shareApp', action: 'share_invite' },
    { id: 'done', labelKey: 'coach.wizard.finishHome', action: 'finish' },
  ],
};

const OTHER_WELCOME_STEP: WizardTourStep = {
  id: 'other-welcome',
  kind: 'route',
  titleKey: 'coach.wizard.otherWelcomeTitle',
  bodyKey: 'coach.wizard.otherWelcomeBody',
  ctaKey: 'coach.wizard.otherWelcomeCta',
  route: '/tabs/peladas',
};

const MURAL_STEP: WizardTourStep = {
  id: 'mural',
  kind: 'route',
  titleKey: 'coach.hint.voteTitle',
  bodyKey: 'coach.hint.voteBody',
  ctaKey: 'coach.muralCta',
  route: '/tabs/mural',
};

export function peladaBranchTail(choiceId: string): WizardTourStep[] {
  if (choiceId === 'admin') {
    return [PELADA_ADMIN_CREATE_STEP, INVITE_FINISH_STEP];
  }
  return [PELADA_PLAYER_SEARCH_STEP, INVITE_FINISH_STEP];
}

export function teamBranchTail(choiceId: string): WizardTourStep[] {
  if (choiceId === 'president') {
    return [TEAM_PRESIDENT_CREATE_STEP, INVITE_FINISH_STEP];
  }
  return [TEAM_PLAYER_SEARCH_STEP, INVITE_FINISH_STEP];
}

export function buildPeladaWizardFlow(includeAthlete: boolean): WizardTourStep[] {
  const steps: WizardTourStep[] = [];
  if (includeAthlete) steps.push(ATHLETE_STEP);
  steps.push(PELADA_ROLE_STEP);
  return steps;
}

export function buildTeamWizardFlow(includeAthlete: boolean): WizardTourStep[] {
  const steps: WizardTourStep[] = [];
  if (includeAthlete) steps.push(ATHLETE_STEP);
  steps.push(TEAM_ROLE_STEP);
  return steps;
}

export function buildOtherWizardFlow(includeRoleHint: WizardTourStep | null): WizardTourStep[] {
  const steps: WizardTourStep[] = [OTHER_WELCOME_STEP];
  if (includeRoleHint) steps.push(includeRoleHint);
  steps.push(MURAL_STEP, INVITE_FINISH_STEP);
  return steps;
}

export function roleHintStepForPrimaryRole(role: string | null | undefined): WizardTourStep | null {
  if (role === 'referee') {
    return {
      id: 'role-hint-referee',
      kind: 'route',
      titleKey: 'coach.sumulaTitle',
      bodyKey: 'coach.sumulaBody',
      ctaKey: 'coach.sumulaCta',
      route: '/tabs/peladas/lista',
    };
  }
  if (role === 'scout') {
    return {
      id: 'role-hint-scout',
      kind: 'route',
      titleKey: 'coach.scoutTitle',
      bodyKey: 'coach.scoutBody',
      ctaKey: 'coach.scoutCta',
      route: '/tabs/peladas/lista',
    };
  }
  return null;
}

/** @deprecated Menu fallback when no participation choice stored */
export const WIZARD_TOUR_LEGACY_STEPS: WizardTourStep[] = [
  ATHLETE_STEP,
  {
    id: 'find-pelada',
    kind: 'route',
    titleKey: 'coach.findPeladaTitle',
    bodyKey: 'coach.findPeladaBody',
    ctaKey: 'coach.findPeladaCta',
    route: '/tabs/search',
  },
  PELADA_ADMIN_CREATE_STEP,
  {
    id: 'next-event',
    kind: 'route',
    titleKey: 'coach.nextEventTitle',
    bodyKey: 'coach.nextEventBody',
    ctaKey: 'coach.nextEventCta',
    route: '/tabs/peladas/lista',
  },
  INVITE_FINISH_STEP,
  MURAL_STEP,
  {
    id: 'legend',
    kind: 'route',
    titleKey: 'coach.hint.legendTitle',
    bodyKey: 'coach.hint.legendBody',
    ctaKey: 'coach.legendCta',
    route: '/legends',
  },
];
