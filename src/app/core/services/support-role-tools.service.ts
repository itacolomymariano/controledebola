import { Injectable } from '@angular/core';
import Parse from 'parse';
import { MuralScope } from '../models/mural.model';
import {
  CoachEventBoard,
  CoachProfileStats,
  EventSupportOpsSnapshot,
  FanAttendanceMode,
  FanEngagementSummary,
  FanEventCheckIn,
  FanHighlightEntry,
  MasseurPhase,
  MasseurProfileStats,
  MasseurReturnStatus,
  MasseurTreatment,
  PhysicalTrainerProfileStats,
  PhysicalTrainerSession,
  SupportRoleProfileStats,
  TrainerPlanFocus,
} from '../models/support-role-tools.model';
import { ParseService } from './parse.service';

@Injectable({ providedIn: 'root' })
export class SupportRoleToolsService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async submitFanCheckIn(payload: {
    eventId: string;
    attendanceMode: FanAttendanceMode;
    message?: string;
  }): Promise<FanEventCheckIn> {
    const result = await Parse.Cloud.run('submitFanCheckIn', payload);
    return result as FanEventCheckIn;
  }

  async getMyFanCheckIn(eventId: string): Promise<FanEventCheckIn | null> {
    const result = await Parse.Cloud.run('getMyFanCheckIn', { eventId });
    return (result as FanEventCheckIn) || null;
  }

  async getEventFanCheckIns(eventId: string): Promise<FanEventCheckIn[]> {
    const result = await Parse.Cloud.run('getEventFanCheckIns', { eventId });
    return Array.isArray(result) ? (result as FanEventCheckIn[]) : [];
  }

  async getFanHighlightRankings(
    scope: MuralScope,
    scopeId?: string
  ): Promise<FanHighlightEntry[]> {
    try {
      const result = await Parse.Cloud.run('getFanHighlightRankings', {
        scope,
        scopeId,
        limit: 10,
      });
      return Array.isArray(result) ? (result as FanHighlightEntry[]) : [];
    } catch {
      return [];
    }
  }

  async getCoachEventBoard(eventId: string): Promise<CoachEventBoard | null> {
    const result = await Parse.Cloud.run('getCoachEventBoard', { eventId });
    return (result as CoachEventBoard) || null;
  }

  async saveCoachEventBoard(payload: {
    eventId: string;
    checklist: CoachEventBoard['checklist'];
    teamNotes: CoachEventBoard['teamNotes'];
    suggestedStarters: CoachEventBoard['suggestedStarters'];
    rotationNotes: string;
  }): Promise<CoachEventBoard> {
    const result = await Parse.Cloud.run('saveCoachEventBoard', payload);
    return result as CoachEventBoard;
  }

  async listMasseurTreatments(eventId: string): Promise<MasseurTreatment[]> {
    const result = await Parse.Cloud.run('listMasseurTreatments', { eventId });
    return Array.isArray(result) ? (result as MasseurTreatment[]) : [];
  }

  async upsertMasseurTreatment(payload: {
    eventId: string;
    objectId?: string;
    athleteUserId: string;
    phase: MasseurPhase;
    bodyRegion: string;
    treatmentType: string;
    durationMin: number;
    returnStatus: MasseurReturnStatus;
    notes?: string;
  }): Promise<MasseurTreatment> {
    const result = await Parse.Cloud.run('upsertMasseurTreatment', payload);
    return result as MasseurTreatment;
  }

  async getPhysicalTrainerSession(eventId: string): Promise<PhysicalTrainerSession | null> {
    const result = await Parse.Cloud.run('getPhysicalTrainerSession', { eventId });
    return (result as PhysicalTrainerSession) || null;
  }

  async savePhysicalTrainerSession(payload: {
    eventId: string;
    planFocus: TrainerPlanFocus;
    planDurationMin: number;
    planNotes: string;
    athleteUserIds: string[];
    cooldownDone: boolean;
    warmupStarted?: boolean;
    warmupEnded?: boolean;
    clearWarmup?: boolean;
  }): Promise<PhysicalTrainerSession> {
    const result = await Parse.Cloud.run('savePhysicalTrainerSession', payload);
    return result as PhysicalTrainerSession;
  }

  async getEventSupportOpsSnapshot(eventId: string): Promise<EventSupportOpsSnapshot | null> {
    try {
      const result = await Parse.Cloud.run('getEventSupportOpsSnapshot', { eventId });
      return (result as EventSupportOpsSnapshot) || null;
    } catch {
      return null;
    }
  }

  async getProfileStats(
    role: 'fan' | 'coach' | 'masseur' | 'physical_trainer',
    userId: string
  ): Promise<SupportRoleProfileStats | null> {
    const fn =
      role === 'fan'
        ? 'getFanEngagementSummary'
        : role === 'coach'
          ? 'getCoachProfileStats'
          : role === 'masseur'
            ? 'getMasseurProfileStats'
            : 'getPhysicalTrainerProfileStats';
    try {
      const result = await Parse.Cloud.run(fn, { userId });
      return (result as SupportRoleProfileStats) || null;
    } catch {
      return null;
    }
  }

  asFanStats(stats: SupportRoleProfileStats | null): FanEngagementSummary | null {
    return stats && stats.role === 'fan' ? stats : null;
  }

  asCoachStats(stats: SupportRoleProfileStats | null): CoachProfileStats | null {
    return stats && stats.role === 'coach' ? stats : null;
  }

  asMasseurStats(stats: SupportRoleProfileStats | null): MasseurProfileStats | null {
    return stats && stats.role === 'masseur' ? stats : null;
  }

  asTrainerStats(stats: SupportRoleProfileStats | null): PhysicalTrainerProfileStats | null {
    return stats && stats.role === 'physical_trainer' ? stats : null;
  }
}
