/** Mapa rota → chave i18n do balao de ajuda (`screen.help.<pagina>`); o primeiro padrao que casar vence. */
export const SCREEN_HELP_ROUTES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /^\/onboarding$/, key: 'screen.help.onboarding' },
  { pattern: /^\/login$/, key: 'screen.help.login' },
  { pattern: /^\/register$/, key: 'screen.help.register' },
  { pattern: /^\/profile-setup$/, key: 'screen.help.profile-setup' },

  { pattern: /^\/tabs\/home$/, key: 'screen.help.home' },
  { pattern: /^\/tabs\/peladas\/lista$/, key: 'screen.help.peladas' },
  { pattern: /^\/tabs\/peladas\/confrontos$/, key: 'screen.help.events' },
  { pattern: /^\/tabs\/peladas\/times$/, key: 'screen.help.search' },
  { pattern: /^\/tabs\/peladas\/usuarios(\/[^/]+)?$/, key: 'screen.help.search' },
  { pattern: /^\/tabs\/peladas$/, key: 'screen.help.home' },
  { pattern: /^\/tabs\/events$/, key: 'screen.help.events' },
  { pattern: /^\/tabs\/search$/, key: 'screen.help.search' },
  { pattern: /^\/tabs\/mural$/, key: 'screen.help.mural' },
  { pattern: /^\/tabs\/profile$/, key: 'screen.help.profile' },

  { pattern: /^\/about$/, key: 'screen.help.about' },
  { pattern: /^\/contact(\/[^/]+)?$/, key: 'screen.help.contact-message' },
  { pattern: /^\/inbox$/, key: 'screen.help.inbox' },
  { pattern: /^\/material-inventory$/, key: 'screen.help.material-inventory' },
  { pattern: /^\/account\/edit$/, key: 'screen.help.account-edit' },

  { pattern: /^\/pelada-create$/, key: 'screen.help.pelada-form' },
  { pattern: /^\/pelada\/[^/]+\/edit$/, key: 'screen.help.pelada-form' },
  { pattern: /^\/pelada\/[^/]+$/, key: 'screen.help.pelada-detail' },

  { pattern: /^\/event-create$/, key: 'screen.help.event-create' },
  { pattern: /^\/confronto-create$/, key: 'screen.help.confronto-create' },
  { pattern: /^\/desafio-create$/, key: 'screen.help.desafio-create' },

  { pattern: /^\/team\/form$/, key: 'screen.help.team-form' },
  { pattern: /^\/team\/[^/]+$/, key: 'screen.help.team-profile' },

  { pattern: /^\/event\/[^/]+\/mural\/media\/video$/, key: 'screen.help.event-mural-media-video' },
  { pattern: /^\/event\/[^/]+\/mural\/media\/radio$/, key: 'screen.help.event-mural-media-radio' },
  { pattern: /^\/event\/[^/]+\/mural\/media\/journal$/, key: 'screen.help.event-mural-media-journal' },
  { pattern: /^\/event\/[^/]+\/mural\/media$/, key: 'screen.help.event-mural-media-hub' },
  { pattern: /^\/event\/[^/]+\/mural$/, key: 'screen.help.event-mural' },
  { pattern: /^\/event\/[^/]+\/gate-scan$/, key: 'screen.help.event-gate-scan' },
  { pattern: /^\/event\/[^/]+\/gate-entries$/, key: 'screen.help.event-gate-entries' },
  { pattern: /^\/event\/[^/]+\/narrator-radio$/, key: 'screen.help.event-narrator-radio' },
  { pattern: /^\/event\/[^/]+\/journalist-journal$/, key: 'screen.help.event-journalist-journal' },
  { pattern: /^\/event\/[^/]+\/cameraman-coverage$/, key: 'screen.help.event-cameraman-coverage' },
  { pattern: /^\/event\/[^/]+\/scout$/, key: 'screen.help.event-scout-apontamento' },
  { pattern: /^\/event\/[^/]+\/sumula$/, key: 'screen.help.event-sumula' },
  { pattern: /^\/event\/[^/]+\/supplementary-hiring$/, key: 'screen.help.event-supplementary-hiring' },
  { pattern: /^\/event\/[^/]+\/register$/, key: 'screen.help.event-register' },
  { pattern: /^\/event\/[^/]+\/team-split$/, key: 'screen.help.event-team-split' },
  { pattern: /^\/event\/[^/]+\/predictions$/, key: 'screen.help.event-predictions' },
  { pattern: /^\/event\/[^/]+\/fan-checkin$/, key: 'screen.help.event-fan-checkin' },
  { pattern: /^\/event\/[^/]+\/coach-board$/, key: 'screen.help.event-coach-board' },
  { pattern: /^\/event\/[^/]+\/masseur-treatments$/, key: 'screen.help.event-masseur-treatments' },
  { pattern: /^\/event\/[^/]+\/physical-trainer$/, key: 'screen.help.event-physical-trainer' },
  { pattern: /^\/event\/[^/]+$/, key: 'screen.help.event-detail' },

  { pattern: /^\/athlete-profile\/form$/, key: 'screen.help.athlete-profile-form' },
  { pattern: /^\/athlete-profile\/hiring$/, key: 'screen.help.athlete-profile-hiring' },
  { pattern: /^\/role-profile\/form$/, key: 'screen.help.role-profile-form' },
  { pattern: /^\/fan-profile\/form$/, key: 'screen.help.fan-profile-form' },
  { pattern: /^\/athlete\/[^/]+$/, key: 'screen.help.athlete-profile-view' },
  { pattern: /^\/profile\/[^/]+\/[^/]+$/, key: 'screen.help.profile-view' },

  { pattern: /^\/legends$/, key: 'screen.help.legends-hub' },
  { pattern: /^\/legends\/athlete\/new$/, key: 'screen.help.legend-athlete-form' },
  { pattern: /^\/legends\/pro-athlete\/new$/, key: 'screen.help.legend-pro-athlete-form' },
  { pattern: /^\/legends\/athlete\/[^/]+$/, key: 'screen.help.legend-athlete-view' },
  { pattern: /^\/legends\/team\/new$/, key: 'screen.help.legend-team-form' },
];

export function resolveScreenHelpKey(url: string): string {
  let path = (url || '').split(/[?#]/)[0];
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  for (const { pattern, key } of SCREEN_HELP_ROUTES) {
    if (pattern.test(path)) return key;
  }
  return '';
}
