import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { TeamSide } from '../models/event.model';
import { RefereeInvitationService } from './referee-invitation.service';

export interface TeamMatchJoinRequestItem {
  objectId: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | string;
  teamSide: TeamSide | string;
  teamName: string;
  eventId: string;
  eventName: string;
  eventStartTime?: Date | null;
  athleteUserId: string;
  athleteApelido: string;
  athleteFullName: string;
  athleteAvatarUrl?: string;
  presidentUserId: string;
  presidentApelido: string;
  message: string;
  declineReason: string;
  createdAt?: Date | null;
  respondedAt?: Date | null;
}

@Injectable({ providedIn: 'root' })
export class TeamMatchJoinRequestService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(private readonly invitationService: RefereeInvitationService) {}

  async request(eventId: string, teamSide: TeamSide, message = ''): Promise<TeamMatchJoinRequestItem> {
    const row = await Parse.Cloud.run('requestTeamMatchParticipation', {
      eventId,
      teamSide,
      message: message.trim(),
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async respond(
    requestId: string,
    decision: 'accepted' | 'declined',
    declineReason = ''
  ): Promise<TeamMatchJoinRequestItem> {
    const row = await Parse.Cloud.run('respondTeamMatchParticipation', {
      requestId,
      decision,
      declineReason,
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async listMine(): Promise<TeamMatchJoinRequestItem[]> {
    const rows = await Parse.Cloud.run('listMyTeamMatchJoinRequests');
    return Array.isArray(rows) ? rows.map((row) => this.toItem(row)) : [];
  }

  async countPendingIncomingForCurrentUser(): Promise<number> {
    const user = Parse.User.current();
    if (!user?.id) return 0;
    try {
      const rows = await this.listMine();
      return rows.filter(
        (row) => row.status === 'pending' && row.presidentUserId === user.id
      ).length;
    } catch {
      return 0;
    }
  }

  private toItem(row: Record<string, unknown>): TeamMatchJoinRequestItem {
    return {
      objectId: String(row['objectId'] || ''),
      status: String(row['status'] || 'pending'),
      teamSide: String(row['teamSide'] || ''),
      teamName: String(row['teamName'] || ''),
      eventId: String(row['eventId'] || ''),
      eventName: String(row['eventName'] || 'Confronto'),
      eventStartTime: row['eventStartTime'] ? new Date(String(row['eventStartTime'])) : null,
      athleteUserId: String(row['athleteUserId'] || ''),
      athleteApelido: String(row['athleteApelido'] || ''),
      athleteFullName: String(row['athleteFullName'] || ''),
      athleteAvatarUrl: row['athleteAvatarUrl']
        ? String(row['athleteAvatarUrl'])
        : undefined,
      presidentUserId: String(row['presidentUserId'] || ''),
      presidentApelido: String(row['presidentApelido'] || ''),
      message: String(row['message'] || ''),
      declineReason: String(row['declineReason'] || ''),
      createdAt: row['createdAt'] ? new Date(String(row['createdAt'])) : null,
      respondedAt: row['respondedAt'] ? new Date(String(row['respondedAt'])) : null,
    };
  }

  private notifyChanged(): void {
    this.changed$.next();
    this.invitationService.notifyBadgeRefresh();
  }
}
