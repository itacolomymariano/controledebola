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
import { AuthService } from '../../core/services/auth.service';
import { AmateurLegendService } from '../../core/services/amateur-legend.service';
import {
  cancelLegendFormNavigation,
  consumeLegendFormReturnState,
  finishLegendFormNavigation,
  persistLegendFormReturnState,
} from '../../core/utils/legend-form-navigation.util';
import { collectLegendFormValidationMessages } from '../../core/utils/legend-form-validation.util';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-legend-athlete-form',
  templateUrl: './legend-athlete-form.page.html',
  styleUrls: ['./legend-athlete-form.page.scss'],
  standalone: false,
})
export class LegendAthleteFormPage {
  editId: string | null = null;
  loadingEdit = false;
  imageFile: File | null = null;
  imagePreview: string | null = null;
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
    amateurTeams: [[] as string[]],
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
    this.applyAmateurTeamReturn();
  }

  get amateurTeams(): string[] {
    return this.form.get('amateurTeams')?.value ?? [];
  }

  cancel(): void {
    if (this.editId) {
      void this.router.navigate(['/legends/athlete', this.editId]);
      return;
    }
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
  }

  closeTeamPicker(): void {
    this.teamPickerOpen = false;
  }

  onTeamPicked(name: string): void {
    this.addAmateurTeamName(name);
    this.closeTeamPicker();
  }

  onCreateLegendTeam(term: string): void {
    this.goCreateLegendTeam(term);
  }

  goCreateLegendTeam(term: string): void {
    if (!term.trim()) return;

    const returnUrl = this.router.url;
    persistLegendFormReturnState({
      returnUrl,
      returnField: 'legendAthleteAmateurTeam',
    });

    void this.router.navigate(['/legends/team/new'], {
      queryParams: {
        name: term.trim(),
        apelido: term.trim(),
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
    const loadingMessage = this.isEditMode ? 'Salvando alterações...' : 'Salvando lenda...';
    const loading = await this.loadingCtrl.create({ message: loadingMessage });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const payload = {
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
      };
      if (this.editId) {
        await this.legendService.updateAthlete(this.editId, payload);
        void this.router.navigate(['/legends/athlete', this.editId]);
        return;
      }
      const created = await this.legendService.createAthlete(payload);
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
      const athlete = await this.legendService.getAthlete(id);
      if (!athlete) {
        await this.showError('Atleta lenda nao encontrado.');
        void this.router.navigateByUrl('/legends');
        return;
      }
      const userId = this.auth.getCurrentUser()?.id;
      if (!userId || athlete.registeredByUserId !== userId) {
        await this.showError('Somente quem cadastrou pode editar esta lenda.');
        void this.router.navigate(['/legends/athlete', id]);
        return;
      }
      this.imagePreview = athlete.imageUrl ?? null;
      this.form.patchValue({
        name: athlete.name,
        apelido: athlete.apelido,
        birthDate: this.toBirthPickerValue(athlete.birthDate),
        careerEndYear: athlete.careerEndYear != null ? String(athlete.careerEndYear) : '',
        position: athlete.position || '',
        inMemoriam: athlete.inMemoriam,
        memorialDate: this.toBirthPickerValue(athlete.memorialDate),
        relationship: athlete.relationship,
        address: athlete.address ?? emptyAddress(),
        amateurTeams: athlete.amateurTeams ?? [],
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

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
