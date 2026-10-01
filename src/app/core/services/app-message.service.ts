import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import {
  AppMessage,
  AppMessageBox,
  AppMessageListOptions,
  toAppMessage,
} from '../models/app-message.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class AppMessageService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async list(box: AppMessageBox, options: AppMessageListOptions = {}): Promise<AppMessage[]> {
    try {
      const rows = await Parse.Cloud.run('listAppMessages', {
        box,
        search: (options.search || '').trim(),
        limit: options.limit ?? 50,
        skip: options.skip ?? 0,
      });
      return Array.isArray(rows)
        ? rows.map((row) => toAppMessage(row as Record<string, unknown>, box))
        : [];
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async markRead(messageId: string): Promise<void> {
    if (!messageId) return;
    try {
      await Parse.Cloud.run('markAppMessageRead', { messageId });
      this.changed$.next();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  /** Marca em lote (teto de 200 por chamada no Cloud); `true` se ainda restou algo. */
  async markAllRead(): Promise<boolean> {
    try {
      const result = await Parse.Cloud.run('markAllAppMessagesRead');
      this.changed$.next();
      return !!(result as { hasMore?: boolean })?.hasMore;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  /** Nao lidas da Entrada. Devolve 0 em falha para nao quebrar o badge. */
  async countUnread(): Promise<number> {
    if (!Parse.User.current()) return 0;
    const result = await Parse.Cloud.run('countUnreadAppMessages');
    return Number((result as { count?: number })?.count || 0);
  }

  notifyChanged(): void {
    this.changed$.next();
  }
}
