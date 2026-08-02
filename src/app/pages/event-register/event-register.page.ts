import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import Parse from 'parse';
import {
  AthleteProfile,
  partsToHeightCm,
} from '../../core/models/athlete-profile.model';
import { PeladaEvent } from '../../core/models/event.model';
import {
  MembershipType,
  ScheduleConflict,
} from '../../core/models/event-registration.model';
import {
  EVENT_REGISTRATION_ROLES,
  PROFILE_ROLE_LABELS,
  ProfileRole,
} from '../../core/models/profile-role.model';
import { AuthService } from '../../core/services/auth.service';
import { AthleteProfileService } from '../../core/services/athlete-profile.service';
import { EventService } from '../../core/services/event.service';
import { PeladaMembershipService } from '../../core/services/pelada-membership.service';
import { RegistrationService } from '../../core/services/registration.service';
import { UserParticipationProfileService } from '../../core/services/user-participation-profile.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';
import { buildMissingFieldsMessage } from '../../core/utils/form-validation.util';

@Component({
  selector: 'app-event-register',
  templateUrl: './event-register.page.html',
  styleUrls: ['./event-register.page.scss'],
  standalone: false,
})
export class EventRegisterPage {
  eventId = '';
  roles: { value: ProfileRole; label: string }[] = EVENT_REGISTRATION_ROLES
    .filter((value) => value !== 'referee')
    .map((value) => ({
      value,
      label: PROFILE_ROLE_LABELS[value],
    }));
  selectedRole: ProfileRole | null = null;
  athleteProfile: AthleteProfile | null = null;
  showAthleteForm = false;
  showAllRoleOptions = false;
  registeredProfileCount = 0;
  suggestedRole: ProfileRole | null = null;
  membershipType: MembershipType = 'convidado';
  event: PeladaEvent | null = null;
  scheduleConflict: ScheduleConflict | null = null;
  registrationsClosedMessage = '';
  athleteRegistrationFull = false;
  athleteRegistrationFullMessage = '';
  checkingEligibility = true;

  form = this.fb.group({
    apelido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
    role: ['' as ProfileRole | '', Validators.required],
    committed: [false, Validators.requiredTrue],
    primaryPosition: [''],
    secondaryPosition: [''],
    thirdPosition: [''],
    shoeSize: [null as number | null],
    heightMeter: [null as number | null],
    heightCm: [null as number | null],
    weight: [null as number | null],
    peladaRate: [null as number | null],
    teamMatchRate: [null as number | null],
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly eventService: EventService,
    private readonly registrationService: RegistrationService,
    private readonly membershipService: PeladaMembershipService,
    private readonly userParticipationProfileService: UserParticipationProfileService,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  ionViewWillEnter(): void {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    const apelido = this.auth.getApelido();
    if (apelido) {
      this.form.patchValue({ apelido });
    }
    void this.loadAthleteProfile();
    void this.checkEligibility().then(() => this.loadRegisteredProfiles());
  }

  get selectedRoleLabel(): string {
    const role = this.form.get('role')?.value as ProfileRole | '';
    return role ? PROFILE_ROLE_LABELS[role] : '';
  }

  get suggestedRoleLabel(): string {
    return this.suggestedRole ? PROFILE_ROLE_LABELS[this.suggestedRole] : '';
  }

  get membershipTypeLabel(): string {
    return this.registrationService.formatMembershipType(this.membershipType);
  }

  get scheduleConflictMessage(): string {
    if (!this.scheduleConflict) return '';
    return this.registrationService.formatScheduleConflictMessage(this.scheduleConflict);
  }

  get canSubmit(): boolean {
    return !this.checkingEligibility && !this.scheduleConflict && !this.registrationsClosedMessage;
  }

  get pixKeys(): string[] {
    if (!this.event) return [];
    return [this.event.pixKey1, this.event.pixKey2, this.event.pixKey3].filter((key) => !!key?.trim());
  }

  formatParticipationFee(fee: number): string {
    return this.eventService.formatParticipationFee(fee);
  }

  cancel(): void {
    void this.router.navigate(['/event', this.eventId]);
  }

  openConflictingEvent(): void {
    if (!this.scheduleConflict) return;
    void this.router.navigate(['/event', this.scheduleConflict.eventId]);
  }

  async onRoleChange(role: ProfileRole): Promise<void> {
    this.selectedRole = role;
    if (role === 'athlete') {
      await this.loadAthleteProfile();
      this.showAthleteForm = !this.athleteProfile;
      this.updateAthleteValidators(true);
    } else {
      this.showAthleteForm = false;
      this.updateAthleteValidators(false);
    }
  }

  enableAllRoleOptions(): void {
    this.showAllRoleOptions = true;
    this.roles = this.buildRoleOptions(
      EVENT_REGISTRATION_ROLES.filter((value) => value !== 'referee')
    );
  }

  private buildRoleOptions(roles: ProfileRole[]): { value: ProfileRole; label: string }[] {
    return this.filterAvailableRoles(roles).map((value) => ({
      value,
      label: PROFILE_ROLE_LABELS[value],
    }));
  }

  private filterAvailableRoles(roles: ProfileRole[]): ProfileRole[] {
    if (!this.athleteRegistrationFull) return roles;
    return roles.filter((role) => role !== 'athlete');
  }

  private async loadRegisteredProfiles(): Promise<void> {
    const registered = await this.userParticipationProfileService.listRegisteredEventProfiles();
    this.registeredProfileCount = registered.length;

    if (!registered.length) {
      this.roles = this.buildRoleOptions(
        EVENT_REGISTRATION_ROLES.filter((value) => value !== 'referee')
      );
      const primary = this.auth.getPrimaryRole();
      const suggested =
        primary && this.roles.some((item) => item.value === primary)
          ? primary
          : this.roles[0]?.value ?? null;
      this.suggestedRole = suggested;
      if (suggested) {
        this.form.patchValue({ role: suggested });
        await this.onRoleChange(suggested);
      }
      return;
    }

    const registeredRoles = registered.map((item) => item.role);
    this.roles = this.buildRoleOptions(registeredRoles);
    if (!this.roles.length) return;

    const primary = this.auth.getPrimaryRole();
    const suggested =
      primary && this.roles.some((item) => item.value === primary)
        ? primary
        : this.roles[0].value;
    this.suggestedRole = suggested;
    this.form.patchValue({ role: suggested });
    await this.onRoleChange(suggested);
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) {
      if (this.registrationsClosedMessage) {
        await this.showError(this.registrationsClosedMessage);
      } else if (this.scheduleConflict) {
        await this.showError(this.scheduleConflictMessage);
      }
      return;
    }

    const role = this.form.get('role')?.value;
    if (!role) {
      this.form.markAllAsTouched();
      return;
    }

    if (role === 'athlete' && !this.athleteProfile && this.showAthleteForm) {
      const athleteValid = await this.validateAthleteFields();
      if (!athleteValid) return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const message = this.buildRegistrationMissingMessage();
      if (message) await this.showError(message);
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Inscrevendo...' });
    await loading.present();

    try {
      let athleteProfileId = this.athleteProfile?.objectId;

      if (role === 'athlete' && !athleteProfileId) {
        const v = this.form.getRawValue();
        const created = await this.athleteProfileService.create({
          primaryPosition: v.primaryPosition!,
          secondaryPosition: v.secondaryPosition || undefined,
          thirdPosition: v.thirdPosition || undefined,
          shoeSize: Number(v.shoeSize),
          height: partsToHeightCm(Number(v.heightMeter), Number(v.heightCm)),
          weight: Number(v.weight),
          peladaRate: v.peladaRate != null ? Number(v.peladaRate) : undefined,
          teamMatchRate: v.teamMatchRate != null ? Number(v.teamMatchRate) : undefined,
        });
        athleteProfileId = created.objectId;
      }

      const values = this.form.getRawValue();
      const registration = await this.registrationService.register({
        eventId: this.eventId,
        role,
        apelido: values.apelido!.trim(),
        committed: !!values.committed,
        membershipType: this.membershipType,
        athleteProfileId,
      });

      if (registration.profilePresentationStatus === 'pending') {
        await this.showInfo(
          'Solicitacao enviada ao administrador da pelada. Voce sera notificado quando houver decisao.'
        );
      }

      await this.router.navigate(['/event', this.eventId], { replaceUrl: true });
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      await loading.dismiss();
    }
  }

  private async checkEligibility(): Promise<void> {
    this.checkingEligibility = true;
    this.scheduleConflict = null;
    this.registrationsClosedMessage = '';

    try {
      const event = await this.eventService.getById(this.eventId);
      if (!event) return;

      this.event = event;
      await this.loadPeladaMembership(event);

      this.athleteRegistrationFull =
        await this.registrationService.isAthleteRegistrationFullForEvent(event);
      if (this.athleteRegistrationFull) {
        const max = await this.registrationService.resolveMaxAthletesForEvent(event);
        this.athleteRegistrationFullMessage = `Inscricoes de atletas encerradas: limite de ${max} confirmacoes atingido neste evento.`;
      } else {
        this.athleteRegistrationFullMessage = '';
      }

      if (!this.eventService.areRegistrationsOpen(event)) {
        this.registrationsClosedMessage = `As inscricoes estao ${this.eventService
          .registrationStatusLabel(event)
          .toLowerCase()}.`;
        return;
      }

      this.scheduleConflict = await this.registrationService.findScheduleConflict(
        this.eventId,
        event.startTime,
        event.endTime
      );
    } catch {
      this.scheduleConflict = null;
      this.registrationsClosedMessage = '';
    } finally {
      this.checkingEligibility = false;
    }
  }

  private async loadAthleteProfile(): Promise<void> {
    this.athleteProfile = await this.athleteProfileService.getForCurrentUser();
    if (this.selectedRole === 'athlete') {
      this.showAthleteForm = !this.athleteProfile;
    }
  }

  private updateAthleteValidators(required: boolean): void {
    const fields = [
      'primaryPosition',
      'shoeSize',
      'heightMeter',
      'heightCm',
      'weight',
    ];
    for (const name of fields) {
      const control = this.form.get(name);
      if (!control) continue;
      if (required && !this.athleteProfile) {
        control.setValidators(Validators.required);
      } else {
        control.clearValidators();
      }
      control.updateValueAndValidity();
    }
  }

  private async loadPeladaMembership(event: PeladaEvent): Promise<void> {
    const userId = Parse.User.current()?.id;
    if (!event.peladaId) {
      this.membershipType = 'convidado';
      return;
    }

    const isEventAdmin = !!userId && event.adminId === userId;
    const isActiveMember = await this.membershipService.isActiveMember(
      event.peladaId,
      userId || undefined
    );
    this.membershipType = isEventAdmin || isActiveMember ? 'socio' : 'convidado';
  }

  private buildRegistrationMissingMessage(): string {
    const labels: Record<string, string> = {
      apelido: 'Apelido',
      role: 'Perfil no evento',
    };
    let message = buildMissingFieldsMessage(this.form, labels);
    if (this.form.get('committed')?.invalid) {
      message = message
        ? `${message.replace(/\.$/, '')}, Compromisso de participacao.`
        : 'Falta preencher: Compromisso de participacao.';
    }
    return message;
  }

  private async validateAthleteFields(): Promise<boolean> {
    const labels: Record<string, string> = {
      primaryPosition: 'Posicao principal',
      shoeSize: 'Numero do pe',
      heightMeter: 'Altura (metros)',
      heightCm: 'Altura (centimetros)',
      weight: 'Peso',
    };
    const message = buildMissingFieldsMessage(this.form, labels);
    if (message) {
      this.form.markAllAsTouched();
      await this.showError(message);
      return false;
    }
    return true;
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }

  private async showInfo(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Solicitacao enviada', message, buttons: ['OK'] });
    await alert.present();
  }
}
