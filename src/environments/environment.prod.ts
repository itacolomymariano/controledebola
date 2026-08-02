import { parseLocal } from './environment.local';

export const environment = {
  production: true,
  /** Ativar quando o provedor de e-mail estiver configurado no Back4App. */
  passwordResetEnabled: false,
  parse: {
    appId: parseLocal.appId,
    javascriptKey: parseLocal.javascriptKey,
    serverURL: 'https://parseapi.back4app.com',
  },
};
