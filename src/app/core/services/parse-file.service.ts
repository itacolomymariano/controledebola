import { Injectable } from '@angular/core';
import Parse from 'parse';
import { parseErrorMessage } from '../utils/parse-error.util';
import { compressImageForUpload } from '../utils/image-compress.util';
import { ParseService } from './parse.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class ParseFileService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async uploadImage(file: File, fileName: string): Promise<Parse.File> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Selecione um arquivo de imagem.');
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('A imagem deve ter no maximo 5 MB.');
    }

    const optimizedFile = await compressImageForUpload(file);
    const extension = optimizedFile.name.split('.').pop() || 'jpg';
    const parseFile = new Parse.File(`${fileName}.${extension}`, optimizedFile);

    try {
      await parseFile.save();
      return parseFile;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async uploadAudio(blob: Blob, fileName: string, mimeType: string): Promise<Parse.File> {
    if (!blob || blob.size <= 0) {
      throw new Error('Audio invalido.');
    }
    if (blob.size > MAX_AUDIO_BYTES) {
      throw new Error('O audio deve ter no maximo 8 MB.');
    }

    const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm';
    const parseFile = new Parse.File(`${fileName}.${extension}`, blob);

    try {
      await parseFile.save();
      return parseFile;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async uploadVideo(file: File | Blob, fileName: string, mimeType?: string): Promise<Parse.File> {
    if (!file || file.size <= 0) {
      throw new Error('Video invalido.');
    }
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error('O video deve ter no maximo 80 MB.');
    }

    const type = mimeType || (file instanceof File ? file.type : '') || 'video/mp4';
    if (!type.startsWith('video/')) {
      throw new Error('Selecione um arquivo de video.');
    }

    let extension = 'mp4';
    if (type.includes('webm')) extension = 'webm';
    else if (type.includes('quicktime') || type.includes('mov')) extension = 'mov';
    else if (file instanceof File && file.name.includes('.')) {
      extension = file.name.split('.').pop() || extension;
    }

    const parseFile = new Parse.File(`${fileName}.${extension}`, file as File);

    try {
      await parseFile.save();
      return parseFile;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  getFileUrl(file: Parse.File | { url?: string } | string | null | undefined): string | null {
    if (!file) return null;
    if (typeof file === 'string') return file;

    const parseFile = file as Parse.File;
    if (typeof parseFile.url === 'function') {
      return parseFile.url() ?? null;
    }

    const raw = file as { url?: string; _url?: string };
    const plainUrl = raw.url ?? raw._url;
    return typeof plainUrl === 'string' ? plainUrl : null;
  }
}
