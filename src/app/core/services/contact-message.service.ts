import { Injectable } from '@angular/core';
import Parse from 'parse';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

export type ContactMessageKind = 'feedback' | 'support';

@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFile: ParseFileService
  ) {
    this.parseService.init();
  }

  async send(payload: {
    kind: ContactMessageKind;
    title: string;
    body: string;
    attachment?: File | null;
  }): Promise<void> {
    let attachmentUrl: string | undefined;
    let attachmentName: string | undefined;

    if (payload.attachment) {
      const stored = await this.parseFile.uploadAttachment(
        payload.attachment,
        `contact-${payload.kind}-${Date.now()}`
      );
      attachmentUrl = this.parseFile.getFileUrl(stored) || undefined;
      attachmentName = payload.attachment.name;
    }

    try {
      await Parse.Cloud.run('sendContactMessage', {
        kind: payload.kind,
        title: payload.title.trim(),
        body: payload.body.trim(),
        attachmentUrl,
        attachmentName,
      });
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }
}
