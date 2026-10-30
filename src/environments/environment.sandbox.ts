import { parseLocal } from './environment.sandbox.local';

/** Build de apresentacao → Back4App Clone_MinhaPelada. Ver docs/SANDBOX-CLONE-APK.md */
export const environment = {
  production: true,
  sandboxBuild: true,
  passwordResetEnabled: true,
  parse: {
    appId: parseLocal.appId,
    javascriptKey: parseLocal.javascriptKey,
    serverURL: 'https://parseapi.back4app.com',
  },
};
