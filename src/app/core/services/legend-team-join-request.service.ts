import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { RefereeInvitationService } from './referee-invitation.service';

export interface LegendTeamJoinRequestItem {
  objectId: string;
  status: 'pending' | 'accepted' | 'declined' | string;
  legendTeamId: string;
  teamName: string;
  athleteUserId: string;
  athleteApelido: string;
  athleteFullName: string;
  athleteAvatarUrl?: string;
  message: string;
  declineReason: string;
  createdAt?: Date | null;
  respondedAt?: Date | null;
  alreadyOnRoster?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LegendTeamJoinRequestService {
  private readonly changed$ = new Subject<void>();
  readonly onChanged = this.changed$.asObservable();

  constructor(private readonly invitationService: RefereeInvitationService) {}

  async request(legendTeamId: string, message = ''): Promise<LegendTeamJoinRequestItem> {
    const row = await Parse.Cloud.run('requestLegendTeamJoin', {
      legendTeamId,
      message: message.trim(),
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async respond(
    requestId: string,
    decision: 'accepted' | 'declined',
    declineReason = ''
  ): Promise<LegendTeamJoinRequestItem> {
    const row = await Parse.Cloud.run('respondLegendTeamJoin', {
      requestId,
      decision,
      declineReason,
    });
    this.notifyChanged();
    return this.toItem(row);
  }

  async listMine(): Promise<LegendTeamJoinRequestItem[]> {
    const rows = await Parse.Cloud.run('listMyLegendTeamJoinRequests');
    return Array.isArray(rows) ? rows.map((row) => this.toItem(row)) : [];
  }

  private toItem(row: Record<string, unknown>): LegendTeamJoinRequestItem {
    return {
      objectId: String(row['objectId'] || ''),
      status: String(row['status'] || 'pending'),
      legendTeamId: String(row['legendTeamId'] || ''),
      teamName: String(row['teamName'] || ''),
      athleteUserId: String(row['athleteUserId'] || ''),
      athleteApelido: String(row['athleteApelido'] || ''),
      athleteFullName: String(row['athleteFullName'] || ''),
      athleteAvatarUrl: row['athleteAvatarUrl'] ? String(row['athleteAvatarUrl']) : undefined,
      message: String(row['message'] || ''),
      declineReason: String(row['declineReason'] || ''),
      createdAt: row['createdAt'] ? new Date(String(row['createdAt'])) : null,
      respondedAt: row['respondedAt'] ? new Date(String(row['respondedAt'])) : null,
      alreadyOnRoster: !!row['alreadyOnRoster'],
    };
  }

  private notifyChanged(): void {
    this.changed$.next();
    this.invitationService.notifyBadgeRefresh();
  }
}
