import { LocaleRefreshDirective } from '../../directives/locale-refresh.directive';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { LoadingController, ToastController } from '@ionic/angular';
import { PhotoPostItem, PhotoPostSubjectKind } from '../../../core/models/photo-post.model';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';
import { ImageLightboxService } from '../../../core/services/image-lightbox.service';
import { PhotoPostService } from '../../../core/services/photo-post.service';
import { parseErrorMessage } from '../../../core/utils/parse-error.util';

@Component({
  selector: 'app-photo-gallery',
  templateUrl: './photo-gallery.component.html',
  styleUrls: ['./photo-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [LocaleRefreshDirective],
  standalone: false,
})
export class PhotoGalleryComponent implements OnChanges {
  @Input() subjectKind: PhotoPostSubjectKind = 'event';
  @Input() subjectId = '';
  @Input() includeEventPhotos = false;
  @Input() compact = false;

  posts: PhotoPostItem[] = [];
  canPost = false;
  cloudAvailable = true;
  loading = false;
  captionDraft = '';
  busy = false;

  constructor(
    private readonly photoPostService: PhotoPostService,
    private readonly auth: AuthService,
    private readonly imageLightbox: ImageLightboxService,
    private readonly loadingCtrl: LoadingController,
    private readonly toastCtrl: ToastController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subjectId'] || changes['subjectKind'] || changes['includeEventPhotos']) {
      void this.reload();
    }
  }

  get currentUserId(): string {
    return this.auth.getCurrentUser()?.id || '';
  }

  canDeletePost(post: PhotoPostItem): boolean {
    if (!this.currentUserId) return false;
    if (post.authorId === this.currentUserId) return true;
    return this.canPost;
  }

  async reload(): Promise<void> {
    const id = String(this.subjectId || '').trim();
    if (!id) {
      this.posts = [];
      this.canPost = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const result = await this.photoPostService.list(this.subjectKind, id, {
        includeEventPhotos: this.includeEventPhotos,
      });
      this.posts = result.posts;
      this.canPost = result.canPost;
      this.cloudAvailable = result.cloudAvailable;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  openImage(post: PhotoPostItem): void {
    void this.imageLightbox.open(post.imageUrl, post.authorName || this.i18n.t('photoPost.imageAlt'));
  }

  async onImageSelected(file: File): Promise<void> {
    if (!this.canPost || this.busy) return;
    const loader = await this.loadingCtrl.create({
      message: this.i18n.t('photoPost.publishing'),
    });
    await loader.present();
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const caption = this.captionDraft.trim();
      const post = await this.photoPostService.publish(
        this.subjectKind,
        this.subjectId,
        file,
        caption || undefined
      );
      this.posts = [post, ...this.posts];
      this.captionDraft = '';
      const toast = await this.toastCtrl.create({
        message: this.i18n.t('photoPost.published'),
        duration: 2000,
        color: 'success',
      });
      await toast.present();
    } catch (error: unknown) {
      const toast = await this.toastCtrl.create({
        message: parseErrorMessage(error),
        duration: 3500,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.busy = false;
      await loader.dismiss();
      this.cdr.markForCheck();
    }
  }

  async deletePost(post: PhotoPostItem): Promise<void> {
    if (!this.canDeletePost(post) || this.busy) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      await this.photoPostService.remove(post.objectId);
      this.posts = this.posts.filter((row) => row.objectId !== post.objectId);
    } catch (error: unknown) {
      const toast = await this.toastCtrl.create({
        message: parseErrorMessage(error),
        duration: 3500,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}