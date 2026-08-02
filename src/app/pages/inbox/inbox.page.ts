import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { hireableRoleLabel, HireableRole } from '../../core/models/event-hiring.model';
import {
  RefereeInvitation,
  SupplementaryHiringOpportunity,
} from '../../core/models/referee-invitation.model';
import { RefereeInvitationService } from '../../core/services/referee-invitation.service';
import { parseErrorMessage } from '../../core/utils/parse-error.util';

@Component({
  selector: 'app-inbox',
  templateUrl: './inbox.page.html',
  styleUrls: ['./inbox.page.scss'],
  standalone: false,
})
export class InboxPage {
  loading = true;
  invitations: RefereeInvitation[] = [];
  paymentConfirmations: RefereeInvitation[] = [];
  supplementaryOpportunities: SupplementaryHiringOpportunity[] = [];
  processingId = '';

  constructor(
    private readonly invitationService: RefereeInvitationService,
    private readonly router: Router,
    private readonly loadingCtrl: LoadingController,
    private readonly alertCtrl: AlertController
  ) {}

  ionViewWillEnter(): void {
    void this.load();
  }

  /** Recarrega convites e atualiza badge da barra superior. */
  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.invitations = await this.invitationService.listPendingForCurrentUser();
      this.paymentConfirmations = await this.invitationService.listAwaitingRefereePaymentConfirmation();
      this.supplementaryOpportunities =
        await this.invitationService.listAcceptedForSupplementaryHiring();
    } finally {
      this.loading = false;
      this.invitationService.notifyBadgeRefresh();
    }
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  }

  invitationRoleLabel(invitation: RefereeInvitation): string {
    return hireableRoleLabel(invitation.role as HireableRole);
  }

  openEvent(invitation: RefereeInvitation): void {
    void this.router.navigate(['/event', invitation.eventId]);
  }

  goBack(): void {
    void this.router.navigateByUrl('/tabs/peladas');
  }

  supplementaryTitle(opportunity: SupplementaryHiringOpportunity): string {
    return opportunity.mode === 'flags' ? 'Contratar bandeiras' : 'Contratar auxiliares scout';
  }

  openSupplementaryHiring(opportunity: SupplementaryHiringOpportunity): void {
    void this.router.navigate(['/event', opportunity.eventId, 'supplementary-hiring'], {
      queryParams: { mode: opportunity.mode },
    });
  }

  async skipSupplementaryHiring(opportunity: SupplementaryHiringOpportunity): Promise<void> {
    this.processingId = opportunity.invitationId;
    try {
      await this.invitationService.completeSupplementaryHiring(opportunity.eventId, opportunity.role);
      await this.load();
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  async accept(invitation: RefereeInvitation): Promise<void> {
    this.processingId = invitation.objectId;
    const loading = await this.loadingCtrl.create({ message: 'Aceitando convite...' });
    await loading.present();

    let accepted: RefereeInvitation;
    try {
      accepted = await this.invitationService.accept(invitation.objectId);
      await this.load();
    } catch (error: unknown) {
      this.processingId = '';
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
      return;
    }

    // Fecha o loading antes do alerta — senao o overlay bloqueia o dialogo (todos os perfis).
    this.processingId = '';
    await loading.dismiss();

    const needsSupplementary = accepted.role === 'referee' || accepted.role === 'scout';
    const buttons = needsSupplementary
      ? [
          {
            text: 'Contratar agora',
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId, 'supplementary-hiring'], {
                queryParams: {
                  mode: accepted.role === 'referee' ? 'flags' : 'assistants',
                },
              });
            },
          },
          {
            text: 'Ir para o evento',
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId]);
            },
          },
          { text: 'Voltar ao inicio', role: 'cancel' as const },
        ]
      : [
          {
            text: 'Ir para o evento',
            handler: () => {
              void this.router.navigate(['/event', accepted.eventId]);
            },
          },
          { text: 'Voltar ao inicio', role: 'cancel' as const },
        ];
    const alert = await this.alertCtrl.create({
      header: 'Convite aceito',
      message: needsSupplementary
        ? 'Voce foi inscrito no evento. Deseja contratar auxiliares agora ou ir para o evento?'
        : 'Voce foi inscrito no evento. O pagamento sera liberado apos o administrador confirmar sua presenca.',
      buttons,
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    const hasRemainingItems =
      this.invitations.length > 0 ||
      this.paymentConfirmations.length > 0 ||
      this.supplementaryOpportunities.length > 0;
    if (!hasRemainingItems && role === 'cancel') {
      void this.router.navigateByUrl('/tabs/peladas');
    }
  }

  async decline(invitation: RefereeInvitation): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Recusar convite',
      message: `Recusar o convite de ${this.formatCurrency(invitation.offeredAmount)} para ${invitation.eventName}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Recusar',
          role: 'destructive',
          handler: () => {
            void this.doDecline(invitation.objectId);
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmPaymentReceived(invitation: RefereeInvitation): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar recebimento',
      message: `Confirmar que voce recebeu ${this.formatCurrency(invitation.offeredAmount)} pelo evento ${invitation.eventName}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: () => {
            void this.doConfirmPaymentReceived(invitation.objectId);
          },
        },
      ],
    });
    await alert.present();
  }

  private async doConfirmPaymentReceived(invitationId: string): Promise<void> {
    this.processingId = invitationId;
    const loading = await this.loadingCtrl.create({ message: 'Confirmando...' });
    await loading.present();

    try {
      await this.invitationService.confirmPaymentReceived(invitationId);
      await this.load();
    } catch (error: unknown) {
      this.processingId = '';
      await loading.dismiss();
      await this.showError(parseErrorMessage(error));
      return;
    }

    this.processingId = '';
    await loading.dismiss();

    const alert = await this.alertCtrl.create({
      header: 'Pagamento confirmado',
      message: 'Recebimento registrado com sucesso.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  private async doDecline(invitationId: string): Promise<void> {
    this.processingId = invitationId;
    try {
      await this.invitationService.decline(invitationId);
      await this.load();
      const hasRemainingItems =
        this.invitations.length > 0 ||
        this.paymentConfirmations.length > 0 ||
        this.supplementaryOpportunities.length > 0;
      if (!hasRemainingItems) {
        void this.router.navigateByUrl('/tabs/peladas');
      }
    } catch (error: unknown) {
      await this.showError(parseErrorMessage(error));
    } finally {
      this.processingId = '';
    }
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({ header: 'Erro', message, buttons: ['OK'] });
    await alert.present();
  }
}
