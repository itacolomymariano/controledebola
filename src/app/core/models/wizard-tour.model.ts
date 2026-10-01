export interface WizardTourStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  route: string;
}

export const WIZARD_TOUR_STEPS: WizardTourStep[] = [
  {
    id: 'athlete',
    titleKey: 'coach.athleteTitle',
    bodyKey: 'coach.athleteBody',
    ctaKey: 'coach.athleteCta',
    route: '/athlete-profile/form',
  },
  {
    id: 'find-pelada',
    titleKey: 'coach.findPeladaTitle',
    bodyKey: 'coach.findPeladaBody',
    ctaKey: 'coach.findPeladaCta',
    route: '/tabs/search',
  },
  {
    id: 'create-pelada',
    titleKey: 'coach.hint.peladaCreateTitle',
    bodyKey: 'coach.hint.peladaCreateBody',
    ctaKey: 'coach.createPeladaCta',
    route: '/pelada-create',
  },
  {
    id: 'next-event',
    titleKey: 'coach.nextEventTitle',
    bodyKey: 'coach.nextEventBody',
    ctaKey: 'coach.nextEventCta',
    route: '/tabs/peladas',
  },
  {
    id: 'invite',
    titleKey: 'coach.hint.inviteTitle',
    bodyKey: 'coach.hint.inviteBody',
    ctaKey: 'coach.inviteCta',
    route: '/tabs/peladas',
  },
  {
    id: 'mural',
    titleKey: 'coach.hint.voteTitle',
    bodyKey: 'coach.hint.voteBody',
    ctaKey: 'coach.muralCta',
    route: '/tabs/mural',
  },
  {
    id: 'legend',
    titleKey: 'coach.hint.legendTitle',
    bodyKey: 'coach.hint.legendBody',
    ctaKey: 'coach.legendCta',
    route: '/legends',
  },
];

export const WIZARD_TOUR_AUTH_ROUTES = [
  '/login',
  '/register',
  '/splash',
  '/onboarding',
  '/profile-setup',
];
