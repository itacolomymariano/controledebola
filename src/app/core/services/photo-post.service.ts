import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  PhotoPostItem,
  PhotoPostListResult,
  PhotoPostSubjectKind,
} from '../models/photo-post.model';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class PhotoPostService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async list(
    subjectKind: PhotoPostSubjectKind,
    subjectId: string,
    options?: { limit?: number; includeEventPhotos?: boolean }
  ): Promise<PhotoPostListResult> {
    const id = String(subjectId || '').trim();
    if (!id) {
      return { posts: [], canPost: false, cloudAvailable: false };
    }
    try {
      const result = await Parse.Cloud.run('listPhotoPosts', {
        subjectKind,
        subjectId: id,
        limit: options?.limit ?? 40,
        includeEventPhotos: options?.includeEventPhotos === true,
      });
      return {
        posts: Array.isArray(result?.posts)
          ? result.posts.map((row: Record<string, unknown>) => this.mapPost(row))
          : [],
        canPost: !!result?.canPost,
        cloudAvailable: true,
      };
    } catch (error: unknown) {
      if (!isInvalidCloudFunctionError(error)) {
        console.warn('listPhotoPosts failed', error);
      }
      return { posts: [], canPost: false, cloudAvailable: false };
    }
  }

  async publish(
    subjectKind: PhotoPostSubjectKind,
    subjectId: string,
    file: File,
    caption?: string,
    eventId?: string
  ): Promise<PhotoPostItem> {
    const parseFile = await this.parseFileService.uploadImage(
      file,
      `photo-post-${subjectKind}-${Date.now()}`
    );
    const imageUrl = this.parseFileService.getFileUrl(parseFile);
    if (!imageUrl) {
      throw new Error('Nao foi possivel obter a URL da foto.');
    }
    const params: Record<string, unknown> = {
      subjectKind,
      subjectId: String(subjectId || '').trim(),
      imageUrl,
      caption: String(caption || '').trim(),
    };
    if (eventId?.trim()) {
      params['eventId'] = eventId.trim();
    }
    const result = await Parse.Cloud.run('createPhotoPost', params);
    if (!result?.post) {
      throw new Error(parseErrorMessage(new Error('Resposta invalida ao publicar foto.')));
    }
    return this.mapPost(result.post as Record<string, unknown>);
  }

  async remove(postId: string): Promise<void> {
    await Parse.Cloud.run('deletePhotoPost', { postId: String(postId || '').trim() });
  }

  private mapPost(row: Record<string, unknown>): PhotoPostItem {
    return {
      objectId: String(row['objectId'] || ''),
      subjectKind: String(row['subjectKind'] || 'event') as PhotoPostSubjectKind,
      subjectId: String(row['subjectId'] || ''),
      eventId: row['eventId'] ? String(row['eventId']) : undefined,
      imageUrl: String(row['imageUrl'] || ''),
      caption: String(row['caption'] || ''),
      authorId: String(row['authorId'] || ''),
      authorName: String(row['authorName'] || ''),
      authorAvatarUrl: row['authorAvatarUrl'] ? String(row['authorAvatarUrl']) : undefined,
      createdAt: row['createdAt'] ? String(row['createdAt']) : undefined,
    };
  }
}