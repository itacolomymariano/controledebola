import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { emptyAddress } from '../../core/models/address.model';
import {
  LEGEND_TEAM_RELATIONSHIP_OPTIONS,
  LegendAthleteRef,
  LegendAthleteRefKind,
  LegendSuggestion,
  LegendTeamRelationship,
} from '../../core/models/amateur-legend.model';
import { AuthService } from '../../core/services/auth.service';
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
  editId: string | null = null;
  loadingEdit = false;
  imageFile: File | null = null;
  imagePreview: string | null = null;
  relationshipOptions = LEGEND_TEAM_RELATIONSHIP_OPTIONS;
  athleteRefs: LegendAthleteRef[] = [];
  athleteSearch = '';
  athleteSuggestions: LegendSuggestion[] = [];
  athleteRefKind: LegendAthleteRefKind = 'active';
  athletePickerOpen = false;
  loadingAthletes = false;
  presidentUserId: string | null = null;
  presidentLabel = '';
  presidentPickerOpen = false;
  presidentSearch = '';
  presidentSuggestions: LegendSuggestion[] = [];
  loadingPresident = false;
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
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  get isEditMode(): boolean {
    return !!this.editId;
  }

  get filteredAthleteSuggestions(): LegendSuggestion[] {
    if (this.athleteRefKind === 'legend') {
      return this.athleteSuggestions.filter((item) => item.source === 'legend_athlete');
    }
    return this.athleteSuggestions.filter((item) => item.source === 'app_athlete');
  }

  get showCreateLegendAthletePrompt(): boolean {
    return (
      this.athleteRefKind === 'legend' &&
      !!this.athleteSearch.trim() &&
      !this.loadingAthletes &&
      this.filteredAthleteSuggestions.length === 0
    );
  }

  ionViewWillEnter(): void {
    const routeId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (this.router.url.includes('/edit/') && routeId) {
      this.editId = routeId;
      void this.loadForEdit(routeId);
      return;
    }

    this.editId = null;
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
    if (this.editId) {
      void this.router.navigate(['/legends/team', this.editId]);
      return;
    }
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
    this.athleteRefKind = 'active';
    this.athletePickerOpen = true;
    await this.loadAthleteSuggestions('');
  }

  onAthleteRefKindChange(kind: LegendAthleteRefKind): void {
    this.athleteRefKind = kind;
  }

  goCreateLegendAthlete(): void {
    const term = this.athleteSearch.trim();
    if (!term) return;
    void this.router.navigate(['/legends/athlete/new'], {
      queryParams: { name: term, apelido: term },
    });
    this.closeAthletePicker();
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
    const loadingMessage = this.isEditMode ? 'Salvando alterações...' : 'Salvando time lenda...';
    const loading = await this.loadingCtrl.create({ message: loadingMessage });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const payload = {
        name: v.name!.trim(),
        apelido: v.apelido!.trim(),
        imageFile: this.imageFile ?? undefined,
        location: v.location!,
        foundedDate: v.foundedDate || undefined,
        endedDate: v.endedDate || undefined,
        description: v.description?.trim() || undefined,
        relationship: v.relationship as LegendTeamRelationship,
        athleteRefs: this.athleteRefs,
        presidentUserId: this.presidentUserId ?? '',
      };
      if (this.editId) {
        await this.legendService.updateTeam(this.editId, payload);
        void this.router.navigate(['/legends/team', this.editId]);
        return;
      }
      const created = await this.legendService.createTeam(payload);
      finishLegendFormNavigation(this.router, this.route, created.apelido || created.name);
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.saving = false;
      await loading.dismiss();
    }
  }

  private async loadForEdit(id: string): Promise<void> {
    this.loadingEdit = true;
    try {
      const team = await this.legendService.getTeam(id);
      if (!team) {
        await this.showError('Time lenda nao encontrado.');
        void this.router.navigateByUrl('/legends');
        return;
      }
      const userId = this.auth.getCurrentUser()?.id;
      if (!userId || team.registeredByUserId !== userId) {
        await this.showError('Somente quem cadastrou pode editar esta lenda.');
        void this.router.navigate(['/legends/team', id]);
        return;
      }
      this.imagePreview = team.imageUrl ?? null;
      this.athleteRefs = [...(team.athleteRefs ?? [])];
      this.presidentUserId = team.presidentUserId ?? null;
      this.presidentLabel = team.presidentName ?? '';
      this.form.patchValue({
        name: team.name,
        apelido: team.apelido,
        foundedDate: this.toBirthPickerValue(team.foundedDate),
        endedDate: this.toBirthPickerValue(team.endedDate),
        description: team.description || '',
        relationship: team.relationship,
        location: team.location ?? emptyAddress(),
      });
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
      void this.router.navigateByUrl('/legends');
    } finally {
      this.loadingEdit = false;
    }
  }

  private toBirthPickerValue(iso: string | undefined): string {
    if (!iso?.trim()) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  async openPresidentPicker(): Promise<void> {
    this.presidentPickerOpen = true;
    await this.loadPresidentSuggestions('');
  }

  closePresidentPicker(): void {
    this.presidentPickerOpen = false;
  }

  async onPresidentSearch(value: string): Promise<void> {
    this.presidentSearch = value;
    await this.loadPresidentSuggestions(value);
  }

  selectPresident(item: LegendSuggestion): void {
    if (item.source !== 'app_athlete') return;
    this.presidentUserId = item.id;
    this.presidentLabel = item.label;
    this.closePresidentPicker();
  }

  clearPresident(): void {
    this.presidentUserId = null;
    this.presidentLabel = '';
  }

  private async loadAthleteSuggestions(term: string): Promise<void> {
    this.loadingAthletes = true;
    try {
      this.athleteSuggestions = await this.legendService.searchAthleteRefs(term);
    } finally {
      this.loadingAthletes = false;
    }
  }

  private async loadPresidentSuggestions(term: string): Promise<void> {
    this.loadingPresident = true;
    try {
      const rows = await this.legendService.searchAthleteRefs(term);
      this.presidentSuggestions = rows.filter((item) => item.source === 'app_athlete');
    } finally {
      this.loadingPresident = false;
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
