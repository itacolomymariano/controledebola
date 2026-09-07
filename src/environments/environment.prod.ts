import { parseLocal } from './environment.local';

export const environment = {
  production: true,
  /** Exige Email Adapter SMTP (Zoho) no Back4App — docs/BACK4APP-ZOHO-SMTP.md */
  passwordResetEnabled: true,
  parse: {
    appId: parseLocal.appId,
    javascriptKey: parseLocal.javascriptKey,
    serverURL: 'https://parseapi.back4app.com',
  },
};
