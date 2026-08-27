import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { ToastController } from '@ionic/angular';

/** Site institucional (Sobre, marketing). */
export const APP_SITE_URL = 'https://controledebola.com';

/**
 * Link de instalacao (legenda editavel do share).
 * Enquanto nao ha listagem publica na Play Store, usa o teste interno.
 */
export const APP_INSTALL_URL =
  'https://play.google.com/apps/internaltest/4700271103655863991';

export const APP_INVITE_LANDING_URL = 'https://controledebola.com/app';

const INVITE_TITLE = 'Controle de Bola App';
const INVITE_DIALOG = 'Convidar amigos';
const BRAND_LOGO_PATH = 'assets/icon/logo_controle_de_bola.png';
const TESTER_EMAIL = 'contato@controledebola.com';

/** So o link na area editavel — instrucoes ficam na imagem (nao apagaveis). */
const SHARE_CAPTION = APP_INSTALL_URL;

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
          url: APP_INSTALL_URL,
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
          url: APP_INSTALL_URL,
          files: [file],
        };
        if (navigator.canShare?.(withFile)) {
          await navigator.share(withFile);
          return;
        }
        await navigator.share({
          title: INVITE_TITLE,
          text: SHARE_CAPTION,
          url: APP_INSTALL_URL,
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
            url: APP_INSTALL_URL,
            dialogTitle: INVITE_DIALOG,
          });
          return;
        }
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({
            title: INVITE_TITLE,
            text: SHARE_CAPTION,
            url: APP_INSTALL_URL,
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
   * Imagem: icone + nome + instrucoes de download/teste (fixos fixos).
   * Link da Play vai so na legenda editavel do share.
   */
  private async composeInviteImage(): Promise<string> {
    const logo = await this.loadImage(BRAND_LOGO_PATH).catch(() => null);
    const captionLines = [
      'Venha para o Controle de Bola App',
      'a rede social do futebol amador!',
      '',
      'Para baixar o app (teste interno Google Play):',
      '',
      '1. Envie um e-mail valido usado na',
      'Google Play Store para:',
      TESTER_EMAIL,
      '',
      '2. Solicite o cadastro para os testes.',
      '',
      '3. Em seguida use o link de download',
      'apresentado abaixo.',
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

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width + padding * 2);
    canvas.height = Math.round(brandRowHeight + gap + captionHeight + padding * 2);
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

    return canvas.toDataURL('image/png');
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
    await navigator.clipboard.writeText(APP_INSTALL_URL);
    const toast = await this.toastCtrl.create({
      message: 'Link de teste interno (Play) copiado.',
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
