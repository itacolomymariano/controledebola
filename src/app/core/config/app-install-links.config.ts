/** Teste interno Google Play (ate listagem publica). */
export const APP_INSTALL_ANDROID_URL =
  'https://play.google.com/apps/internaltest/4700271103655863991';

/** Ficha publica na App Store (Controle de Bola). */
export const APP_INSTALL_IOS_URL = 'https://apps.apple.com/app/id6801505260';

export const APP_INVITE_LANDING_URL = 'https://controledebola.com/app';

export function buildAppInviteLandingUrl(options?: { src?: string; medium?: string; campaign?: string }): string {
  const url = new URL(APP_INVITE_LANDING_URL);
  const src = options?.src?.trim() || 'invite';
  url.searchParams.set('utm_source', src);
  url.searchParams.set('utm_medium', options?.medium?.trim() || 'app');
  if (options?.campaign?.trim()) {
    url.searchParams.set('utm_campaign', options.campaign.trim());
  }
  return url.toString();
}

export function formatAppInviteShareText(options?: { src?: string; medium?: string; campaign?: string }): string {
  const landing = buildAppInviteLandingUrl(options);
  return [
    'Controle de Bola App — futebol amador',
    `Baixe: ${landing}`,
    `Android (Google Play): ${APP_INSTALL_ANDROID_URL}`,
    `iPhone (App Store): ${APP_INSTALL_IOS_URL}`,
  ].join('\n');
}
