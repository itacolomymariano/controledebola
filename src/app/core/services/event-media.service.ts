import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  EventMediaCategory,
  EventMediaComment,
  EventMediaDashboard,
  EventMediaEngagement,
  EventMediaHighlightVideoItem,
  EventMediaJournalItem,
  EventMediaRadioItem,
  EventMediaReactionType,
  EventMediaTopItem,
  EventMediaTopKind,
  EventMediaVoteSummary,
  HIGHLIGHT_VIDEO_MAX_SECONDS,
} from '../models/event-media.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class EventMediaService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async loadDashboard(eventId: string): Promise<EventMediaDashboard> {
    const id = String(eventId || '').trim();
    if (!id) {
      return this.emptyDashboard('');
    }
    try {
      const result = await Parse.Cloud.run('getEventMediaDashboard', { eventId: id });
      return this.mapDashboard(result, true);
    } catch (error: unknown) {
      // Nunca derrubar a tela do mural por falha de preview de midia.
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('getEventMediaDashboard failed', error);
      }
      return this.emptyDashboard(id);
    }
  }

  async publishRadioNarration(
    eventId: string,
    title: string,
    description: string,
    audioUrl: string
  ): Promise<void> {
    await Parse.Cloud.run('publishEventRadioNarration', { eventId, title, description, audioUrl });
  }

  async publishRadioInterview(
    eventId: string,
    title: string,
    description: string,
    audioUrl: string
  ): Promise<void> {
    await Parse.Cloud.run('publishEventRadioInterview', { eventId, title, description, audioUrl });
  }

  async publishJournalReportage(
    eventId: string,
    headline: string,
    photoUrl: string,
    body: string
  ): Promise<void> {
    await Parse.Cloud.run('publishEventJournalReportage', { eventId, headline, photoUrl, body });
  }

  async publishJournalInterview(
    eventId: string,
    headline: string,
    photoUrl: string,
    body: string
  ): Promise<void> {
    await Parse.Cloud.run('publishEventJournalInterview', { eventId, headline, photoUrl, body });
  }

  async publishHighlightVideo(
    eventId: string,
    title: string,
    description: string,
    videoUrl: string,
    durationSec: number
  ): Promise<{ overwritten: boolean }> {
    const result = await Parse.Cloud.run('publishEventHighlightVideo', {
      eventId,
      title,
      description,
      videoUrl,
      durationSec,
    });
    return { overwritten: !!result?.overwritten };
  }

  async castVote(
    eventId: string,
    category: EventMediaCategory,
    score: number
  ): Promise<EventMediaVoteSummary & { myScore: number | null }> {
    const result = await Parse.Cloud.run('castEventMediaVote', { eventId, category, score });
    return {
      voteCount: Number(result?.voteCount) || 0,
      averageScore: Number(result?.averageScore) || 0,
      myScore: result?.myScore == null || result?.myScore === '' ? null : Number(result.myScore),
    };
  }

  async loadEngagement(eventId: string, category: EventMediaCategory): Promise<EventMediaEngagement> {
    const result = await Parse.Cloud.run('getEventMediaEngagement', { eventId, category });
    return this.mapEngagement(result);
  }

  async recordView(eventId: string, category: EventMediaCategory): Promise<{ viewCount: number; counted: boolean }> {
    const result = await Parse.Cloud.run('recordEventMediaView', { eventId, category });
    return {
      viewCount: Number(result?.viewCount) || 0,
      counted: !!result?.counted,
    };
  }

  async setReaction(
    eventId: string,
    category: EventMediaCategory,
    reaction: EventMediaReactionType | null,
    commentId?: string | null
  ): Promise<EventMediaEngagement['reactions']> {
    const result = await Parse.Cloud.run('setEventMediaReaction', {
      eventId,
      category,
      ...(commentId ? { commentId } : {}),
      ...(reaction ? { reaction } : { clear: true }),
    });
    return this.mapReactions(result);
  }

  async addComment(
    eventId: string,
    category: EventMediaCategory,
    text: string,
    parentCommentId?: string | null
  ): Promise<{ comments: EventMediaComment[] }> {
    const result = await Parse.Cloud.run('upsertEventMediaComment', {
      eventId,
      category,
      text,
      ...(parentCommentId ? { parentCommentId } : {}),
    });
    return {
      comments: this.mapComments(result?.comments),
    };
  }

  /** @deprecated Prefer addComment — mantido para compatibilidade. */
  async upsertComment(
    eventId: string,
    category: EventMediaCategory,
    text: string,
    parentCommentId?: string | null
  ): Promise<{ comments: EventMediaComment[]; myComment: EventMediaComment | null }> {
    const result = await this.addComment(eventId, category, text, parentCommentId);
    return { comments: result.comments, myComment: null };
  }

  async getTopMedia(
    kind: EventMediaTopKind,
    scope: 'app' | 'pelada',
    peladaId?: string
  ): Promise<EventMediaTopItem | null> {
    try {
      const result = await Parse.Cloud.run('getTopEventMedia', {
        kind,
        scope,
        ...(peladaId ? { peladaId } : {}),
      });
      return this.mapTopItem(result?.item);
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('getTopEventMedia failed', error);
      }
      return null;
    }
  }

  async uploadAudioBlob(blob: Blob, mimeType: string, prefix: string): Promise<string> {
    const parseFile = await this.parseFileService.uploadAudio(blob, `${prefix}-${Date.now()}`, mimeType);
    const url = this.parseFileService.getFileUrl(parseFile);
    if (!url) {
      throw new Error('Nao foi possivel enviar o audio.');
    }
    return url;
  }

  async uploadImageFile(file: File, prefix: string): Promise<string> {
    const parseFile = await this.parseFileService.uploadImage(file, `${prefix}-${Date.now()}`);
    const url = this.parseFileService.getFileUrl(parseFile);
    if (!url) {
      throw new Error('Nao foi possivel enviar a imagem.');
    }
    return url;
  }

  async uploadVideoFile(file: File, prefix: string): Promise<string> {
    const parseFile = await this.parseFileService.uploadVideo(file, `${prefix}-${Date.now()}`);
    const url = this.parseFileService.getFileUrl(parseFile);
    if (!url) {
      throw new Error('Nao foi possivel enviar o video.');
    }
    return url;
  }

  /** Le a duracao do video no browser/device (segundos). */
  readVideoDurationSec(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error('Nao foi possivel ler a duracao do video.'));
          return;
        }
        if (duration > HIGHLIGHT_VIDEO_MAX_SECONDS + 0.5) {
          reject(new Error('O video deve ter no maximo 5 minutos.'));
          return;
        }
        resolve(Math.round(duration));
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Arquivo de video invalido.'));
      };
      video.src = url;
    });
  }

  formatPublishOverwriteMessage(kind: string): string {
    return `Se ja existir ${kind} no mural, o conteudo anterior sera substituido. Deseja enviar?`;
  }

  errorMessage(error: unknown, fallback: string): string {
    return parseErrorMessage(error) || fallback;
  }

  private emptyDashboard(eventId: string): EventMediaDashboard {
    return {
      eventId,
      radioNarration: null,
      radioInterview: null,
      journalReportage: null,
      journalInterview: null,
      highlightVideo: null,
      myVotes: {},
      cloudAvailable: false,
    };
  }

  private mapDashboard(raw: unknown, cloudAvailable: boolean): EventMediaDashboard {
    if (!raw || typeof raw !== 'object') {
      return this.emptyDashboard('');
    }
    const row = raw as Record<string, unknown>;
    return {
      eventId: String(row['eventId'] || ''),
      radioNarration: this.mapRadioItem(row['radioNarration']),
      radioInterview: this.mapRadioItem(row['radioInterview']),
      journalReportage: this.mapJournalItem(row['journalReportage']),
      journalInterview: this.mapJournalItem(row['journalInterview']),
      highlightVideo: this.mapHighlightVideo(row['highlightVideo']),
      myVotes: (row['myVotes'] as EventMediaDashboard['myVotes']) || {},
      cloudAvailable,
    };
  }

  private mapRadioItem(raw: unknown): EventMediaRadioItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const title = String(row['title'] || '').trim();
    if (!title) return null;
    return {
      title,
      description: String(row['description'] || ''),
      audioUrl: String(row['audioUrl'] || ''),
      viewCount: Number(row['viewCount']) || 0,
      authorId: String(row['authorId'] || ''),
      authorName: String(row['authorName'] || ''),
      authorApelido: String(row['authorApelido'] || ''),
      authorAvatarUrl: row['authorAvatarUrl'] ? String(row['authorAvatarUrl']) : undefined,
      updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
      votes: this.mapVotes(row['votes']),
      myScore: row['myScore'] == null ? null : Number(row['myScore']),
    };
  }

  private mapJournalItem(raw: unknown): EventMediaJournalItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const headline = String(row['headline'] || '').trim();
    if (!headline) return null;
    return {
      headline,
      photoUrl: String(row['photoUrl'] || ''),
      body: String(row['body'] || ''),
      viewCount: Number(row['viewCount']) || 0,
      authorId: String(row['authorId'] || ''),
      authorName: String(row['authorName'] || ''),
      authorApelido: String(row['authorApelido'] || ''),
      authorAvatarUrl: row['authorAvatarUrl'] ? String(row['authorAvatarUrl']) : undefined,
      updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
      votes: this.mapVotes(row['votes']),
      myScore: row['myScore'] == null ? null : Number(row['myScore']),
    };
  }

  private mapHighlightVideo(raw: unknown): EventMediaHighlightVideoItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const title = String(row['title'] || '').trim();
    if (!title) return null;
    return {
      title,
      description: String(row['description'] || ''),
      videoUrl: String(row['videoUrl'] || ''),
      durationSec: Number(row['durationSec']) || 0,
      viewCount: Number(row['viewCount']) || 0,
      authorId: String(row['authorId'] || ''),
      authorName: String(row['authorName'] || ''),
      authorApelido: String(row['authorApelido'] || ''),
      authorAvatarUrl: row['authorAvatarUrl'] ? String(row['authorAvatarUrl']) : undefined,
      updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
    };
  }

  private mapVotes(raw: unknown): EventMediaVoteSummary {
    if (!raw || typeof raw !== 'object') {
      return { voteCount: 0, averageScore: 0 };
    }
    const row = raw as Record<string, unknown>;
    return {
      voteCount: Number(row['voteCount']) || 0,
      averageScore: Number(row['averageScore']) || 0,
    };
  }

  private mapEngagement(raw: unknown): EventMediaEngagement {
    if (!raw || typeof raw !== 'object') {
      return {
        viewCount: 0,
        viewedByMe: false,
        reactions: this.mapReactions(null),
        comments: [],
      };
    }
    const row = raw as Record<string, unknown>;
    return {
      viewCount: Number(row['viewCount']) || 0,
      viewedByMe: !!row['viewedByMe'],
      reactions: this.mapReactions(row['reactions'] ?? row),
      comments: this.mapComments(row['comments']),
    };
  }

  private mapReactions(raw: unknown): EventMediaEngagement['reactions'] {
    const emptyCounts = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };
    if (!raw || typeof raw !== 'object') {
      return { total: 0, counts: emptyCounts, myReaction: null };
    }
    const row = raw as Record<string, unknown>;
    const countsRaw = (row['counts'] as Record<string, number>) || {};
    const counts = { ...emptyCounts };
    for (const key of Object.keys(counts) as EventMediaReactionType[]) {
      counts[key] = Number(countsRaw[key]) || 0;
    }
    const my = row['myReaction'];
    return {
      total: Number(row['total']) || 0,
      counts,
      myReaction: my ? (String(my) as EventMediaReactionType) : null,
    };
  }

  private mapComments(raw: unknown): EventMediaComment[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => this.mapComment(item)).filter((item): item is EventMediaComment => !!item);
  }

  private mapComment(raw: unknown): EventMediaComment | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const text = String(row['text'] || '').trim();
    if (!text) return null;
    const parentRaw = row['parentCommentId'];
    return {
      objectId: String(row['objectId'] || ''),
      userId: String(row['userId'] || ''),
      userName: String(row['userName'] || 'Usuario'),
      text,
      parentCommentId: parentRaw ? String(parentRaw) : null,
      createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
      updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
      reactions: this.mapReactions(row['reactions']),
    };
  }

  private mapTopItem(raw: unknown): EventMediaTopItem | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const title = String(row['title'] || '').trim();
    if (!title) return null;
    return {
      kind: String(row['kind'] || 'video') as EventMediaTopKind,
      category: String(row['category'] || 'highlight_video') as EventMediaCategory,
      eventId: String(row['eventId'] || ''),
      eventName: String(row['eventName'] || ''),
      peladaId: String(row['peladaId'] || ''),
      peladaName: String(row['peladaName'] || ''),
      publicationId: String(row['publicationId'] || ''),
      title,
      description: String(row['description'] || ''),
      mediaUrl: String(row['mediaUrl'] || ''),
      viewCount: Number(row['viewCount']) || 0,
      authorName: String(row['authorName'] || ''),
      authorApelido: String(row['authorApelido'] || ''),
      authorAvatarUrl: row['authorAvatarUrl'] ? String(row['authorAvatarUrl']) : undefined,
      updatedAt: row['updatedAt'] ? String(row['updatedAt']) : undefined,
    };
  }
}
