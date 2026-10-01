import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { Address } from '../models/address.model';
import { RefereeInvitationService } from './referee-invitation.service';

export interface MatchChallengeItem {
  objectId: string;
  status: 'pending' | 'accepted' | 'declined' | 'scheduled' | string;
  message: string;
  challengeConditions: string;
  returnChallengeConditions?: string;
  hasReturnLeg?: boolean;
  eventId: string;
  returnEventId?: string;
  declineReason: string;
  proposedStartTime?: Date | null;
  proposedEndTime?: Date | null;
  proposedAddress?: Address;
  proposedLocationComplement?: string;
  challengerTeamId: string;
  challengedTeamId: string;
  challengerTeamName: string;
  challengedTeamName: string;
  challengerUserId: string;
  challengedUserId: string;
  createdAt?: Date | null;
  homeTeamId?: string;
  awayTeamId?: string;
}

export interface CreateMatchChallengePayload {
  challengedTeamId: string;
  challengerTeamId: string;
  message?: string;
  challengeConditions?: string;
  hasReturnLeg?: boolean;
  proposedStartTime: Date;
  proposedEndTime: Date;
  proposedAddress: Address;
  proposedLocationComplement?: string;
}

@Injectable({ providedIn: 'root' })
export class MatchChallengeService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(private readonly invitationService: RefereeInvitationService) {}

  async create(payload: CreateMatchChallengePayload): Promise<MatchChallengeItem> {
    const row = await Parse.Cloud.run('createMatchChallenge', {
      challengedTeamId: payload.challengedTeamId,
      challengerTeamId: payload.challengerTeamId,
      message: (payload.message || '').trim(),
      challengeConditions: (payload.challengeConditions || '').trim(),
      hasReturnLeg: !!payload.hasReturnLeg,
      proposedStartTime: payload.proposedStartTime.toISOString(),
      proposedEndTime: payload.proposedEndTime.toISOString(),
      proposedAddress: payload.proposedAddress,
      proposedLocationComplement: (payload.proposedLocationComplement || '').trim(),
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async respond(
    challengeId: string,
    decision: 'accepted' | 'declined',
    declineReason = '',
    returnChallengeConditions = ''
  ): Promise<MatchChallengeItem> {
    const row = await Parse.Cloud.run('respondMatchChallenge', {
      challengeId,
      decision,
      declineReason,
      returnChallengeConditions: returnChallengeConditions.trim(),
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async countPendingIncomingForCurrentUser(): Promise<number> {
    const user = Parse.User.current();
    if (!user?.id) return 0;
    try {
      const rows = await Parse.Cloud.run('listMyMatchChallenges');
      if (!Array.isArray(rows)) return 0;
      return rows.filter(
        (row) =>
          String(row['status'] || '') === 'pending' &&
          String(row['challengedUserId'] || '') === user.id
      ).length;
    } catch {
      return 0;
    }
  }

  async listMine(): Promise<MatchChallengeItem[]> {
    const rows = await Parse.Cloud.run('listMyMatchChallenges');
    return Array.isArray(rows) ? rows.map((row) => this.toItem(row)) : [];
  }

  async getAccepted(challengeId: string): Promise<MatchChallengeItem> {
    const row = await Parse.Cloud.run('getAcceptedMatchChallenge', { challengeId });
    return this.toItem(row);
  }

  private toItem(row: Record<string, unknown>): MatchChallengeItem {
    const address = (row['proposedAddress'] as Address) || {
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
    };
    return {
      objectId: String(row['objectId'] || ''),
      status: String(row['status'] || 'pending'),
      message: String(row['message'] || ''),
      challengeConditions: String(row['challengeConditions'] || ''),
      returnChallengeConditions: String(row['returnChallengeConditions'] || ''),
      hasReturnLeg: !!row['hasReturnLeg'],
      eventId: String(row['eventId'] || ''),
      returnEventId: row['returnEventId'] ? String(row['returnEventId']) : undefined,
      declineReason: String(row['declineReason'] || ''),
      proposedStartTime: row['proposedStartTime']
        ? new Date(String(row['proposedStartTime']))
        : null,
      proposedEndTime: row['proposedEndTime'] ? new Date(String(row['proposedEndTime'])) : null,
      proposedAddress: address,
      proposedLocationComplement: String(row['proposedLocationComplement'] || ''),
      challengerTeamId: String(row['challengerTeamId'] || ''),
      challengedTeamId: String(row['challengedTeamId'] || ''),
      challengerTeamName: String(row['challengerTeamName'] || ''),
      challengedTeamName: String(row['challengedTeamName'] || ''),
      challengerUserId: String(row['challengerUserId'] || ''),
      challengedUserId: String(row['challengedUserId'] || ''),
      createdAt: row['createdAt'] ? new Date(String(row['createdAt'])) : null,
      homeTeamId: row['homeTeamId'] ? String(row['homeTeamId']) : undefined,
      awayTeamId: row['awayTeamId'] ? String(row['awayTeamId']) : undefined,
    };
  }

  private notifyChanged(): void {
    this.changed$.next();
    this.invitationService.notifyBadgeRefresh();
  }
}
