import { MuralTargetRole } from './event-performance.model';
import { Address } from './address.model';
import { ProfileRole } from './profile-role.model';
import { PeladaParticipant } from './pelada-participant.model';
import { MuralLocationTopRankings } from './mural-location-top.model';
import { MuralParticipantLocationStats } from './mural-participant-stats.model';

export type MuralScope = 'app' | 'pelada' | 'event';

export interface MuralVote {
  objectId: string;
  scope: MuralScope;
  scopeId?: string;
  voterId: string;
  targetUserId: string;
  targetUserName: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
  createdAt: Date;
  targetAvatarUrl?: string;
}

export interface MuralRankingEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  role: MuralTargetRole;
  totalScore: number;
  voteCount: number;
  averageScore: number;
  performanceScore: number;
  combinedScore: number;
}

export interface CreateMuralVotePayload {
  scope: MuralScope;
  scopeId?: string;
  targetUserId: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
}

export interface EventMuralVoteSummary {
  totalVotes: number;
  voterCount: number;
  totalParticipants: number;
  votePercentage: number;
  voterQuorumMet?: boolean;
  minVoters?: number;
}

export interface EventMuralDashboard {
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
  voteSummary: EventMuralVoteSummary;
  participants?: Array<{
    userId: string;
    userName: string;
    apelido: string;
    fullName?: string;
    roles: ProfileRole[];
    avatarUrl?: string;
    birthDate?: string;
    address?: Address;
    proFootballIdol?: string;
    amateurFootballIdol?: string;
  }>;
  locationStats?: {
    total: number;
    byState: Array<{ label: string; count: number }>;
    byCity: Array<{ label: string; count: number }>;
    byNeighborhood: Array<{ label: string; count: number }>;
  };
  myVotes?: MuralVote[];
  cloudAvailable: boolean;
}

export interface MuralVoteAggregateEntry {
  totalScore: number;
  voteCount: number;
  userName: string;
}

export type MuralVoteAggregates = Record<MuralTargetRole, Record<string, MuralVoteAggregateEntry>>;

export interface CastEventMuralVotePayload {
  eventId: string;
  registrationId: string;
  targetRole: MuralTargetRole;
  score: number;
  period: string;
}

export interface MuralAppPredictionEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalScore: number;
  eventsCount: number;
}

export interface MuralAppDashboard {
  participants: PeladaParticipant[];
  rankings: Record<MuralTargetRole, MuralRankingEntry[]>;
  voteAggregates: MuralVoteAggregates;
  locationStats: MuralParticipantLocationStats;
  locationTopRankings: MuralLocationTopRankings;
  performanceAnalytics: Record<string, unknown> | null;
  predictionRankings: MuralAppPredictionEntry[];
  cloudAvailable: boolean;
}
