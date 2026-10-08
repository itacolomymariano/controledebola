import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { RefereeInvitationService } from './referee-invitation.service';

export interface AmateurTeamJoinRequestItem {
  objectId: string;
  status: 'pending' | 'accepted' | 'declined' | string;
  teamId: string;
  teamName: string;
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
export class AmateurTeamJoinRequestService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(private readonly invitationService: RefereeInvitationService) {}

  async request(teamId: string, message = ''): Promise<AmateurTeamJoinRequestItem> {
    const row = await Parse.Cloud.run('requestAmateurTeamJoin', {
      teamId,
      message: message.trim(),
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async respond(
    requestId: string,
    decision: 'accepted' | 'declined',
    declineReason = ''
  ): Promise<AmateurTeamJoinRequestItem> {
    const row = await Parse.Cloud.run('respondAmateurTeamJoin', {
      requestId,
      decision,
      declineReason,
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async listMine(): Promise<AmateurTeamJoinRequestItem[]> {
    const rows = await Parse.Cloud.run('listMyAmateurTeamJoinRequests');
    return Array.isArray(rows) ? rows.map((row) => this.toItem(row)) : [];
  }

  private toItem(row: Record<string, unknown>): AmateurTeamJoinRequestItem {
    return {
      objectId: String(row['objectId'] || ''),
      status: String(row['status'] || 'pending'),
      teamId: String(row['teamId'] || ''),
      teamName: String(row['teamName'] || ''),
      athleteUserId: String(row['athleteUserId'] || ''),
      athleteApelido: String(row['athleteApelido'] || ''),
      athleteFullName: String(row['athleteFullName'] || ''),
      athleteAvatarUrl: row['athleteAvatarUrl'] ? String(row['athleteAvatarUrl']) : undefined,
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
