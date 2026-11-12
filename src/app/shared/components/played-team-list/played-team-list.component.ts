import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AthletePlayedTeamLink } from '../../../core/models/athlete-played-team.model';
import { AthleteProfileService } from '../../../core/services/athlete-profile.service';
import { I18nService } from '../../../core/services/i18n.service';
import { parseErrorMessage } from '../../../core/utils/parse-error.util';
import {
  navigateToTeamProfile,
  TeamProfileReturnState,
} from '../../../core/utils/team-profile-navigation.util';

@Component({
  selector: 'app-played-team-list',
  templateUrl: './played-team-list.component.html',
  styleUrls: ['./played-team-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class PlayedTeamListComponent {
  @Input() links: AthletePlayedTeamLink[] = [];
  @Input() editable = false;
  @Input() returnUrl = '';

  @Output() readonly linksChange = new EventEmitter<AthletePlayedTeamLink[]>();
  @Output() readonly addRequested = new EventEmitter<void>();

  constructor(
    private readonly router: Router,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly alertCtrl: AlertController,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  trackLink(_index: number, link: AthletePlayedTeamLink): string {
    return link.teamId ? `${link.kind}:${link.teamId}` : `${link.kind}:${link.label}`;
  }

  canViewProfile(link: AthletePlayedTeamLink): boolean {
    return !!link.teamId?.trim();
  }

  viewProfile(link: AthletePlayedTeamLink): void {
    if (!this.canViewProfile(link)) return;
    const returnState: TeamProfileReturnState | undefined = this.returnUrl
      ? { returnUrl: this.returnUrl, returnLabel: this.i18n.t('athleteProfile.backToAthlete') }
      : undefined;
    navigateToTeamProfile(this.router, link, returnState);
  }

  requestAdd(): void {
    this.addRequested.emit();
  }

  async confirmUnlink(link: AthletePlayedTeamLink, index: number): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.i18n.t('athleteProfile.unlinkTeam'),
      message: this.i18n.t('athleteProfile.confirmUnlink', { name: link.label }),
      buttons: [
        { text: this.i18n.t('common.cancel'), role: 'cancel' },
        {
          text: this.i18n.t('athleteProfile.unlinkTeam'),
          role: 'destructive',
          handler: () => void this.unlink(link, index),
        },
      ],
    });
    await alert.present();
  }

  private async unlink(link: AthletePlayedTeamLink, index: number): Promise<void> {
    try {
      if (link.teamId) {
        await this.athleteProfileService.removePlayedTeamLink(link);
      }
      const next = [...this.links];
      next.splice(index, 1);
      this.linksChange.emit(next);
    } catch (error: unknown) {
      const alert = await this.alertCtrl.create({
        header: this.i18n.t('common.error'),
        message: parseErrorMessage(error),
        buttons: [this.i18n.t('common.ok')],
      });
      await alert.present();
    } finally {
      this.cdr.markForCheck();
    }
  }
}
