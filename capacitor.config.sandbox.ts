import type { CapacitorConfig } from '@capacitor/cli';

/** APK demo → Clone_MinhaPelada; instala ao lado de com.minhapelada.app. */
const config: CapacitorConfig = {
  appId: 'com.minhapelada.app.sandbox',
  appName: 'Controle de Bola (Sandbox)',
  webDir: 'www',
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
