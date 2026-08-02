import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { AlertController, ToastController } from '@ionic/angular';
import { Address } from '../models/address.model';
import { MURAL_SHARE_BRAND, MuralShareContext } from '../models/mural-share.model';

const BRAND_LOGO_PATH = 'assets/icon/logo_controle_de_bola.png';
const SITE_URL = 'https://controledebola.com';

@Injectable({ providedIn: 'root' })
export class MuralShareService {
  constructor(
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController
  ) {}

  /** Linhas de legenda (sem a marca — a marca vai com o icone na imagem). */
  buildCaptionLines(context: MuralShareContext): string[] {
    const lines: string[] = [];
    if (context.cardTitle?.trim()) {
      lines.push(context.cardTitle.trim());
    }

    if (context.scope === 'app') {
      lines.push(this.formatShareDateTime(new Date()));
    } else if (context.scope === 'pelada') {
      if (context.peladaName?.trim()) lines.push(context.peladaName.trim());
      const place = this.formatPlace(
        context.peladaState,
        context.peladaCity,
        context.peladaNeighborhood
      );
      if (place) lines.push(place);
    } else if (context.scope === 'event') {
      if (context.peladaName?.trim()) lines.push(context.peladaName.trim());
      const place = this.formatPlace(
        context.peladaState,
        context.peladaCity,
        context.peladaNeighborhood
      );
      if (place) lines.push(place);
      if (context.eventName?.trim()) lines.push(context.eventName.trim());
      if (context.eventLocation?.trim()) lines.push(context.eventLocation.trim());
      if (context.eventStartTime) {
        lines.push(this.formatShareDateTime(new Date(context.eventStartTime)));
      }
    }

    lines.push(SITE_URL);
    return lines.filter(Boolean);
  }

  buildCaption(context: MuralShareContext): string {
    return [MURAL_SHARE_BRAND, ...this.buildCaptionLines(context)].filter(Boolean).join('\n');
  }

  contextFromPelada(pelada: {
    name: string;
    address?: Address;
  }): Pick<
    MuralShareContext,
    'peladaName' | 'peladaState' | 'peladaCity' | 'peladaNeighborhood'
  > {
    const address = pelada.address;
    return {
      peladaName: pelada.name,
      peladaState: address?.state || '',
      peladaCity: address?.city || '',
      peladaNeighborhood: address?.neighborhood || '',
    };
  }

  contextFromEvent(
    event: {
      name: string;
      peladaName?: string;
      startTime: Date;
      address?: Address;
      locationComplement?: string;
    },
    pelada?: { name: string; address?: Address } | null
  ): MuralShareContext {
    const peladaBits = pelada
      ? this.contextFromPelada(pelada)
      : {
          peladaName: event.peladaName || '',
          peladaState: '',
          peladaCity: '',
          peladaNeighborhood: '',
        };

    const addressParts = event.address
      ? [
          event.address.street,
          event.address.neighborhood,
          event.address.city,
          event.address.state,
        ]
          .map((part) => String(part || '').trim())
          .filter(Boolean)
          .join(', ')
      : '';
    const eventLocation = [addressParts, event.locationComplement?.trim() || '']
      .filter(Boolean)
      .join(' — ');

    return {
      scope: 'event',
      ...peladaBits,
      eventName: event.name,
      eventLocation,
      eventStartTime: event.startTime,
    };
  }

  async shareCard(element: HTMLElement, context: MuralShareContext): Promise<void> {
    const caption = this.buildCaption(context);
    try {
      const cardDataUrl = await this.captureCardPng(element);
      const shareDataUrl = await this.composeShareImage(cardDataUrl, context);
      const base64 = shareDataUrl.replace(/^data:image\/png;base64,/, '');

      if (Capacitor.isNativePlatform()) {
        const fileName = `mural-share-${Date.now()}.png`;
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: context.cardTitle || MURAL_SHARE_BRAND,
          files: [saved.uri],
          dialogTitle: 'Compartilhar no mural',
        });
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        const blob = await (await fetch(shareDataUrl)).blob();
        const file = new File([blob], 'mural-share.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: context.cardTitle || MURAL_SHARE_BRAND,
            files: [file],
          });
        } else {
          await this.fallbackCopy(caption, shareDataUrl);
        }
      } else {
        await this.fallbackCopy(caption, shareDataUrl);
      }
    } catch (error: unknown) {
      if (this.isShareCancelled(error)) {
        return;
      }
      console.warn('mural share failed', error);
      const alert = await this.alertCtrl.create({
        header: 'Compartilhar',
        message: 'Nao foi possivel gerar a imagem do card. Tente novamente.',
        buttons: ['OK'],
      });
      await alert.present();
    }
  }

  /** Usuario fechou o sheet do sistema sem compartilhar. */
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

  /**
   * Captura o card. Imagens cross-origin (avatar/escudo) costumam quebrar html-to-image;
   * tenta completo e, se falhar, repete sem essas imagens.
   */
  private async captureCardPng(element: HTMLElement): Promise<string> {
    const backgroundColor = this.resolveBackgroundColor();
    const baseOptions = {
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 2, 2),
      backgroundColor,
      skipFonts: true as const,
    };

    try {
      return await toPng(element, {
        ...baseOptions,
        filter: (node) => this.shouldIncludeShareNode(node, false),
      });
    } catch (error: unknown) {
      console.warn('mural share capture with images failed, retrying without remote imgs', error);
      return await toPng(element, {
        ...baseOptions,
        filter: (node) => this.shouldIncludeShareNode(node, true),
      });
    }
  }

  private shouldIncludeShareNode(node: Node, excludeRemoteImages: boolean): boolean {
    if (!(node instanceof HTMLElement)) return true;
    if (node.classList?.contains('mural-share-exclude')) return false;
    if (!excludeRemoteImages) return true;
    if (node.tagName === 'IMG') {
      const src = (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src || '';
      return this.isSafeShareImageSrc(src);
    }
    return true;
  }

  private isSafeShareImageSrc(src: string): boolean {
    if (!src) return false;
    if (src.startsWith('data:')) return true;
    if (src.startsWith('blob:')) return true;
    if (src.includes('/assets/')) return true;
    try {
      const url = new URL(src, window.location.href);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Monta arte final: [icone] Controle de Bola App (negrito/destaque) + card + legenda.
   */
  private async composeShareImage(
    cardDataUrl: string,
    context: MuralShareContext
  ): Promise<string> {
    const [logo, card] = await Promise.all([
      this.loadImage(BRAND_LOGO_PATH).catch(() => null),
      this.loadImage(cardDataUrl),
    ]);

    if (!card.width || !card.height) {
      throw new Error('Card capturado sem dimensoes validas');
    }

    const captionLines = this.buildCaptionLines(context);
    const padding = 32;
    const gap = 20;
    const logoSize = 56;
    const brandFontSize = 34;
    const brandPadY = 18;
    const brandRowHeight = Math.max(logoSize, brandFontSize) + brandPadY * 2;
    const captionFontSize = 22;
    const captionLineHeight = 32;
    // Limita largura para evitar canvas enorme em cards largos.
    const maxWidth = Math.min(Math.max(card.width, 720), 1200);
    const textMaxWidth = maxWidth;

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) {
      throw new Error('Canvas 2D indisponivel');
    }
    measureCtx.font = `500 ${captionFontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const wrappedCaption = captionLines.flatMap((line) =>
      this.wrapText(measureCtx, line, textMaxWidth)
    );

    const captionBlockHeight = wrappedCaption.length
      ? wrappedCaption.length * captionLineHeight + gap
      : 0;
    const cardDrawWidth = maxWidth;
    const cardDrawHeight = card.height * (cardDrawWidth / card.width);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(maxWidth + padding * 2);
    canvas.height = Math.round(
      brandRowHeight +
        gap +
        cardDrawHeight +
        (captionBlockHeight ? gap + captionBlockHeight : 0) +
        padding
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D indisponivel');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Faixa de destaque — primeira linha: Controle de Bola App (negrito)
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
    ctx.fillText(MURAL_SHARE_BRAND, brandX, brandY, canvas.width - brandX - padding);

    const cardY = brandRowHeight + gap;
    ctx.drawImage(card, padding, cardY, cardDrawWidth, cardDrawHeight);

    if (wrappedCaption.length) {
      let textY = cardY + cardDrawHeight + gap + captionFontSize;
      for (const line of wrappedCaption) {
        const isSite = line === SITE_URL;
        if (isSite) {
          ctx.fillStyle = '#0b5cab';
          ctx.font = `600 ${captionFontSize}px Arial, Helvetica, sans-serif`;
        } else {
          ctx.fillStyle = '#222222';
          ctx.font = `500 ${captionFontSize}px Arial, Helvetica, sans-serif`;
        }
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(line, padding, textY);
        textY += captionLineHeight;
      }
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

  private resolveBackgroundColor(): string {
    try {
      return getComputedStyle(document.body).backgroundColor || '#ffffff';
    } catch {
      return '#ffffff';
    }
  }

  private formatPlace(state?: string, city?: string, neighborhood?: string): string {
    return [state, city, neighborhood]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' · ');
  }

  private formatShareDateTime(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private async fallbackCopy(caption: string, dataUrl?: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(caption);
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `mural-${Date.now()}.png`;
        link.click();
      }
      const toast = await this.toastCtrl.create({
        message: dataUrl
          ? 'Imagem baixada para compartilhar (legenda ja esta na arte).'
          : 'Legenda copiada.',
        duration: 2500,
      });
      await toast.present();
    } catch {
      const alert = await this.alertCtrl.create({
        header: 'Compartilhar',
        message: caption,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
}
