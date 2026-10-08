import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { getUniformById } from '../../core/data/team-uniforms.data';
import { Address, emptyAddress, isAddressEmpty, normalizeBrazilUf } from '../../core/models/address.model';
import { EventInviteCandidate } from '../../core/models/event-hiring.model';
import { AmateurTeam, AmateurTeamMember } from '../../core/models/team.model';
import { AthleteSearchService } from '../../core/services/athlete-search.service';
import { TeamService } from '../../core/services/team.service';
import { WizardTourService } from '../../core/services/wizard-tour.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';
import { birthDateToIsoString, parseBirthDateIso } from '../../core/utils/birth-date.util';

const MAX_TEAMS = 5;

@Component({
  selector: 'app-team-form',
  templateUrl: './team-form.page.html',
  styleUrls: ['./team-form.page.scss'],
  standalone: false,
})
export class TeamFormPage {
  mode: 'list' | 'form' = 'list';
  myTeams: AmateurTeam[] = [];
  team: AmateurTeam | null = null;
  teamImageFile: File | null = null;
  presidentImageFile: File | null = null;
  shieldImageFile: File | null = null;
  headquartersImageFile: File | null = null;
  teamImagePreview: string | null = null;
  presidentImagePreview: string | null = null;
  shieldImagePreview: string | null = null;
  headquartersImagePreview: string | null = null;
  roster: AmateurTeamMember[] = [];
  athleteQuery = '';
  athleteResults: EventInviteCandidate[] = [];
  athleteSearching = false;
  uniformPickerOpen = false;
  private athleteSearchTimer: ReturnType<typeof setTimeout> | null = null;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    uniformId: ['', Validators.required],
    foundedAt: [''],
    homeVenue: [''],
    homeVenueAddress: [emptyAddress() as Address],
    description: [''],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly teamService: TeamService,
    private readonly athleteSearch: AthleteSearchService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController,
    private readonly wizardTour: WizardTourService
  ) {
    this.form.get('uniformId')?.valueChanges.subscribe((id) => {
      if (id) this.uniformPickerOpen = false;
    });
  }

  get selectedUniform() {
    const id = this.form.get('uniformId')?.value as string;
    return id ? getUniformById(id) : undefined;
  }

  get canCreateMore(): boolean {
    return this.myTeams.length < MAX_TEAMS;
  }

  async ionViewWillEnter(): Promise<void> {
    this.myTeams = await this.teamService.listMine();
    const teamId = this.route.snapshot.queryParamMap.get('teamId')?.trim() || '';
    const createNew = this.route.snapshot.queryParamMap.get('new') === '1';

    if (teamId) {
      await this.openEdit(teamId);
      return;
    }
    if (createNew || this.myTeams.length === 0) {
      this.startCreate();
      return;
    }
    this.mode = 'list';
    this.team = null;
  }

  cancel(): void {
    if (this.mode === 'form' && this.myTeams.length > 0) {
      this.mode = 'list';
      this.team = null;
      this.resetFormState();
      return;
    }
    void this.router.navigateByUrl(this.readReturnUrl());
  }

  startCreate(): void {
    if (!this.canCreateMore && this.myTeams.length > 0) {
      void this.showError(`Voce pode cadastrar no maximo ${MAX_TEAMS} times.`);
      return;
    }
    this.mode = 'form';
    this.team = null;
    this.resetFormState();
  }

  async openEdit(teamId: string): Promise<void> {
    this.mode = 'form';
    this.team = await this.teamService.getOwnedById(teamId);
    if (!this.team) {
      this.mode = 'list';
      await this.showError('Time nao encontrado ou sem permissao.');
      return;
    }
    this.teamImagePreview = this.team.teamImageUrl ?? null;
    this.presidentImagePreview = this.team.presidentImageUrl ?? null;
    this.shieldImagePreview = this.team.shieldImageUrl ?? null;
    this.headquartersImagePreview = this.team.headquartersImageUrl ?? null;
    this.teamImageFile = null;
    this.presidentImageFile = null;
    this.shieldImageFile = null;
    this.headquartersImageFile = null;
    this.form.patchValue({
      name: this.team.name,
      uniformId: this.team.uniformId,
      foundedAt: this.team.foundedAt ? birthDateToIsoString(this.team.foundedAt) : '',
      homeVenue: this.team.homeVenue || '',
      homeVenueAddress: this.team.homeVenueAddress ?? emptyAddress(),
      description: this.team.description || '',
    });
    this.roster = await this.teamService.listRoster(this.team.objectId);
  }

  onTeamImageSelected(file: File): void {
    this.teamImageFile = file;
    this.teamImagePreview = URL.createObjectURL(file);
  }

  onPresidentImageSelected(file: File): void {
    this.presidentImageFile = file;
    this.presidentImagePreview = URL.createObjectURL(file);
  }

  onShieldImageSelected(file: File): void {
    this.shieldImageFile = file;
    this.shieldImagePreview = URL.createObjectURL(file);
  }

  onHeadquartersImageSelected(file: File): void {
    this.headquartersImageFile = file;
    this.headquartersImagePreview = URL.createObjectURL(file);
  }

  onAthleteSearch(value: string): void {
    this.athleteQuery = value;
    if (this.athleteSearchTimer) clearTimeout(this.athleteSearchTimer);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      this.athleteResults = [];
      return;
    }
    this.athleteSearching = true;
    this.athleteSearchTimer = setTimeout(() => {
      void this.searchAthletes(trimmed);
    }, 280);
  }

  async addAthlete(candidate: EventInviteCandidate): Promise<void> {
    if (!this.team) {
      await this.showError('Salve o time antes de montar o elenco.');
      return;
    }
    try {
      const member = await this.teamService.addMember({
        teamId: this.team.objectId,
        athleteUserId: candidate.userId,
      });
      this.roster = [...this.roster, member];
      this.athleteQuery = '';
      this.athleteResults = [];
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    }
  }

  async removeMember(member: AmateurTeamMember): Promise<void> {
    try {
      await this.teamService.removeMember(member.objectId);
      this.roster = this.roster.filter((row) => row.objectId !== member.objectId);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message = buildMissingFieldsMessage(this.form, {
        name: 'Nome do time',
        uniformId: 'Uniforme',
      });
      if (message) await this.showError(message);
      return;
    }

    const values = this.form.getRawValue();
    const foundedAt = parseBirthDateIso(values.foundedAt);
    const venueAddress = values.homeVenueAddress;
    const hasVenueAddress = !isAddressEmpty(venueAddress);
    const homeVenue = hasVenueAddress
      ? this.formatVenueLabel(venueAddress!)
      : values.homeVenue || '';
    const homeVenueAddress = hasVenueAddress ? venueAddress : null;

    if (!this.team && (!this.teamImageFile || !this.presidentImageFile)) {
      await this.showError('Selecione a imagem do time e a imagem do presidente.');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.team ? 'Salvando alteracoes...' : 'Salvando time...',
    });
    await loading.present();

    try {
      if (this.team) {
        await this.teamService.update(this.team.objectId, {
          name: values.name!,
          uniformId: values.uniformId!,
          foundedAt,
          homeVenue,
          homeVenueAddress,
          description: values.description || '',
          teamImage: this.teamImageFile,
          presidentImage: this.presidentImageFile,
          shieldImage: this.shieldImageFile,
          headquartersImage: this.headquartersImageFile,
        });
      } else {
        await this.teamService.create({
          name: values.name!,
          teamImage: this.teamImageFile!,
          presidentImage: this.presidentImageFile!,
          uniformId: values.uniformId!,
          foundedAt,
          homeVenue,
          homeVenueAddress,
          description: values.description || '',
          shieldImage: this.shieldImageFile,
          headquartersImage: this.headquartersImageFile,
        });
        this.wizardTour.completeStepById('team-president-create');
      }
      const returnUrl = this.readReturnUrl();
      if (returnUrl !== '/tabs/profile' && returnUrl !== '/team/form') {
        await this.router.navigateByUrl(returnUrl, { replaceUrl: true });
        return;
      }
      this.myTeams = await this.teamService.listMine();
      this.mode = 'list';
      this.team = null;
      this.resetFormState();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
    }
  }

  private resetFormState(): void {
    this.form.reset({
      name: '',
      uniformId: '',
      foundedAt: '',
      homeVenue: '',
      homeVenueAddress: emptyAddress(),
      description: '',
    });
    this.uniformPickerOpen = false;
    this.teamImageFile = null;
    this.presidentImageFile = null;
    this.shieldImageFile = null;
    this.headquartersImageFile = null;
    this.teamImagePreview = null;
    this.presidentImagePreview = null;
    this.shieldImagePreview = null;
    this.headquartersImagePreview = null;
    this.roster = [];
    this.athleteQuery = '';
    this.athleteResults = [];
  }

  private async searchAthletes(query: string): Promise<void> {
    try {
      const rows = await this.athleteSearch.searchHiringCandidates(query);
      const selected = new Set(this.roster.map((row) => row.userId).filter(Boolean));
      this.athleteResults = rows.filter((row) => !selected.has(row.userId)).slice(0, 12);
    } catch {
      this.athleteResults = [];
    } finally {
      this.athleteSearching = false;
    }
  }

  private formatVenueLabel(address: Address): string {
    const street = address.street?.trim();
    const neighborhood = address.neighborhood?.trim();
    const city = address.city?.trim();
    const uf = normalizeBrazilUf(address.state);
    const cityUf = [city, uf].filter(Boolean).join(' - ');
    return [street, neighborhood, cityUf].filter(Boolean).join(', ');
  }

  private readReturnUrl(): string {
    const raw = this.route.snapshot.queryParamMap.get('returnUrl') || '';
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      return raw;
    }
    return '/tabs/profile';
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
