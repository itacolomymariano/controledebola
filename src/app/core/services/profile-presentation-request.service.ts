import { Injectable } from '@angular/core';
import Parse from 'parse';
import { ProfilePresentationStatus } from '../models/event-registration.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseService } from './parse.service';

export interface ProfilePresentationRequest {
  registrationId: string;
  eventId: string;
  eventName: string;
  eventStartTime?: Date;
  userId: string;
  userDisplayName: string;
  apelido: string;
  role: string;
  membershipType: string;
  createdAt?: Date;
}

export interface SumulaObservationEntry {
  eventId: string;
  eventName: string;
  peladaName?: string;
  eventDate?: string;
  observation: string;
  yellowCards: number;
  redCards: number;
}

export interface ParticipationReviewProfile {
  userId: string;
  displayName: string;
  apelido?: string;
  fullName?: string;
  avatarUrl?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  age?: number;
  phone?: string;
  email?: string;
  primaryPosition?: string;
  favoriteProTeam?: string;
  goals?: number;
  yellowCards?: number;
  redCards?: number;
  appScore?: number;
  sumulaObservations: SumulaObservationEntry[];
  isAthlete: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProfilePresentationRequestService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async checkProfilePresentationRequired(eventId: string): Promise<boolean> {
    try {
      const result = await Parse.Cloud.run('checkProfilePresentationRequired', { eventId });
      return !!(result as { required?: boolean })?.required;
    } catch {
      return false;
    }
  }

  async listForPelada(peladaId: string): Promise<ProfilePresentationRequest[]> {
    try {
      const rows = await Parse.Cloud.run('listPeladaProfilePresentationRequests', { peladaId });
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => this.toRequest(row));
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async resolve(
    peladaId: string,
    registrationId: string,
    action: 'approve' | 'reject'
  ): Promise<ProfilePresentationStatus> {
    try {
      const result = await Parse.Cloud.run('resolveProfilePresentationRequest', {
        peladaId,
        registrationId,
        action,
      });
      return (result?.status as ProfilePresentationStatus) || (action === 'approve' ? 'approved' : 'rejected');
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async getReviewProfile(peladaId: string, userId: string): Promise<ParticipationReviewProfile | null> {
    try {
      const result = await Parse.Cloud.run('getParticipationReviewProfile', { peladaId, userId });
      if (!result || typeof result !== 'object') return null;
      const row = result as Record<string, unknown>;
      return {
        userId: String(row['userId'] || userId),
        displayName: String(row['displayName'] || 'Participante'),
        apelido: row['apelido'] ? String(row['apelido']) : undefined,
        fullName: row['fullName'] ? String(row['fullName']) : undefined,
        avatarUrl: row['avatarUrl'] ? String(row['avatarUrl']) : undefined,
        state: row['state'] ? String(row['state']) : undefined,
        city: row['city'] ? String(row['city']) : undefined,
        neighborhood: row['neighborhood'] ? String(row['neighborhood']) : undefined,
        age: row['age'] != null ? Number(row['age']) : undefined,
        phone: row['phone'] ? String(row['phone']) : undefined,
        email: row['email'] ? String(row['email']) : undefined,
        primaryPosition: row['primaryPosition'] ? String(row['primaryPosition']) : undefined,
        favoriteProTeam: row['favoriteProTeam'] ? String(row['favoriteProTeam']) : undefined,
        goals: row['goals'] != null ? Number(row['goals']) : undefined,
        yellowCards: row['yellowCards'] != null ? Number(row['yellowCards']) : undefined,
        redCards: row['redCards'] != null ? Number(row['redCards']) : undefined,
        appScore: row['appScore'] != null ? Number(row['appScore']) : undefined,
        isAthlete: !!row['isAthlete'],
        sumulaObservations: Array.isArray(row['sumulaObservations'])
          ? row['sumulaObservations'].map((entry) => ({
              eventId: String(entry.eventId || ''),
              eventName: String(entry.eventName || 'Evento'),
              peladaName: entry.peladaName ? String(entry.peladaName) : undefined,
              eventDate: entry.eventDate ? String(entry.eventDate) : undefined,
              observation: String(entry.observation || ''),
              yellowCards: Number(entry.yellowCards || 0),
              redCards: Number(entry.redCards || 0),
            }))
          : [],
      };
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  private toRequest(row: Record<string, unknown>): ProfilePresentationRequest {
    return {
      registrationId: String(row['registrationId'] || ''),
      eventId: String(row['eventId'] || ''),
      eventName: String(row['eventName'] || 'Evento'),
      eventStartTime: row['eventStartTime'] ? new Date(String(row['eventStartTime'])) : undefined,
      userId: String(row['userId'] || ''),
      userDisplayName: String(row['userDisplayName'] || row['apelido'] || 'Participante'),
      apelido: String(row['apelido'] || ''),
      role: String(row['role'] || 'athlete'),
      membershipType: String(row['membershipType'] || 'convidado'),
      createdAt: row['createdAt'] ? new Date(String(row['createdAt'])) : undefined,
    };
  }
}
