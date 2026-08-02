import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import Parse from 'parse';
import {
  EVENT_MEDIA_REACTION_OPTIONS,
  EventMediaCategory,
  EventMediaComment,
  EventMediaEngagement,
  EventMediaReactionType,
} from '../../../core/models/event-media.model';
import { EventMediaService } from '../../../core/services/event-media.service';
import { commentDisciplineViolation } from '../../../core/utils/comment-discipline.util';

@Component({
  selector: 'app-event-media-engagement',
  templateUrl: './event-media-engagement.component.html',
  styleUrls: ['./event-media-engagement.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class EventMediaEngagementComponent implements OnChanges {
  @Input() eventId = '';
  @Input() category: EventMediaCategory | null = null;
  @Input() autoRecordView = true;

  loading = false;
  saving = false;
  engagement: EventMediaEngagement | null = null;
  commentDraft = '';
  replyingTo: EventMediaComment | null = null;
  reactionOptions = EVENT_MEDIA_REACTION_OPTIONS;

  constructor(
    private readonly eventMediaService: EventMediaService,
    private readonly alertCtrl: AlertController,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] || changes['category']) {
      void this.reload();
    }
  }

  get topLevelComments(): EventMediaComment[] {
    if (!this.engagement) return [];
    return this.engagement.comments.filter((comment) => !comment.parentCommentId);
  }

  repliesFor(commentId: string): EventMediaComment[] {
    if (!this.engagement) return [];
    return this.engagement.comments.filter((comment) => comment.parentCommentId === commentId);
  }

  hasMyReaction(): boolean {
    return !!this.engagement?.reactions?.myReaction;
  }

  hasMyComment(): boolean {
    const userId = Parse.User.current()?.id;
    if (!userId || !this.engagement) return false;
    return this.engagement.comments.some((comment) => comment.userId === userId);
  }

  async reload(): Promise<void> {
    if (!this.eventId || !this.category) {
      this.engagement = null;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      if (this.autoRecordView) {
        const viewResult = await this.eventMediaService.recordView(this.eventId, this.category);
        this.engagement = await this.eventMediaService.loadEngagement(this.eventId, this.category);
        if (this.engagement) {
          this.engagement.viewCount = viewResult.viewCount;
          this.engagement.viewedByMe = true;
        }
      } else {
        this.engagement = await this.eventMediaService.loadEngagement(this.eventId, this.category);
      }
      this.commentDraft = '';
      this.replyingTo = null;
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel carregar interacoes.')
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async selectReaction(reaction: EventMediaReactionType): Promise<void> {
    if (!this.eventId || !this.category || this.saving || !this.engagement) return;
    this.saving = true;
    try {
      const clear = this.engagement.reactions.myReaction === reaction;
      const reactions = await this.eventMediaService.setReaction(
        this.eventId,
        this.category,
        clear ? null : reaction
      );
      this.engagement = { ...this.engagement, reactions };
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel registrar a reacao.')
      );
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  async selectCommentReaction(
    comment: EventMediaComment,
    reaction: EventMediaReactionType
  ): Promise<void> {
    if (!this.eventId || !this.category || this.saving || !this.engagement) return;
    this.saving = true;
    try {
      const clear = comment.reactions?.myReaction === reaction;
      const reactions = await this.eventMediaService.setReaction(
        this.eventId,
        this.category,
        clear ? null : reaction,
        comment.objectId
      );
      this.engagement = {
        ...this.engagement,
        comments: this.engagement.comments.map((row) =>
          row.objectId === comment.objectId ? { ...row, reactions } : row
        ),
      };
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel registrar a reacao.')
      );
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  startReply(comment: EventMediaComment): void {
    this.replyingTo = comment;
    this.cdr.markForCheck();
  }

  cancelReply(): void {
    this.replyingTo = null;
    this.cdr.markForCheck();
  }

  async saveComment(): Promise<void> {
    if (!this.eventId || !this.category || this.saving) return;
    const text = this.commentDraft.trim();
    if (!text) {
      await this.showError('Escreva um comentario breve.');
      return;
    }
    const disciplineError = commentDisciplineViolation(text);
    if (disciplineError) {
      await this.showError(disciplineError);
      return;
    }
    this.saving = true;
    try {
      const result = await this.eventMediaService.addComment(
        this.eventId,
        this.category,
        text,
        this.replyingTo?.objectId || null
      );
      if (this.engagement) {
        this.engagement = {
          ...this.engagement,
          comments: result.comments,
        };
      }
      this.commentDraft = '';
      this.replyingTo = null;
    } catch (error: unknown) {
      await this.showError(
        this.eventMediaService.errorMessage(error, 'Nao foi possivel salvar o comentario.')
      );
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Atencao',
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
