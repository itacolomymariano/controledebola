import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.minhapelada.app',
  appName: 'Controle de Bola',
  webDir: 'www',
  // Textos de camera/galeria, icone e iPhone-only: scripts/apply-ios-review-config.js (apos cap add ios).
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
