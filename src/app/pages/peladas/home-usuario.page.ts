import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AthletePublicProfile } from '../../core/models/athlete-search.model';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../../core/models/profile-role.model';
import { formatAthleteBodyLabel } from '../../core/models/profile-search.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { AuthService } from '../../core/services/auth.service';
import { HomeDirectoryService, HomeDirectoryUser } from '../../core/services/home-directory.service';
import { I18nService } from '../../core/services/i18n.service';
import { ParseService } from '../../core/services/parse.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { formatPlaceLine } from './home-directory.util';

@Component({
  selector: 'app-home-usuario',
  templateUrl: './home-usuario.page.html',
  styleUrls: ['./home-usuario.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class HomeUsuarioPage implements OnDestroy {
  userId = '';
  user: HomeDirectoryUser | null = null;
  athleteProfile: AthletePublicProfile | null = null;
  athleteLoading = false;
  place = '';
  loading = true;
  errorMessage = '';
  parseConfigured = false;
  readonly roleLabels = PROFILE_ROLE_LABELS;
  private loadSeq = 0;
  private localeSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly parseService: ParseService,
    private readonly directory: HomeDirectoryService,
    private readonly athleteSearch: AthleteSearchService,
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  ionViewWillEnter(): void {
    this.userId = this.route.snapshot.paramMap.get('userId') || '';
    this.parseConfigured = this.parseService.isConfigured;
    void this.load();
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/peladas/usuarios');
  }

  get athleteBodyLabel(): string {
    return formatAthleteBodyLabel(this.athleteProfile?.heightCm, this.athleteProfile?.weightKg);
  }

  get athleteAgeLabel(): string {
    const age = this.athleteProfile?.age;
    if (age == null) return '—';
    return this.i18n.t('peladas.ageYears', { age });
  }

  joinNames(values: string[] | undefined): string {
    return values?.filter((value) => !!value?.trim()).join(', ') || '';
  }

  openProfile(role: ProfileRole): void {
    if (!this.userId) return;
    if (role === 'athlete') {
      void this.router.navigate(['/athlete', this.userId]);
      return;
    }
    void this.router.navigate(['/profile', role, this.userId]);
  }

  retry(): void {
    void this.load();
  }

  async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.load();
    event.target.complete();
  }

  private async load(): Promise<void> {
    const seq = ++this.loadSeq;
    if (!this.parseConfigured) {
      this.loading = false;
      this.errorMessage = 'Configure as chaves do Back4App em environment.local.ts';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const user = await this.directory.getPublicUser(this.userId);
      if (seq !== this.loadSeq) return;
      this.user = user;
      this.place = user ? formatPlaceLine(user.state, user.city, user.neighborhood) : '';
      this.athleteProfile = null;
      if (!user) this.errorMessage = this.i18n.t('peladas.userMissing');
      else if (user.roles.includes('athlete')) void this.loadAthleteProfile(seq);
    } catch (error: unknown) {
      if (seq !== this.loadSeq) return;
      if (await this.auth.handleApiError(error)) {
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        return;
      }
      this.user = null;
      this.athleteProfile = null;
      this.errorMessage = parseErrorMessage(error) || this.i18n.t('peladas.userLoadError');
    } finally {
      if (seq === this.loadSeq) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private async loadAthleteProfile(seq: number): Promise<void> {
    this.athleteLoading = true;
    this.cdr.markForCheck();
    try {
      const profile = await this.athleteSearch.getPublicProfile(this.userId);
      if (seq !== this.loadSeq) return;
      this.athleteProfile = profile;
    } catch {
      if (seq !== this.loadSeq) return;
      this.athleteProfile = null;
    } finally {
      if (seq === this.loadSeq) {
        this.athleteLoading = false;
        this.cdr.markForCheck();
      }
    }
  }
}
