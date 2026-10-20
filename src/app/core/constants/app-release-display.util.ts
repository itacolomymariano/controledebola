import { APP_RELEASE } from './app-release';

/** Versao completa exibida no login e no primeiro acesso (label + build). */
export function formatAppReleaseFullLabel(): string {
  return `${APP_RELEASE.label} (${APP_RELEASE.number})`;
}
