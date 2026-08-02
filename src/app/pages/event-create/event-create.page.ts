import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';

import { FormBuilder, Validators } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { AlertController, LoadingController } from '@ionic/angular';

import { Subscription, merge } from 'rxjs';

import { emptyAddress } from '../../core/models/address.model';

import { EventType, hasPixKey } from '../../core/models/event.model';

import { EventService } from '../../core/services/event.service';

import { ParseService } from '../../core/services/parse.service';



@Component({

  selector: 'app-event-create',

  templateUrl: './event-create.page.html',

  styleUrls: ['./event-create.page.scss'],

  standalone: false,

})

export class EventCreatePage implements OnInit, OnDestroy {

  peladaId = '';

  eventTypes: { value: EventType; label: string }[] = [

    { value: 'pelada', label: 'Pelada' },

    { value: 'racha', label: 'Racha' },

    { value: 'team_match', label: 'Jogo entre equipes' },

  ];



  form = this.fb.group({

    name: ['', Validators.required],

    type: ['pelada' as EventType, Validators.required],

    startDate: ['', Validators.required],

    startTime: ['', Validators.required],

    endDate: ['', Validators.required],

    endTime: ['', Validators.required],

    address: [emptyAddress()],

    locationComplement: [''],

    participationFee: [0, [Validators.required, Validators.min(0)]],

    pixKey1: [''],

    pixKey2: [''],

    pixKey3: [''],

    homeTeamName: [''],

    awayTeamName: [''],

    gateTicketControlEnabled: [false],

  });



  canSubmit = false;

  invalidHint = '';



  private formSub?: Subscription;



  constructor(

    private readonly fb: FormBuilder,

    private readonly eventService: EventService,

    private readonly parseService: ParseService,

    private readonly router: Router,

    private readonly route: ActivatedRoute,

    private readonly loadingCtrl: LoadingController,

    private readonly alertCtrl: AlertController,

    private readonly cdr: ChangeDetectorRef

  ) {}



  ngOnInit(): void {

    this.peladaId = this.route.snapshot.queryParamMap.get('peladaId') ?? '';

    this.formSub = merge(this.form.statusChanges, this.form.valueChanges).subscribe(() => {

      this.refreshSubmitState();

    });

    this.refreshSubmitState();

  }



  ngOnDestroy(): void {

    this.formSub?.unsubscribe();

  }



  onAddressChanged(): void {

    this.form.get('address')?.updateValueAndValidity({ emitEvent: true });

    this.refreshSubmitState();

  }



  onFieldChange(): void {

    this.refreshSubmitState();

  }



  cancel(): void {

    if (this.peladaId) {
      void this.router.navigate(['/pelada', this.peladaId]);
    } else {
      void this.router.navigateByUrl('/tabs/peladas');
    }

  }



  async submit(): Promise<void> {

    if (!this.parseService.isConfigured) {

      await this.showError('Configure as chaves do Back4App em src/environments/environment.local.ts');

      return;

    }

    if (!this.peladaId) {

      await this.showError('Selecione uma pelada para criar o evento.');

      return;

    }



    this.form.markAllAsTouched();

    this.refreshSubmitState();



    if (this.form.invalid || this.invalidHint) {

      await this.showError(this.invalidHint || 'Verifique os campos obrigatorios.');

      return;

    }



    const v = this.form.getRawValue();

    const startTime = this.combineDateTime(v.startDate!, v.startTime!);

    const endTime = this.combineDateTime(v.endDate!, v.endTime!);



    if (endTime <= startTime) {

      await this.showError('O horario de termino deve ser apos o inicio.');

      return;

    }

    const fee = Number(v.participationFee ?? 0);
    if (fee <= 0) {
      const confirmed = await this.confirmZeroParticipationFee();
      if (!confirmed) {
        return;
      }
    }

    const loading = await this.loadingCtrl.create({ message: 'Criando evento...' });

    await loading.present();



    try {

      await this.eventService.create({

        peladaId: this.peladaId,

        name: v.name!,

        type: v.type!,

        startTime,

        endTime,

        address: v.address!,

        locationComplement: v.locationComplement?.trim() || undefined,

        participationFee: Number(v.participationFee ?? 0),

        pixKey1: v.pixKey1?.trim() || undefined,

        pixKey2: v.pixKey2?.trim() || undefined,

        pixKey3: v.pixKey3?.trim() || undefined,

        homeTeamName: v.type === 'team_match' ? v.homeTeamName?.trim() || undefined : undefined,

        awayTeamName: v.type === 'team_match' ? v.awayTeamName?.trim() || undefined : undefined,

        gateTicketControlEnabled: !!v.gateTicketControlEnabled,

      });

      await this.router.navigate(['/pelada', this.peladaId], { replaceUrl: true });

    } catch (error: unknown) {

      const message = error instanceof Error ? error.message : 'Nao foi possivel criar o evento.';

      await this.showError(message);

    } finally {

      await loading.dismiss();

    }

  }



  private refreshSubmitState(): void {

    this.invalidHint = this.buildInvalidHint();

    this.canSubmit = this.form.valid && !this.invalidHint;

    this.cdr.markForCheck();

  }



  private buildInvalidHint(): string {

    const missing: string[] = [];

    if (this.form.get('name')?.invalid) missing.push('Nome do evento');

    if (this.form.get('startDate')?.invalid) missing.push('Data de inicio');

    if (this.form.get('startTime')?.invalid) missing.push('Hora de inicio');

    if (this.form.get('endDate')?.invalid) missing.push('Data de termino');

    if (this.form.get('endTime')?.invalid) missing.push('Hora de termino');

    if (this.form.get('address')?.invalid) missing.push('Endereco validado (selecione na lista)');

    if (this.form.get('participationFee')?.invalid) missing.push('Valor da participacao');



    const v = this.form.getRawValue();

    const fee = Number(v.participationFee ?? 0);

    if (fee > 0 && !hasPixKey(v.pixKey1 ?? '', v.pixKey2 ?? '', v.pixKey3 ?? '')) {

      missing.push('Ao menos uma chave PIX');

    }



    if (!missing.length) return '';

    return `Falta preencher: ${missing.join(', ')}.`;

  }



  private combineDateTime(date: string, time: string): Date {

    return new Date(`${date}T${time}`);

  }



  private async showError(message: string): Promise<void> {

    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });

    await alert.present();

  }

  private async confirmZeroParticipationFee(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: 'Valor da participacao zerado',
      message:
        'O valor da participacao esta em R$ 0,00. Deseja criar o evento assim mesmo, sem cobranca de inscricao?',
      buttons: [
        { text: 'Revisar', role: 'cancel' },
        { text: 'Criar assim mesmo', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

}


