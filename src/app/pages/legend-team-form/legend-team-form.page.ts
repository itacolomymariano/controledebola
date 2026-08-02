import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import {
  LEGEND_TEAM_RELATIONSHIP_OPTIONS,
  LegendAthleteRef,
  LegendSuggestion,
  LegendTeamRelationship,
} from '../../core/models/amateur-legend.model';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import {
  cancelLegendFormNavigation,
  finishLegendFormNavigation,
} from '../../core/utils/legend-form-navigation.util';
import { collectLegendFormValidationMessages } from '../../core/utils/legend-form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-legend-team-form',
  templateUrl: './legend-team-form.page.html',
  styleUrls: ['./legend-team-form.page.scss'],
  standalone: false,
})
export class LegendTeamFormPage {
  imageFile: File | null = null;
  imagePreview: string | null = null;
  relationshipOptions = LEGEND_TEAM_RELATIONSHIP_OPTIONS;
  athleteRefs: LegendAthleteRef[] = [];
  athleteSearch = '';
  athleteSuggestions: LegendSuggestion[] = [];
  athletePickerOpen = false;
  loadingAthletes = false;
  saving = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    apelido: ['', [Validators.required, Validators.minLength(2)]],
    foundedDate: [''],
    endedDate: [''],
    description: [''],
    relationship: ['admirador', Validators.required],
    location: [emptyAddress()],
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

  cancel(): void {
    cancelLegendFormNavigation(this.router, this.route);
  }

  onImageSelected(file: File): void {
    this.imageFile = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  onLocationChanged(): void {
    this.form.get('location')?.updateValueAndValidity({ emitEvent: true });
  }

  async openAthletePicker(): Promise<void> {
    this.athletePickerOpen = true;
    await this.loadAthleteSuggestions('');
  }

  closeAthletePicker(): void {
    this.athletePickerOpen = false;
  }

  async onAthleteSearch(value: string): Promise<void> {
    this.athleteSearch = value;
    await this.loadAthleteSuggestions(value);
  }

  addAthleteRef(item: LegendSuggestion): void {
    const type = item.source === 'legend_athlete' ? 'legend_athlete' : 'app_athlete';
    if (this.athleteRefs.some((ref) => ref.type === type && ref.id === item.id)) {
      return;
    }
    this.athleteRefs = [...this.athleteRefs, { type, id: item.id, label: item.label }];
    this.closeAthletePicker();
  }

  removeAthleteRef(index: number): void {
    const refs = [...this.athleteRefs];
    refs.splice(index, 1);
    this.athleteRefs = refs;
  }

  async submit(): Promise<void> {
    if (this.saving) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const messages = collectLegendFormValidationMessages(this.form);
      await this.showError(
        messages.length
          ? messages.join('\n')
          : 'Revise os campos obrigatorios antes de salvar.'
      );
      return;
    }

    this.saving = true;
    const loading = await this.loadingCtrl.create({ message: 'Salvando time lenda...' });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const created = await this.legendService.createTeam({
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        imageFile: this.imageFile ?? undefined,
        location: v.location!,
        foundedDate: v.foundedDate || undefined,
        endedDate: v.endedDate || undefined,
        description: v.description?.trim() || undefined,
        relationship: v.relationship as LegendTeamRelationship,
        athleteRefs: this.athleteRefs,
      });
      finishLegendFormNavigation(this.router, this.route, created.apelido || created.name);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  private async loadAthleteSuggestions(term: string): Promise<void> {
    this.loadingAthletes = true;
    try {
      this.athleteSuggestions = await this.legendService.searchAthleteRefs(term);
    } finally {
      this.loadingAthletes = false;
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
