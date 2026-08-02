import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications';
import { ToastController } from '@ionic/angular';
import Parse from 'parse';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

export interface PushNotificationPayload {
  type?: string;
  peladaId?: string;
  eventId?: string;
  registrationId?: string;
  invitationId?: string;
  decision?: string;
  title?: string;
  body?: string;
  alert?: string;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private initialized = false;
  private currentToken: string | null = null;

  constructor(
    private readonly parseService: ParseService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController
  ) {
    this.parseService.init();
  }

  async initialize(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) {
      return;
    }
    this.initialized = true;

    await PushNotifications.addListener('registration', (token: Token) => {
      void this.onRegistration(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push registration error', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.info('Push received in foreground', notification);
      void this.showForegroundToast(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      void this.handleNotificationAction(action);
    });

    await this.ensureAndroidChannel();
    await this.ensurePermissionsAndRegister();
  }

  async ensurePermissionsAndRegister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await this.ensureAndroidChannel();
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
      }
      if (permission.receive !== 'granted') {
        return;
      }
      await PushNotifications.register();
    } catch (error: unknown) {
      console.warn('Push setup failed', parseErrorMessage(error));
    }
  }

  /** Canal Android 8+ — sem ele o FCM pode “enviar” sem aparecer na bandeja. */
  private async ensureAndroidChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }
    try {
      await PushNotifications.createChannel({
        id: 'event_messages',
        name: 'Mensagens de eventos',
        description: 'Avisos do administrador e alertas da pelada',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
        lights: true,
      });
    } catch (error: unknown) {
      console.warn('Push channel setup failed', parseErrorMessage(error));
    }
  }

  /** Preferencia no User (default: true quando o campo nao existe). */
  async isPushEnabledPreference(): Promise<boolean> {
    if (!Parse.User.current()) {
      return false;
    }
    try {
      const result = await Parse.Cloud.run('getPushNotificationsEnabled');
      return result?.enabled !== false;
    } catch {
      const user = Parse.User.current();
      return user?.get('pushNotificationsEnabled') !== false;
    }
  }

  /**
   * Ativa/desativa push no servidor e no device.
   * Desligar desvincula Installations; ligar pede permissao OS e registra token.
   */
  async setPushEnabledPreference(enabled: boolean): Promise<void> {
    await Parse.Cloud.run('setPushNotificationsEnabled', { enabled });
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    if (enabled) {
      await this.ensurePermissionsAndRegister();
      await this.syncCurrentUser();
      return;
    }
    await this.clearCurrentUser();
  }

  async syncCurrentUser(): Promise<void> {
    if (!Parse.User.current() || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      const allowed = await this.isPushEnabledPreference();
      if (!allowed) {
        return;
      }
    } catch {
      // segue e tenta registrar; o Cloud rejeita se estiver desativado
    }

    if (!this.currentToken) {
      await this.ensurePermissionsAndRegister();
    }
    if (!this.currentToken) {
      return;
    }

    try {
      const platform = Capacitor.getPlatform();
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      // Ajuda a distinguir Samsung vs Motorola no diagnose (mesmo usuario em 2 aparelhos).
      let deviceModel = platform;
      const modelMatch = ua.match(/;\s*([^;)]+)\s+Build\//i);
      if (modelMatch?.[1]) {
        deviceModel = modelMatch[1].trim();
      }
      await Parse.Cloud.run('registerPushDevice', {
        deviceToken: this.currentToken,
        deviceType: platform,
        deviceModel,
        deviceLabel: ua.slice(0, 120),
      });
    } catch (error: unknown) {
      console.warn('Push device sync failed', parseErrorMessage(error));
    }
  }

  async sendEventConfirmedParticipantNotification(
    eventId: string,
    title: string,
    message: string,
    focus?: { email?: string; userId?: string }
  ): Promise<{
    targetedUsers: number;
    devicesMatched: number;
    focus?: {
      found?: boolean;
      confirmed?: boolean;
      hasInstallation?: boolean;
      inMatchedDevices?: boolean | null;
      userId?: string;
      email?: string;
    } | null;
  }> {
    const result = await Parse.Cloud.run('sendEventConfirmedParticipantNotification', {
      eventId,
      title,
      message,
      ...(focus?.email ? { focusEmail: focus.email } : {}),
      ...(focus?.userId ? { focusUserId: focus.userId } : {}),
    });
    return {
      targetedUsers: Number(result?.targetedUsers) || 0,
      devicesMatched: Number(result?.devicesMatched) || 0,
      focus: result?.focus ?? null,
    };
  }

  async clearCurrentUser(): Promise<void> {
    if (!this.currentToken || !Parse.User.current()) {
      return;
    }

    try {
      await Parse.Cloud.run('unregisterPushDevice', {
        deviceToken: this.currentToken,
      });
    } catch (error: unknown) {
      console.warn('Push device unregister failed', parseErrorMessage(error));
    }
  }

  private async onRegistration(token: string): Promise<void> {
    this.currentToken = token.trim();
    if (!this.currentToken) {
      return;
    }
    await this.syncCurrentUser();
  }

  private async showForegroundToast(notification: PushNotificationSchema): Promise<void> {
    const data = (notification.data || {}) as PushNotificationPayload;
    const title = notification.title || data.title || 'Controle de Bola';
    const body = notification.body || data.body || data.alert || '';
    const toast = await this.toastCtrl.create({
      header: title,
      message: body || 'Nova notificacao recebida.',
      duration: 4500,
      color: 'primary',
      position: 'top',
    });
    await toast.present();
  }

  private async handleNotificationAction(action: ActionPerformed): Promise<void> {
    const data = this.normalizeNotificationData(action.notification.data || {});
    await this.navigateFromPayload(data);
  }

  /** Parse FCM v1 pode aninhar custom data em `data` (JSON string). */
  private normalizeNotificationData(raw: Record<string, unknown>): PushNotificationPayload {
    let data = { ...raw } as Record<string, unknown>;
    const nested = data['data'];
    if (typeof nested === 'string') {
      try {
        const parsed = JSON.parse(nested) as Record<string, unknown>;
        data = { ...parsed, ...data };
      } catch {
        // mantem raw
      }
    } else if (nested && typeof nested === 'object') {
      data = { ...(nested as Record<string, unknown>), ...data };
    }
    return data as PushNotificationPayload;
  }

  private async navigateFromPayload(data: PushNotificationPayload): Promise<void> {
    if (!Parse.User.current()) {
      await this.router.navigateByUrl('/login');
      return;
    }

    switch (data.type) {
      case 'profile_presentation_request':
        if (data.peladaId) {
          await this.router.navigate(['/pelada', data.peladaId], {
            queryParams: { segment: 'configuracoes' },
          });
        }
        break;
      case 'hiring_invite':
        await this.router.navigateByUrl('/inbox');
        break;
      case 'hiring_response':
      case 'profile_presentation_approved':
      case 'profile_presentation_rejected':
      case 'new_pelada_event':
      case 'event_admin_message':
      case 'event_reminder_2h':
      case 'event_rescheduled':
      case 'event_cancelled':
        if (data.eventId) {
          await this.router.navigate(['/event', data.eventId]);
        } else {
          await this.router.navigateByUrl('/tabs/peladas');
        }
        break;
      default:
        if (data.eventId) {
          await this.router.navigate(['/event', data.eventId]);
        } else if (data.peladaId) {
          await this.router.navigate(['/pelada', data.peladaId]);
        } else {
          await this.router.navigateByUrl('/tabs/peladas');
        }
        break;
    }
  }
}
