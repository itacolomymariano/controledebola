import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  EventGateEntry,
  EventGateTicket,
  EventGateTicketValidation,
} from '../models/event-gate-ticket.model';
import { PeladaEvent } from '../models/event.model';
import { EventService } from './event.service';
import { ParseService } from './parse.service';
import { isInvalidCloudFunctionError, parseErrorMessage } from '../utils/parse-error.util';

const REGISTRATION_CLASS = 'EventRegistration';
const EVENT_CLASS = 'Event';

@Injectable({ providedIn: 'root' })
export class EventGateTicketService {
  constructor(
    private readonly parseService: ParseService,
    private readonly eventService: EventService
  ) {
    this.parseService.init();
  }

  async getMyTicket(eventId: string): Promise<EventGateTicket | null> {
    try {
      const result = await Parse.Cloud.run('getMyEventGateTicket', { eventId });
      return result ? this.mapTicket(result) : null;
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return this.getMyTicketClient(eventId);
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async issueTicket(eventId: string, registrationId: string): Promise<EventGateTicket> {
    try {
      const result = await Parse.Cloud.run('issueEventGateTicket', { eventId, registrationId });
      return this.mapTicket(result);
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return this.issueTicketClient(eventId, registrationId);
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async cancelTicket(eventId: string, registrationId: string): Promise<EventGateTicket | null> {
    try {
      const result = await Parse.Cloud.run('cancelEventGateTicket', { eventId, registrationId });
      return result ? this.mapTicket(result) : null;
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return this.cancelTicketClient(eventId, registrationId);
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  async validateTicket(eventId: string, qrPayload: string): Promise<EventGateTicketValidation> {
    try {
      const result = await Parse.Cloud.run('validateEventGateTicket', { eventId, qrPayload });
      return {
        valid: !!result?.valid,
        message: String(result?.message || ''),
        participantName: result?.participantName ? String(result.participantName) : undefined,
        participantApelido: result?.participantApelido
          ? String(result.participantApelido)
          : undefined,
        entryAt: result?.entryAt ? String(result.entryAt) : undefined,
        authorizedByAdminName: result?.authorizedByAdminName
          ? String(result.authorizedByAdminName)
          : undefined,
        alreadyEntered: !!result?.alreadyEntered,
      };
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async listEntries(eventId: string): Promise<EventGateEntry[]> {
    try {
      const rows = await Parse.Cloud.run('listEventGateEntries', { eventId });
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => ({
        registrationId: String(row['registrationId'] || ''),
        participantName: String(row['participantName'] || ''),
        participantApelido: String(row['participantApelido'] || ''),
        role: String(row['role'] || ''),
        entryAt: String(row['entryAt'] || ''),
        authorizedByAdminName: String(row['authorizedByAdminName'] || ''),
      }));
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return [];
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private async getMyTicketClient(eventId: string): Promise<EventGateTicket | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const event = await this.eventService.getById(eventId);
    if (!event?.gateTicketControlEnabled) return null;

    const registration = await this.loadRegistration(eventId, user.id!);
    if (!registration || !registration.get('isEffectivelyConfirmed')) {
      return null;
    }

    await this.ensureGateTicketIssued(registration, eventId);
    return this.mapRegistrationToTicket(registration, event);
  }

  private async issueTicketClient(
    eventId: string,
    registrationId: string
  ): Promise<EventGateTicket> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');
    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador do evento pode emitir ingressos.');
    }
    if (!event.gateTicketControlEnabled) {
      throw new Error('Controle de ingresso nao esta ativo neste evento.');
    }

    const registration = await this.loadRegistrationById(eventId, registrationId);
    if (!registration) {
      throw new Error('Inscricao nao encontrada.');
    }
    if (!registration.get('isEffectivelyConfirmed')) {
      throw new Error('Participante ainda nao esta confirmado para receber ingresso.');
    }

    await this.ensureGateTicketIssued(registration, eventId);
    return this.mapRegistrationToTicket(registration, event);
  }

  private async cancelTicketClient(
    eventId: string,
    registrationId: string
  ): Promise<EventGateTicket | null> {
    const event = await this.eventService.getById(eventId);
    if (!event) throw new Error('Evento nao encontrado.');
    if (!this.eventService.isCurrentUserAdmin(event)) {
      throw new Error('Apenas o administrador do evento pode cancelar ingressos.');
    }

    const registration = await this.loadRegistrationById(eventId, registrationId);
    if (!registration) {
      throw new Error('Inscricao nao encontrada.');
    }

    registration.set('gateTicketCancelledAt', new Date());
    registration.unset('gateTicketEntryAt');
    await registration.save();
    return this.mapRegistrationToTicket(registration, event);
  }

  private async loadRegistration(eventId: string, userId: string): Promise<Parse.Object | null> {
    const query = new Parse.Query(REGISTRATION_CLASS);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    query.equalTo('user', Parse.User.createWithoutData(userId));
    const registration = await query.first();
    return registration ?? null;
  }

  private async loadRegistrationById(
    eventId: string,
    registrationId: string
  ): Promise<Parse.Object | null> {
    const query = new Parse.Query(REGISTRATION_CLASS);
    query.equalTo('objectId', registrationId);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    const registration = await query.first();
    return registration ?? null;
  }

  private async ensureGateTicketIssued(
    registration: Parse.Object,
    eventId: string
  ): Promise<void> {
    if (registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt')) {
      return;
    }

    const user = Parse.User.current();
    registration.set('gateTicketToken', this.generateGateTicketToken());
    registration.set('gateTicketIssuedAt', new Date());
    registration.unset('gateTicketCancelledAt');
    registration.unset('gateTicketEntryAt');
    if (user?.id) {
      registration.set('gateTicketAuthorizedByAdminId', user.id);
    }
    await registration.save();
    await registration.fetch();
  }

  private generateGateTicketToken(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }

  private buildQrPayload(eventId: string, registrationId: string, token: string): string {
    return JSON.stringify({ eventId, registrationId, token, v: 1 });
  }

  private formatEventLocation(event: PeladaEvent): string {
    const address = this.eventService.formatAddress(event.address);
    const complement = event.locationComplement?.trim();
    return complement ? `${address} — ${complement}` : address;
  }

  private mapRegistrationToTicket(
    registration: Parse.Object,
    event: PeladaEvent
  ): EventGateTicket {
    const token = String(registration.get('gateTicketToken') || '');
    const cancelledAt = registration.get('gateTicketCancelledAt') as Date | undefined;
    const active = !!token && !cancelledAt;
    const adminId = String(registration.get('gateTicketAuthorizedByAdminId') || '');
    const adminName = 'Administrador';
    const adminAvatarUrl = event.adminAvatarUrl?.trim() || undefined;

    return {
      registrationId: registration.id!,
      eventId: event.objectId,
      participantName:
        String(registration.get('userDisplayName') || '') ||
        String(registration.get('apelido') || '') ||
        String(registration.get('userApelido') || '') ||
        'Participante',
      participantApelido:
        String(registration.get('apelido') || registration.get('userApelido') || ''),
      eventName: event.name || 'Evento',
      eventStartTime: event.startTime.toISOString(),
      eventEndTime: event.endTime.toISOString(),
      authorizedByAdminId: adminId,
      authorizedByAdminName: adminName,
      authorizedByAdminAvatarUrl: adminAvatarUrl,
      qrPayload: active ? this.buildQrPayload(event.objectId, registration.id!, token) : '',
      issuedAt: registration.get('gateTicketIssuedAt')
        ? (registration.get('gateTicketIssuedAt') as Date).toISOString()
        : undefined,
      cancelledAt: cancelledAt ? cancelledAt.toISOString() : undefined,
      entryAt: registration.get('gateTicketEntryAt')
        ? (registration.get('gateTicketEntryAt') as Date).toISOString()
        : undefined,
      active,
      eventLocation: this.formatEventLocation(event),
    };
  }

  private mapTicket(row: Record<string, unknown>): EventGateTicket {
    return {
      registrationId: String(row['registrationId'] || ''),
      eventId: String(row['eventId'] || ''),
      participantName: String(row['participantName'] || ''),
      participantApelido: String(row['participantApelido'] || ''),
      eventName: String(row['eventName'] || ''),
      eventStartTime: String(row['eventStartTime'] || ''),
      eventEndTime: String(row['eventEndTime'] || ''),
      authorizedByAdminId: String(row['authorizedByAdminId'] || ''),
      authorizedByAdminName: String(row['authorizedByAdminName'] || ''),
      authorizedByAdminAvatarUrl: row['authorizedByAdminAvatarUrl']
        ? String(row['authorizedByAdminAvatarUrl'])
        : undefined,
      qrPayload: String(row['qrPayload'] || ''),
      issuedAt: row['issuedAt'] ? String(row['issuedAt']) : undefined,
      cancelledAt: row['cancelledAt'] ? String(row['cancelledAt']) : undefined,
      entryAt: row['entryAt'] ? String(row['entryAt']) : undefined,
      active: !!row['active'],
      eventLocation: row['eventLocation'] ? String(row['eventLocation']) : undefined,
    };
  }
}
