import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import { FOOTBALL_POSITIONS } from '../../core/models/athlete-profile.model';
import {
  LEGEND_ATHLETE_RELATIONSHIP_OPTIONS,
  LegendAthleteRelationship,
} from '../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import {
  cancelLegendFormNavigation,
  consumeLegendFormReturnState,
  finishLegendFormNavigation,
  persistLegendFormReturnState,
} from '../../core/utils/legend-form-navigation.util';
import { collectLegendFormValidationMessages } from '../../core/utils/legend-form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

interface LegendTeamOption {
  id: string;
  name: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-legend-athlete-form',
  templateUrl: './legend-athlete-form.page.html',
  styleUrls: ['./legend-athlete-form.page.scss'],
  standalone: false,
})
export class LegendAthleteFormPage {
  imageFile: File | null = null;
  imagePreview: string | null = null;
  teamSearch = '';
  teamOptions: LegendTeamOption[] = [];
  teamPickerOpen = false;
  loadingTeams = false;
  saving = false;
  positions = FOOTBALL_POSITIONS;
  relationshipOptions = LEGEND_ATHLETE_RELATIONSHIP_OPTIONS;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    apelido: ['', [Validators.required, Validators.minLength(2)]],
    birthDate: [''],
    careerEndYear: [''],
    position: [''],
    inMemoriam: [false],
    memorialDate: [''],
    relationship: ['admirador', Validators.required],
    address: [emptyAddress()],
    amateurTeams: [[] as string[]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly legendService: AmateurLegendService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  ionViewWillEnter(): void {
    const name = String(this.route.snapshot.queryParamMap.get('name') || '').trim();
    const apelido = String(this.route.snapshot.queryParamMap.get('apelido') || '').trim();
    if (name || apelido) {
      this.form.patchValue({
        name: name || apelido,
        apelido: apelido || name,
      });
    }
    this.applyAmateurTeamReturn();
  }

  get showCreateTeamPrompt(): boolean {
    const term = this.teamSearch.trim();
    return !this.loadingTeams && term.length >= 2 && !this.filteredTeamOptions.length;
  }

  get amateurTeams(): string[] {
    return this.form.get('amateurTeams')?.value ?? [];
  }

  get filteredTeamOptions(): LegendTeamOption[] {
    const query = this.teamSearch.trim().toLowerCase();
    if (!query) return this.teamOptions;
    return this.teamOptions.filter((team) => team.name.toLowerCase().includes(query));
  }

  cancel(): void {
    cancelLegendFormNavigation(this.router, this.route);
  }

  onImageSelected(file: File): void {
    this.imageFile = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  onAddressChanged(): void {
    this.form.get('address')?.updateValueAndValidity({ emitEvent: true });
  }

  async openTeamPicker(): Promise<void> {
    this.teamPickerOpen = true;
    this.teamSearch = '';
    await this.loadTeamOptions();
  }

  closeTeamPicker(): void {
    this.teamPickerOpen = false;
  }

  onTeamSearchChange(): void {
    void this.loadTeamOptions();
  }

  selectTeam(team: LegendTeamOption): void {
    this.addAmateurTeamName(team.name);
    this.closeTeamPicker();
  }

  useTypedTeamName(): void {
    const term = this.teamSearch.trim();
    if (!term) return;
    this.addAmateurTeamName(term);
    this.closeTeamPicker();
  }

  goCreateLegendTeam(): void {
    const term = this.teamSearch.trim();
    if (!term) return;

    const returnUrl = this.router.url;
    persistLegendFormReturnState({
      returnUrl,
      returnField: 'legendAthleteAmateurTeam',
    });

    void this.router.navigate(['/legends/team/new'], {
      queryParams: {
        name: term,
        apelido: term,
        returnUrl,
        returnField: 'legendAthleteAmateurTeam',
      },
    });
    this.closeTeamPicker();
  }

  removeTeam(index: number): void {
    const teams = [...this.amateurTeams];
    teams.splice(index, 1);
    this.form.patchValue({ amateurTeams: teams });
  }

  async submit(): Promise<void> {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const messages = collectLegendFormValidationMessages(this.form, {
        memorialDateEnabled: !!this.form.get('inMemoriam')?.value,
      });
      await this.showError(
        messages.length
          ? messages.join('\n')
          : 'Revise os campos obrigatorios antes de salvar.'
      );
      return;
    }

    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando lenda...' });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const created = await this.legendService.createAthlete({
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        imageFile: this.imageFile ?? undefined,
        address: v.address!,
        birthDate: v.birthDate || undefined,
        careerEndYear: v.careerEndYear ? Number(v.careerEndYear) : undefined,
        amateurTeams: v.amateurTeams ?? [],
        position: v.position || undefined,
        inMemoriam: !!v.inMemoriam,
        memorialDate: v.memorialDate || undefined,
        relationship: v.relationship as LegendAthleteRelationship,
      });
      finishLegendFormNavigation(this.router, this.route, created.apelido || created.name);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  private applyAmateurTeamReturn(): void {
    const state = consumeLegendFormReturnState(this.router.url);
    if (!state?.selectedValue || state.returnField !== 'legendAthleteAmateurTeam') {
      return;
    }
    this.addAmateurTeamName(state.selectedValue);
  }

  private addAmateurTeamName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;

    const teams = [...this.amateurTeams];
    if (!teams.includes(trimmed)) {
      teams.push(trimmed);
      this.form.patchValue({ amateurTeams: teams });
    }
  }

  private async loadTeamOptions(): Promise<void> {
    this.loadingTeams = true;
    try {
      this.teamOptions = await this.legendService.listAmateurTeamsForLegend(
        this.form.get('address')?.value ?? undefined,
        this.teamSearch
      );
    } finally {
      this.loadingTeams = false;
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
