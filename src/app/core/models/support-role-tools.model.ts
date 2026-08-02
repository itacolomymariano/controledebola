export type FanAttendanceMode = 'presential' | 'remote';

export interface FanEventCheckIn {
  objectId: string;
  eventId?: string;
  userId?: string;
  userName: string;
  avatarUrl?: string;
  attendanceMode: FanAttendanceMode;
  message: string;
  checkedInAt?: string;
}

export interface FanHighlightEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  checkIns: number;
  presential: number;
  remote: number;
  engagementScore: number;
}

export interface FanEngagementSummary {
  role: 'fan';
  checkIns: number;
  presentialCheckIns: number;
  remoteCheckIns: number;
  eventsCount: number;
  engagementScore: number;
}

export interface CoachChecklist {
  talkedToTeam: boolean;
  ledWarmup: boolean;
  lineupDefined: boolean;
}

export interface CoachTeamNote {
  teamIndex: number;
  teamName: string;
  formation: string;
  focus: string;
}

export interface CoachSuggestedStarters {
  teamIndex: number;
  userIds: string[];
}

export interface CoachEventBoard {
  objectId: string;
  eventId?: string;
  coachUserId?: string;
  checklist: CoachChecklist;
  teamNotes: CoachTeamNote[];
  suggestedStarters: CoachSuggestedStarters[];
  rotationNotes: string;
  updatedAt?: string;
}

export interface CoachProfileStats {
  role: 'coach';
  eventsCount: number;
  boardsSaved: number;
  checklistCompleteCount: number;
}

export type MasseurPhase = 'pre' | 'halftime' | 'post';
export type MasseurReturnStatus = 'cleared' | 'limited' | 'out';

export interface MasseurTreatment {
  objectId: string;
  eventId?: string;
  masseurUserId?: string;
  athleteUserId?: string;
  athleteName: string;
  phase: MasseurPhase;
  bodyRegion: string;
  treatmentType: string;
  durationMin: number;
  returnStatus: MasseurReturnStatus;
  notes: string;
  createdAt?: string;
}

export interface MasseurProfileStats {
  role: 'masseur';
  eventsCount: number;
  treatmentsCount: number;
  uniqueAthletes: number;
  avgDurationMin: number;
  limitedOrOutCount: number;
}

export type TrainerPlanFocus =
  | 'endurance'
  | 'explosion'
  | 'mobility'
  | 'recovery'
  | 'general';

export interface PhysicalTrainerSession {
  objectId: string;
  eventId?: string;
  trainerUserId?: string;
  planFocus: TrainerPlanFocus;
  planDurationMin: number;
  planNotes: string;
  warmupStartedAt?: string;
  warmupEndedAt?: string;
  cooldownDone: boolean;
  athleteUserIds: string[];
  updatedAt?: string;
}

export interface PhysicalTrainerProfileStats {
  role: 'physical_trainer';
  eventsCount: number;
  sessionsCount: number;
  warmupsCompleted: number;
  athletesCoachedInEvents: number;
  personalAthletesCount: number;
}

export interface EventSupportOpsSnapshot {
  eventId: string;
  coach: {
    hasBoard: boolean;
    checklist: CoachChecklist | null;
  };
  trainer: {
    hasSession: boolean;
    planFocus?: string;
    athleteCount?: number;
    warmupActive?: boolean;
    warmupDone?: boolean;
    cooldownDone?: boolean;
  };
  masseur: {
    treatmentsCount: number;
    alertsCount: number;
    alerts: MasseurTreatment[];
  };
  fan: {
    checkIns: number;
    presential: number;
    remote: number;
  };
}

export type SupportRoleProfileStats =
  | FanEngagementSummary
  | CoachProfileStats
  | MasseurProfileStats
  | PhysicalTrainerProfileStats;

export const MASSEUR_PHASE_LABELS: Record<MasseurPhase, string> = {
  pre: 'Pre-jogo',
  halftime: 'Intervalo',
  post: 'Pos-jogo',
};

export const MASSEUR_RETURN_LABELS: Record<MasseurReturnStatus, string> = {
  cleared: 'Liberado',
  limited: 'Limitado',
  out: 'Fora',
};

export const TRAINER_FOCUS_LABELS: Record<TrainerPlanFocus, string> = {
  endurance: 'Resistencia',
  explosion: 'Explosao',
  mobility: 'Mobilidade',
  recovery: 'Recuperacao',
  general: 'Geral',
};
