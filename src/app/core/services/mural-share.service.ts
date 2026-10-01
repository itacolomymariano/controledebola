import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toPng } from 'html-to-image';
import { AlertController, ToastController } from '@ionic/angular';
import { Address } from '../models/address.model';
import { PeladaEvent } from '../models/event.model';
import {
  MURAL_APP_SHARE_HEADERS,
  MURAL_SHARE_BRAND,
  MuralShareContext,
} from '../models/mural-share.model';
import { muralFilterCaption } from '../utils/mural-filter-caption.util';
import { getTeamShieldCandidates, teamSlug } from '../utils/team-shield.util';
import { EventService } from './event.service';
import { PeladaService } from './pelada.service';

const BRAND_LOGO_PATH = 'assets/icon/logo_controle_de_bola.png';
const SITE_URL = 'https://controledebola.com';
const SHARE_IMAGE_FETCH_TIMEOUT_MS = 5000;
const SHARE_PRO_SHIELD_WAIT_MS = 2500;
const SHARE_IMAGES_READY_MS = 1500;

@Injectable({ providedIn: 'root' })
export class MuralShareService {
  /** Cache de data URLs por URL remota ou nome do time (sessão). */
  private readonly shareTeamDataCache = new Map<string, Promise<string | null>>();
  private readonly shareBatchDataCache = new Map<string, Promise<Map<string, string>>>();

  constructor(
    private readonly alertCtrl: AlertController,
    private readonly toastCtrl: ToastController,
    private readonly eventService: EventService,
    private readonly peladaService: PeladaService
  ) {}

  /** Linhas de legenda (sem a marca — a marca vai com o icone na imagem). */
  buildCaptionLines(context: MuralShareContext): string[] {
    const lines: string[] = [];
    if (context.cardTitle?.trim()) {
      lines.push(context.cardTitle.trim());
    }

    if (context.scope === 'app') {
      lines.push(this.appFilterCaption(context));
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
      if (context.eventLocation?.trim()) lines.push(context.eventLocation.trim());
    }

    lines.push(SITE_URL);
    return lines.filter(Boolean);
  }

  buildCaption(context: MuralShareContext): string {
    return [this.appShareHeader(context), ...this.buildCaptionLines(context)].filter(Boolean).join('\n');
  }

  appShareHeader(context: MuralShareContext): string {
    if (context.scope === 'app' && context.appMuralVariant) {
      return MURAL_APP_SHARE_HEADERS[context.appMuralVariant];
    }
    return MURAL_SHARE_BRAND;
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

  async buildContextForEventId(eventId: string): Promise<MuralShareContext | null> {
    const id = String(eventId || '').trim();
    if (!id) return null;
    const event = await this.eventService.getById(id);
    if (!event) return { scope: 'event', eventName: '' };
    const pelada = event.peladaId ? await this.peladaService.getById(event.peladaId) : null;
    return this.buildContextForEvent(event, pelada);
  }

  async buildContextForEvent(
    event: PeladaEvent,
    pelada?: { name: string; address?: Address } | null
  ): Promise<MuralShareContext> {
    let ctx = this.contextFromEvent(event, pelada);
    if (event.type !== 'team_match') {
      return { ...ctx, eventKind: 'pelada' };
    }
    ctx = {
      ...ctx,
      eventKind: 'confronto',
      homeTeamName: event.homeTeamName || 'Mandante',
      awayTeamName: event.awayTeamName || 'Visitante',
      homeTeamShieldUrl: event.homeTeamShieldUrl,
      awayTeamShieldUrl: event.awayTeamShieldUrl,
    };
    try {
      const summary = await this.eventService.getTeamMatchMatchdaySummary(event.objectId);
      ctx.homeScore = summary.homeScore;
      ctx.awayScore = summary.awayScore;
      ctx.homeTeamName = summary.homeTeamName || ctx.homeTeamName;
      ctx.awayTeamName = summary.awayTeamName || ctx.awayTeamName;
      ctx.homeTeamShieldUrl = summary.homeTeamShieldUrl || ctx.homeTeamShieldUrl;
      ctx.awayTeamShieldUrl = summary.awayTeamShieldUrl || ctx.awayTeamShieldUrl;
    } catch {
      /* placar opcional */
    }
    return ctx;
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
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await new Promise((resolve) => setTimeout(resolve, 120));
      await this.waitForProTeamShields(element, SHARE_PRO_SHIELD_WAIT_MS);
      const restorePrepared = await this.prepareShareImages(element);
      try {
        await this.waitForShareImagesReady(element, SHARE_IMAGES_READY_MS);
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
      } finally {
        restorePrepared();
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
   * degrada gradualmente e nunca deixa o usuário sem PNG.
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
      console.warn('mural share capture failed, retrying without remote imgs', error);
      try {
        return await toPng(element, {
          ...baseOptions,
          filter: (node) => this.shouldIncludeShareNode(node, true),
        });
      } catch (retryError: unknown) {
        console.warn('mural share capture degraded to data/assets imgs only', retryError);
        return await toPng(element, {
          ...baseOptions,
          filter: (node) => this.shouldIncludeShareNode(node, true),
        });
      }
    }
  }

  /** Escudo do coração alinhado ao avatar md (40px) nos cards showcase. */
  private applyShowcaseAvatarShieldDimensions(img: HTMLImageElement, context: Element): void {
    const entry = context.closest('.showcase-entry');
    if (!entry) {
      img.style.width = img.style.width || '40px';
      img.style.height = img.style.height || '40px';
      return;
    }
    const avatar = entry.querySelector('ion-avatar');
    const rect = avatar?.getBoundingClientRect();
    if (!rect?.width || !rect.height) {
      img.style.width = '40px';
      img.style.height = '40px';
      return;
    }
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
  }

  /** Espera app-team-shield carregar escudo do time do coração antes do share. */
  private async waitForProTeamShields(root: HTMLElement, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const slots = Array.from(root.querySelectorAll('[data-pro-team]'));
      const pending = slots.some((slot) => {
        const host = slot.querySelector('app-team-shield');
        const img = host?.querySelector('img.team-shield') as HTMLImageElement | null;
        if (img) return !img.complete;
        // Ainda só com fallback — share fará inline in-place.
        return !!host?.querySelector('.team-shield-fallback');
      });
      if (!pending) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  /**
   * Mesmo efeito do Craque: troca src do escudo/avatar remoto por data URL PNG
   * antes do toPng — sem sibling inject nem exclude do host.
   */
  private async prepareShareImages(root: HTMLElement): Promise<() => void> {
    const remoteUrls = this.collectRemoteShareImageUrls(root);
    const urlDataMap = await this.fetchShareDataUrlsViaCloud(remoteUrls);

    const restores: Array<() => void> = [];
    for (const img of Array.from(root.querySelectorAll('img'))) {
      if (img.classList.contains('mural-share-exclude')) continue;
      if (img.closest('[data-pro-team]')) continue;
      const src = (img.currentSrc || img.src || '').trim();
      if (!src || this.isSafeShareImageSrc(src)) continue;
      const dataUrl = urlDataMap.get(src);
      if (!dataUrl) continue;
      const raster = await this.rasterizeShareImageDataUrl(dataUrl);
      const previous = img.src;
      img.src = raster;
      this.applyShowcaseAvatarShieldDimensions(img, img);
      restores.push(() => {
        img.src = previous;
        img.style.width = '';
        img.style.height = '';
      });
    }

    const restoreShields = await this.inlineProTeamShieldsInPlace(root, urlDataMap);
    await this.awaitShareShieldDecodes(root);
    return () => {
      restoreShields();
      for (const restore of restores) restore();
    };
  }

  private collectRemoteShareImageUrls(root: HTMLElement): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    const push = (src: string) => {
      if (!src || this.isSafeShareImageSrc(src) || seen.has(src)) return;
      seen.add(src);
      ordered.push(src);
    };

    for (const slot of Array.from(root.querySelectorAll('[data-pro-team]'))) {
      const shieldImg = slot.querySelector(
        'app-team-shield img.team-shield'
      ) as HTMLImageElement | null;
      push((shieldImg?.currentSrc || shieldImg?.src || '').trim());
    }
    for (const img of Array.from(root.querySelectorAll('img'))) {
      push((img.currentSrc || img.src || '').trim());
    }
    return ordered;
  }

  private async fetchShareDataUrlsViaCloud(urls: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(urls.filter((url) => !this.isSafeShareImageSrc(url)))];
    if (!unique.length) {
      return new Map();
    }

    const cacheKey = unique.slice().sort().join('|');
    if (!this.shareBatchDataCache.has(cacheKey)) {
      this.shareBatchDataCache.set(
        cacheKey,
        (async () => {
          try {
            const result = (await Parse.Cloud.run('fetchShareImagesAsDataUrls', {
              urls: unique,
            })) as { dataUrls?: Record<string, string> };
            const map = new Map<string, string>();
            for (const [url, dataUrl] of Object.entries(result?.dataUrls ?? {})) {
              if (url && dataUrl) {
                map.set(url, dataUrl);
              }
            }
            return map;
          } catch {
            return new Map<string, string>();
          }
        })()
      );
    }

    return (await this.shareBatchDataCache.get(cacheKey)) ?? new Map();
  }

  private async resolveTeamShieldShareDataUrl(
    teamName: string,
    preferredUrl?: string
  ): Promise<string | null> {
    const key = `team:${teamName}:${preferredUrl || ''}`;
    if (!this.shareTeamDataCache.has(key)) {
      this.shareTeamDataCache.set(
        key,
        (async () => {
          const preferred = preferredUrl?.trim();
          if (preferred && !this.isSafeShareImageSrc(preferred)) {
            const batch = await this.fetchShareDataUrlsViaCloud([preferred]);
            const fromBatch = batch.get(preferred);
            if (fromBatch) {
              return this.rasterizeShareImageDataUrl(fromBatch);
            }
          }
          try {
            const result = (await Parse.Cloud.run('resolveTeamShieldImageBase64', {
              teamName,
              slug: teamSlug(teamName),
              preferredUrl: preferred || undefined,
            })) as { dataUrl?: string | null };
            if (result?.dataUrl) {
              return this.rasterizeShareImageDataUrl(result.dataUrl);
            }
          } catch {
            // Cloud indisponível
          }
          if (preferred) {
            const local = await this.fetchImageAsDataUrl(preferred).catch(() => null);
            if (local) return this.rasterizeShareImageDataUrl(local);
          }
          for (const url of getTeamShieldCandidates({ name: teamName, slug: teamSlug(teamName) }).slice(
            0,
            2
          )) {
            const local = await this.fetchImageAsDataUrl(url).catch(() => null);
            if (local) return this.rasterizeShareImageDataUrl(local);
          }
          return null;
        })().then((dataUrl) => {
          if (!dataUrl) {
            this.shareTeamDataCache.delete(key);
          }
          return dataUrl;
        })
      );
    }
    return this.shareTeamDataCache.get(key)!;
  }

  private rasterizeShareImageDataUrl(dataUrl: string): Promise<string> {
    const normalized = dataUrl.trim();
    const maxPx = 64;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const naturalW = Math.max(1, img.naturalWidth || maxPx);
          const naturalH = Math.max(1, img.naturalHeight || maxPx);
          const scale = Math.min(1, maxPx / Math.max(naturalW, naturalH));
          const width = Math.max(1, Math.round(naturalW * scale));
          const height = Math.max(1, Math.round(naturalH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(normalized.startsWith('data:image/png') ? normalized : normalized);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(normalized);
        }
      };
      img.onerror = () => resolve(normalized);
      img.src = normalized;
    });
  }

  /**
   * Escudo fora do Angular: img irmão antes de app-team-shield.
   * Resolve sempre por nome do time (Cloud) — evita overwrite do [src] do componente.
   */
  private async inlineProTeamShieldsInPlace(
    root: HTMLElement,
    urlDataMap: Map<string, string>
  ): Promise<() => void> {
    const restores: Array<() => void> = [];
    for (const slot of Array.from(root.querySelectorAll('[data-pro-team]'))) {
      const teamName = slot.getAttribute('data-pro-team')?.trim() || '';
      if (!teamName) continue;
      if (slot.querySelector('img.share-pro-shield-injected')) continue;

      const host = slot.querySelector('app-team-shield') as HTMLElement | null;
      const loaded = host?.querySelector('img.team-shield') as HTMLImageElement | null;
      const preferred = (loaded?.currentSrc || loaded?.src || '').trim();
      const preferredHint =
        preferred && !this.isSafeShareImageSrc(preferred) ? preferred : undefined;

      // Nome do time primeiro (determinístico); batch/URL só como acelerador.
      const dataUrl =
        (await this.resolveTeamShieldShareDataUrl(teamName, preferredHint)) ||
        (preferredHint ? urlDataMap.get(preferredHint) : undefined) ||
        null;
      if (!dataUrl) continue;

      const raster = await this.rasterizeShareImageDataUrl(dataUrl);
      const img = document.createElement('img');
      img.className = 'team-shield team-shield-sm share-pro-shield-injected';
      img.alt = teamName;
      img.src = raster;
      img.width = 40;
      img.height = 40;
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.objectFit = 'contain';
      img.style.flexShrink = '0';
      this.applyShowcaseAvatarShieldDimensions(img, slot);

      const previousVisibility = host?.style.visibility ?? '';
      if (host) {
        host.style.visibility = 'hidden';
        slot.insertBefore(img, host);
      } else {
        slot.insertBefore(img, slot.firstChild);
      }

      restores.push(() => {
        img.remove();
        if (host) {
          host.style.visibility = previousVisibility;
        }
      });
    }
    return () => {
      for (const restore of restores) restore();
    };
  }

  private async awaitShareShieldDecodes(root: HTMLElement): Promise<void> {
    const imgs = Array.from(
      root.querySelectorAll('img.share-pro-shield-injected')
    ) as HTMLImageElement[];
    await Promise.all(
      imgs.map((img) => {
        if (typeof img.decode === 'function') {
          return img.decode().catch(() => undefined);
        }
        return Promise.resolve();
      })
    );
  }

  /** Aguarda imagens prontas para captura (data URL ou carregadas). */
  private async waitForShareImagesReady(root: HTMLElement, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const imgs = Array.from(root.querySelectorAll('img')).filter(
        (img) => !img.classList.contains('mural-share-exclude')
      );
      const pending = imgs.filter((img) => {
        const src = img.currentSrc || img.src || '';
        if (src.startsWith('data:')) return false;
        if (!img.complete) return true;
        return img.naturalWidth === 0;
      });
      if (!pending.length) return;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  private async fetchImageAsDataUrl(url: string): Promise<string> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), SHARE_IMAGE_FETCH_TIMEOUT_MS);
    });
    const work = async (): Promise<string> => {
      if (Capacitor.isNativePlatform()) {
        const xhrBlob = await this.fetchImageBlobViaXhr(url).catch(() => null);
        if (xhrBlob) {
          return await this.blobToDataUrl(xhrBlob);
        }
      }
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      return await this.blobToDataUrl(blob);
    };
    return Promise.race([work(), timeout]);
  }

  private fetchImageBlobViaXhr(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
          resolve(xhr.response as Blob);
          return;
        }
        reject(new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('XHR failed'));
      xhr.send();
    });
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private shouldIncludeShareNode(node: Node, excludeRemoteImages: boolean): boolean {
    if (!(node instanceof HTMLElement)) return true;
    if (node.classList?.contains('mural-share-exclude')) return false;
    if (!excludeRemoteImages) return true;
    if (node.tagName === 'IMG') {
      if (node.classList.contains('share-pro-shield-injected')) return true;
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
  private buildShareMetaTextLines(context: MuralShareContext): string[] {
    if (context.scope === 'app') {
      return [this.appFilterCaption(context)];
    }
    if (context.scope !== 'event') return [];
    const lines: string[] = [];
    if (context.eventName?.trim()) lines.push(context.eventName.trim());
    if (context.eventStartTime) {
      lines.push(this.formatShareDateTime(new Date(context.eventStartTime)));
    }
    if (context.journalistName?.trim()) {
      lines.push(`Jornalista: ${context.journalistName.trim()}`);
    }
    return lines;
  }

  private hasTeamMatchScoreline(context: MuralShareContext): boolean {
    return !!(context.homeTeamName?.trim() && context.awayTeamName?.trim());
  }

  private async composeShareImage(
    cardDataUrl: string,
    context: MuralShareContext
  ): Promise<string> {
    const [logo, card, homeShield, awayShield] = await Promise.all([
      this.loadImage(BRAND_LOGO_PATH).catch(() => null),
      this.loadImage(cardDataUrl),
      context.homeTeamShieldUrl
        ? this.loadImage(context.homeTeamShieldUrl).catch(() => null)
        : Promise.resolve(null),
      context.awayTeamShieldUrl
        ? this.loadImage(context.awayTeamShieldUrl).catch(() => null)
        : Promise.resolve(null),
    ]);

    if (!card.width || !card.height) {
      throw new Error('Card capturado sem dimensoes validas');
    }

    const captionLines = this.buildCaptionLines(context);
    const metaTextLines = this.buildShareMetaTextLines(context);
    const padding = 32;
    const gap = 20;
    const logoSize = 56;
    const brandFontSize = 34;
    const brandPadY = 18;
    const brandRowHeight = Math.max(logoSize, brandFontSize) + brandPadY * 2;
    const captionFontSize = 22;
    const captionLineHeight = 32;
    const metaFontSize = 24;
    const metaLineHeight = 34;
    const scoreRowHeight = this.hasTeamMatchScoreline(context) ? 52 : 0;
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

    measureCtx.font = `600 ${metaFontSize}px Arial, Helvetica, sans-serif`;
    const wrappedMeta = metaTextLines.flatMap((line) =>
      this.wrapText(measureCtx, line, textMaxWidth)
    );
    const metaBlockHeight =
      wrappedMeta.length || scoreRowHeight
        ? wrappedMeta.length * metaLineHeight +
          (wrappedMeta.length && scoreRowHeight ? 8 : 0) +
          scoreRowHeight +
          gap
        : 0;

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
        metaBlockHeight +
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
    ctx.fillText(this.appShareHeader(context), brandX, brandY, canvas.width - brandX - padding);

    let cursorY = brandRowHeight + gap;
    if (metaBlockHeight > 0) {
      ctx.fillStyle = '#f4f8fc';
      ctx.fillRect(0, cursorY - 4, canvas.width, metaBlockHeight + 4);
      let metaY = cursorY + metaFontSize;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = `600 ${metaFontSize}px Arial, Helvetica, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      for (const line of wrappedMeta) {
        ctx.fillText(line, padding, metaY);
        metaY += metaLineHeight;
      }
      if (scoreRowHeight) {
        const scoreY = metaY + (wrappedMeta.length ? 8 : 0);
        this.drawTeamMatchScoreRow(ctx, context, homeShield, awayShield, padding, scoreY, textMaxWidth);
        metaY = scoreY + scoreRowHeight;
      }
      cursorY += metaBlockHeight;
    }

    const cardY = cursorY;
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

  private drawTeamMatchScoreRow(
    ctx: CanvasRenderingContext2D,
    context: MuralShareContext,
    homeShield: HTMLImageElement | null,
    awayShield: HTMLImageElement | null,
    x: number,
    y: number,
    maxWidth: number
  ): void {
    const home = context.homeTeamName?.trim() || 'Mandante';
    const away = context.awayTeamName?.trim() || 'Visitante';
    const hasScores = context.homeScore != null && context.awayScore != null;
    const shieldSize = 36;
    const fontSize = 22;
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = '#0b5cab';

    const parts: Array<{ kind: 'text' | 'shield'; value: string; img?: HTMLImageElement | null }> =
      [
        { kind: 'text', value: home },
        { kind: 'shield', value: home, img: homeShield },
      ];
    if (hasScores) {
      parts.push({ kind: 'text', value: String(context.homeScore) });
    }
    parts.push({ kind: 'text', value: 'X' });
    if (hasScores) {
      parts.push({ kind: 'text', value: String(context.awayScore) });
    }
    parts.push({ kind: 'shield', value: away, img: awayShield });
    parts.push({ kind: 'text', value: away });

    let cursorX = x;
    const baseline = y + fontSize;
    for (const part of parts) {
      if (part.kind === 'shield') {
        if (part.img) {
          ctx.drawImage(part.img, cursorX, y, shieldSize, shieldSize);
          cursorX += shieldSize + 8;
        }
        continue;
      }
      const text = part.value;
      const width = ctx.measureText(text).width;
      if (cursorX + width > x + maxWidth) break;
      ctx.fillText(text, cursorX, baseline);
      cursorX += width + 10;
    }
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

  /** Mesma frase dos cards: Brasil, ou Filtro: Estado / Cidade / Bairro. */
  private appFilterCaption(context: MuralShareContext): string {
    return muralFilterCaption({
      state: context.appFilterState,
      city: context.appFilterCity,
      neighborhood: context.appFilterNeighborhood,
    });
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
