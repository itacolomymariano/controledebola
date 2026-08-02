import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import { FOOTBALL_POSITIONS } from '../../core/models/athlete-profile.model';
import {
  BRAZILIAN_PRO_TEAMS,
  BrazilianTeamOption,
} from '../../core/data/brazilian-teams.data';
import {
  LEGEND_ATHLETE_RELATIONSHIP_OPTIONS,
  LegendAthleteRelationship,
} from '../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import {
  cancelLegendFormNavigation,
  finishLegendFormNavigation,
} from '../../core/utils/legend-form-navigation.util';
import { collectLegendFormValidationMessages } from '../../core/utils/legend-form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-legend-pro-athlete-form',
  templateUrl: './legend-pro-athlete-form.page.html',
  styleUrls: ['./legend-pro-athlete-form.page.scss'],
  standalone: false,
})
export class LegendProAthleteFormPage {
  imageFile: File | null = null;
  imagePreview: string | null = null;
  teamSearch = '';
  teamPickerOpen = false;
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
    proTeams: [[] as string[]],
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
  }

  get proTeams(): string[] {
    return this.form.get('proTeams')?.value ?? [];
  }

  get filteredTeamOptions(): BrazilianTeamOption[] {
    const query = this.teamSearch.trim().toLowerCase();
    if (!query) return BRAZILIAN_PRO_TEAMS;
    return BRAZILIAN_PRO_TEAMS.filter((team) => team.name.toLowerCase().includes(query));
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

  openTeamPicker(): void {
    this.teamPickerOpen = true;
    this.teamSearch = '';
  }

  closeTeamPicker(): void {
    this.teamPickerOpen = false;
  }

  selectTeam(team: BrazilianTeamOption): void {
    const teams = [...this.proTeams];
    if (!teams.includes(team.name)) {
      teams.push(team.name);
      this.form.patchValue({ proTeams: teams });
    }
    this.closeTeamPicker();
  }

  removeTeam(index: number): void {
    const teams = [...this.proTeams];
    teams.splice(index, 1);
    this.form.patchValue({ proTeams: teams });
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
      const created = await this.legendService.createProAthlete({
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        imageFile: this.imageFile ?? undefined,
        address: v.address!,
        birthDate: v.birthDate || undefined,
        careerEndYear: v.careerEndYear ? Number(v.careerEndYear) : undefined,
        proTeams: v.proTeams ?? [],
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

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
