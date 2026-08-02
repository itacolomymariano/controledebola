import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.minhapelada.app',
  appName: 'Controle de Bola',
  webDir: 'www',
  plugins: {
    // Desativado: interceptacao de HTTP nativa pode gerar falso positivo em antivirus (ex.: Norton).
    CapacitorHttp: {
      enabled: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
