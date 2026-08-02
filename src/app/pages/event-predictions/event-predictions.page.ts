import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { EventAthleteOption } from '../../core/models/fan-prediction.model';
import { PeladaEvent } from '../../core/models/event.model';
import { EventService } from '../../core/services/event.service';
import { FanPredictionService } from '../../core/services/fan-prediction.service';

@Component({
  selector: 'app-event-predictions',
  templateUrl: './event-predictions.page.html',
  styleUrls: ['./event-predictions.page.scss'],
  standalone: false,
})
export class EventPredictionsPage {
  event: PeladaEvent | null = null;
  athletes: EventAthleteOption[] = [];
  goalkeepers: EventAthleteOption[] = [];
  homeAthletes: EventAthleteOption[] = [];
  awayAthletes: EventAthleteOption[] = [];
  loading = true;
  closed = false;
  isPeladaType = false;
  isTeamMatch = false;

  form = this.fb.group({
    topScorerUserId: ['', Validators.required],
    leastConcededKeeperUserId: [''],
    homeScore: [null as number | null, [Validators.min(0)]],
    awayScore: [null as number | null, [Validators.min(0)]],
    homeTeamName: [''],
    awayTeamName: [''],
    goalScorers: this.fb.array([]),
    expelledUserIds: [[] as string[]],
    yellowCardUserIds: [[] as string[]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly eventService: EventService,
    private readonly fanPredictionService: FanPredictionService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  get goalScorers(): FormArray {
    return this.form.get('goalScorers') as FormArray;
  }

  goalScorerGroupAt(index: number): FormGroup {
    return this.goalScorers.at(index) as FormGroup;
  }

  async ionViewWillEnter(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) {
      await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
      return;
    }

    this.loading = true;
    try {
      const event = await this.eventService.getById(eventId);
      if (!event) {
        await this.showError('Evento nao encontrado.');
        await this.router.navigateByUrl('/tabs/peladas', { replaceUrl: true });
        return;
      }

      this.event = event;
      this.closed = new Date() >= event.startTime;
      this.isPeladaType = event.type === 'pelada' || event.type === 'racha';
      this.isTeamMatch = event.type === 'team_match';
      this.goalScorers.clear();
      this.form.reset({
        topScorerUserId: '',
        leastConcededKeeperUserId: '',
        homeScore: null,
        awayScore: null,
        homeTeamName: '',
        awayTeamName: '',
        expelledUserIds: [],
        yellowCardUserIds: [],
      });

      this.athletes = await this.fanPredictionService.listAthletesForEvent(eventId);
      this.goalkeepers = this.athletes.filter((a) =>
        this.fanPredictionService.isPrimaryGoalkeeperAthlete(a)
      );

      if (this.isTeamMatch) {
        const teams = this.fanPredictionService.splitAthletesByTeam(this.athletes);
        this.homeAthletes = teams.home;
        this.awayAthletes = teams.away;
        this.form.patchValue({
          homeTeamName: event.homeTeamName || 'Time A',
          awayTeamName: event.awayTeamName || 'Time B',
        });
      }

      const existing = await this.fanPredictionService.getForEvent(eventId);
      if (existing) {
        this.form.patchValue({
          topScorerUserId: existing.topScorerUserId ?? '',
          leastConcededKeeperUserId: existing.leastConcededKeeperUserId ?? '',
          homeScore: existing.homeScore ?? null,
          awayScore: existing.awayScore ?? null,
          homeTeamName: existing.homeTeamName ?? this.form.get('homeTeamName')?.value,
          awayTeamName: existing.awayTeamName ?? this.form.get('awayTeamName')?.value,
          expelledUserIds: existing.expelledUserIds ?? [],
          yellowCardUserIds: existing.yellowCardUserIds ?? [],
        });

        for (const scorer of existing.goalScorers ?? []) {
          this.goalScorers.push(this.createGoalScorerGroup(scorer.userId, scorer.goals));
        }
      }
    } finally {
      this.loading = false;
    }
  }

  selectTopScorer(userId: string): void {
    this.form.patchValue({ topScorerUserId: userId });
    this.form.get('topScorerUserId')?.markAsTouched();
  }

  selectKeeper(userId: string): void {
    const current = this.form.get('leastConcededKeeperUserId')?.value;
    this.form.patchValue({
      leastConcededKeeperUserId: current === userId ? '' : userId,
    });
  }

  clearKeeperSelection(): void {
    this.form.patchValue({ leastConcededKeeperUserId: '' });
  }

  selectedTopScorerUserId(): string {
    return String(this.form.get('topScorerUserId')?.value ?? '');
  }

  selectedKeeperUserId(): string {
    return String(this.form.get('leastConcededKeeperUserId')?.value ?? '');
  }

  createGoalScorerGroup(userId = '', goals: number | null = 1) {
    return this.fb.group({
      userId: [userId, Validators.required],
      goals: [goals, [Validators.required, Validators.min(1)]],
    });
  }

  addGoalScorer(): void {
    this.goalScorers.push(this.createGoalScorerGroup());
  }

  removeGoalScorer(index: number): void {
    this.goalScorers.removeAt(index);
  }

  goBack(): void {
    if (this.event) {
      void this.router.navigate(['/event', this.event.objectId]);
    } else {
      void this.router.navigateByUrl('/tabs/peladas');
    }
  }

  async submit(): Promise<void> {
    if (!this.event || this.closed) return;

    if (this.isPeladaType && this.form.get('topScorerUserId')?.invalid) {
      this.form.get('topScorerUserId')?.markAsTouched();
      await this.showError('Selecione o atleta que voce acha que fara mais gols.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Salvando palpites...' });
    await loading.present();

    try {
      const v = this.form.getRawValue();
      const rawScorers = (v.goalScorers ?? []) as Array<{ userId?: string; goals?: number | null }>;
      const goalScorers = rawScorers
        .filter((row) => !!row.userId)
        .map((row) => ({
          userId: row.userId!,
          goals: Number(row.goals ?? 1),
        }));

      await this.fanPredictionService.save({
        eventId: this.event.objectId,
        topScorerUserId: v.topScorerUserId || undefined,
        leastConcededKeeperUserId: v.leastConcededKeeperUserId || undefined,
        homeScore: v.homeScore !== null ? Number(v.homeScore) : undefined,
        awayScore: v.awayScore !== null ? Number(v.awayScore) : undefined,
        homeTeamName: v.homeTeamName || undefined,
        awayTeamName: v.awayTeamName || undefined,
        goalScorers: goalScorers.length ? goalScorers : undefined,
        expelledUserIds: v.expelledUserIds?.length ? v.expelledUserIds : undefined,
        yellowCardUserIds: v.yellowCardUserIds?.length ? v.yellowCardUserIds : undefined,
      });

      const alert = await this.alertCtrl.create({
        header: 'Palpites salvos',
        message: 'Seus palpites foram registrados. Boa sorte!',
        buttons: ['OK'],
      });
      await alert.present();
      this.goBack();
    } catch (error: unknown) {
      await this.showError(error instanceof Error ? error.message : 'Nao foi possivel salvar.');
    } finally {
      await loading.dismiss();
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
