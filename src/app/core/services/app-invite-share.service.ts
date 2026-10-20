import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ToastController } from '@ionic/angular';

import {
  APP_INSTALL_ANDROID_URL,
  APP_INSTALL_IOS_URL,
  APP_INVITE_LANDING_URL,
  formatAppInviteShareText,
} from '../config/app-install-links.config';

/** Site institucional (Sobre, marketing). */
export const APP_SITE_URL = 'https://controledebola.com';

/** @deprecated Use APP_INSTALL_ANDROID_URL */
export const APP_INSTALL_URL = APP_INSTALL_ANDROID_URL;

export { APP_INVITE_LANDING_URL, APP_INSTALL_ANDROID_URL, APP_INSTALL_IOS_URL };

const INVITE_TITLE = 'Controle de Bola App';
const INVITE_DIALOG = 'Convidar amigos';
const BRAND_LOGO_PATH = 'assets/icon/logo_controle_de_bola.png';
const GOOGLE_PLAY_BADGE_PATH = 'assets/invite/google-play-badge.svg';
const APP_STORE_BADGE_PATH = 'assets/invite/app-store-badge.svg';
const TESTER_EMAIL = 'contato@controledebola.com';
const STORE_BADGE_HEIGHT = 64;
const STORE_BADGE_GAP = 16;

/** Links Android + iOS na legenda editavel do share. */
const SHARE_CAPTION = formatAppInviteShareText();

@Injectable({ providedIn: 'root' })
export class AppInviteShareService {
  constructor(private readonly toastCtrl: ToastController) {}

  async shareInvite(): Promise<void> {
    try {
      const shareDataUrl = await this.composeInviteImage();
      const base64 = shareDataUrl.replace(/^data:image\/png;base64,/, '');

      if (Capacitor.isNativePlatform()) {
        const fileName = `controle-de-bola-convite-${Date.now()}.png`;
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: INVITE_TITLE,
          text: SHARE_CAPTION,
          url: APP_INVITE_LANDING_URL,
          files: [saved.uri],
          dialogTitle: INVITE_DIALOG,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const blob = await (await fetch(shareDataUrl)).blob();
        const file = new File([blob], 'controle-de-bola-convite.png', { type: 'image/png' });
        const withFile = {
          title: INVITE_TITLE,
          text: SHARE_CAPTION,
          url: APP_INVITE_LANDING_URL,
          files: [file],
        };
        if (navigator.canShare?.(withFile)) {
          await navigator.share(withFile);
          return;
        }
        await navigator.share({
          title: INVITE_TITLE,
          text: SHARE_CAPTION,
          url: APP_INVITE_LANDING_URL,
        });
        return;
      }

      await this.copyInstallUrl();
    } catch (error: unknown) {
      if (this.isShareCancelled(error)) {
        return;
      }
      console.warn('app invite share with image failed, falling back to link', error);
      try {
        if (Capacitor.isNativePlatform()) {
          await Share.share({
            title: INVITE_TITLE,
            text: SHARE_CAPTION,
            url: APP_INVITE_LANDING_URL,
            dialogTitle: INVITE_DIALOG,
          });
          return;
        }
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({
            title: INVITE_TITLE,
            text: SHARE_CAPTION,
            url: APP_INVITE_LANDING_URL,
          });
          return;
        }
        await this.copyInstallUrl();
      } catch (fallbackError: unknown) {
        if (this.isShareCancelled(fallbackError)) {
          return;
        }
        try {
          await this.copyInstallUrl();
        } catch {
          const toast = await this.toastCtrl.create({
            message: 'Nao foi possivel compartilhar. Tente novamente.',
            duration: 2800,
            color: 'danger',
          });
          await toast.present();
        }
      }
    }
  }

  /**
   * Imagem para redes: marca, instrucoes e badges Google Play / App Store.
   * Links clicaveis ficam na legenda do share (text + url landing).
   */
  private async composeInviteImage(): Promise<string> {
    const logo = await this.loadImage(BRAND_LOGO_PATH).catch(() => null);
    const playBadge = await this.loadImage(GOOGLE_PLAY_BADGE_PATH).catch(() => null);
    const appStoreBadge = await this.loadImage(APP_STORE_BADGE_PATH).catch(() => null);
    const captionLines = [
      'Venha para o Controle de Bola App',
      'a rede social do futebol amador!',
      '',
      'Android (Google Play — teste interno):',
      '1. Envie um e-mail da Play Store para:',
      TESTER_EMAIL,
      '2. Solicite cadastro nos testes.',
      '3. Use o link Android abaixo.',
      '',
      'iPhone (App Store):',
      'Use o link da App Store abaixo.',
    ];

    const padding = 32;
    const gap = 20;
    const logoSize = 64;
    const brandFontSize = 32;
    const brandPadY = 18;
    const brandRowHeight = Math.max(logoSize, brandFontSize) + brandPadY * 2;
    const captionFontSize = 24;
    const captionLineHeight = 34;
    const width = 720;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) {
      throw new Error('Canvas 2D indisponivel');
    }
    measureCtx.font = `500 ${captionFontSize}px Arial, Helvetica, sans-serif`;
    const wrapped = captionLines.flatMap((line) => {
      if (line === '') return [''];
      if (line === TESTER_EMAIL) return [line];
      return this.wrapText(measureCtx, line, width);
    });
    const captionHeight = wrapped.length * captionLineHeight;
    const storeRowHeight = STORE_BADGE_HEIGHT + gap;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width + padding * 2);
    canvas.height = Math.round(
      brandRowHeight + gap + captionHeight + storeRowHeight + padding * 2
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D indisponivel');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0b5cab';
    ctx.fillRect(0, 0, canvas.width, brandRowHeight);

    let brandX = padding;
    const brandY = brandRowHeight / 2;
    if (logo) {
      const logoY = (brandRowHeight - logoSize) / 2;
      ctx.drawImage(logo, brandX, logoY, logoSize, logoSize);
      brandX += logoSize + 14;
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${brandFontSize}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(INVITE_TITLE, brandX, brandY, canvas.width - brandX - padding);

    let textY = brandRowHeight + gap + captionFontSize;
    for (const line of wrapped) {
      if (line === '') {
        textY += captionLineHeight * 0.5;
        continue;
      }
      const isEmail = line === TESTER_EMAIL;
      ctx.fillStyle = isEmail ? '#0b5cab' : '#222222';
      ctx.font = isEmail
        ? `bold ${captionFontSize}px Arial, Helvetica, sans-serif`
        : `500 ${captionFontSize}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(line, padding, textY);
      textY += captionLineHeight;
    }

    const badgeY = textY + gap;
    this.drawStoreBadges(ctx, padding, badgeY, width, playBadge, appStoreBadge);

    return canvas.toDataURL('image/png');
  }

  private drawStoreBadges(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    contentWidth: number,
    playBadge: HTMLImageElement | null,
    appStoreBadge: HTMLImageElement | null
  ): void {
    const badgeWidth = Math.floor((contentWidth - STORE_BADGE_GAP) / 2);
    const badgeHeight = STORE_BADGE_HEIGHT;
    const playX = left;
    const iosX = left + badgeWidth + STORE_BADGE_GAP;

    if (playBadge && appStoreBadge) {
      ctx.drawImage(playBadge, playX, top, badgeWidth, badgeHeight);
      ctx.drawImage(appStoreBadge, iosX, top, badgeWidth, badgeHeight);
      return;
    }

    this.drawStoreBadgeFallback(ctx, playX, top, badgeWidth, badgeHeight, 'Google Play', 'play');
    this.drawStoreBadgeFallback(ctx, iosX, top, badgeWidth, badgeHeight, 'App Store', 'apple');
  }

  private drawStoreBadgeFallback(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    kind: 'play' | 'apple'
  ): void {
    const radius = 10;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px Arial, Helvetica, sans-serif';
    ctx.textBaseline = 'middle';
    const icon = kind === 'play' ? '▶' : '';
    if (icon) {
      ctx.font = '700 22px Arial, Helvetica, sans-serif';
      ctx.fillText(icon, x + 18, y + h / 2);
    }
    ctx.font = '700 20px Arial, Helvetica, sans-serif';
    ctx.fillText(label, x + 52, y + h / 2, w - 60);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines: string[] = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = words[i];
      } else {
        current = test;
      }
    }
    lines.push(current);
    return lines;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${src}`));
      img.src = src;
    });
  }

  private async copyInstallUrl(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      throw new Error('Clipboard indisponivel');
    }
    await navigator.clipboard.writeText(SHARE_CAPTION);
    const toast = await this.toastCtrl.create({
      message: 'Links Android e iOS copiados.',
      duration: 2800,
      color: 'success',
    });
    await toast.present();
  }

  private isShareCancelled(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { name?: string; message?: string; code?: string };
    if (err.name === 'AbortError') return true;
    const message = String(err.message || '').toLowerCase();
    if (message.includes('cancel') || message.includes('dismiss') || message.includes('abort')) {
      return true;
    }
    const code = String(err.code || '').toLowerCase();
    return code.includes('cancel') || code.includes('abort');
  }
}
