/** Teste interno Google Play (ate listagem publica). */
export const APP_INSTALL_ANDROID_URL =
  'https://play.google.com/apps/internaltest/4700271103655863991';

/** Ficha publica na App Store (Controle de Bola). */
export const APP_INSTALL_IOS_URL = 'https://apps.apple.com/app/id6801505260';

export const APP_INVITE_LANDING_URL = 'https://controledebola.com/app';

export function formatAppInviteShareText(): string {
  return [
    'Controle de Bola App — futebol amador',
    `Baixe: ${APP_INVITE_LANDING_URL}`,
    `Android (Google Play): ${APP_INSTALL_ANDROID_URL}`,
    `iPhone (App Store): ${APP_INSTALL_IOS_URL}`,
  ].join('\n');
}
