import { Injectable } from '@angular/core';
import Parse from 'parse';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../models/profile-role.model';
import {
  MuralAgeBand,
  MuralAgeBandWinners,
  MuralBirthdayEntry,
  MuralHighlights,
  MuralShowcaseEntry,
} from '../models/mural-highlights.model';
import { PeladaParticipant } from '../models/pelada-participant.model';
import { MURAL_TARGET_ROLES, MuralTargetRole } from '../models/event-performance.model';
import { MuralRankingEntry, MuralScope, MuralVoteAggregates } from '../models/mural.model';
import { getEffectiveGoalsFromPerformance } from '../utils/effective-performance.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import {
  readUserAmateurFootballIdol,
  readUserFavoriteAmateurTeam,
  readUserFavoriteProTeam,
  readUserProFootballIdol,
} from '../utils/user-personal-profile.util';
import { EventPerformanceService } from './event-performance.service';
import { MuralService } from './mural.service';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

interface ParticipantProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  profileLabel: string;
  isAthlete: boolean;
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  birthDate?: Date;
  age: number | null;
  ageBand: MuralAgeBand | null;
}

interface CloudMuralParticipantProfile {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  profileLabel: string;
  isAthlete?: boolean;
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  birthDate?: string;
  age?: number | null;
  ageBand?: MuralAgeBand | null;
}

const AGE_BANDS: MuralAgeBand[] = ['sub30', 'sub60', 'plus60'];

interface HighlightPerformanceRow {
  userId: string;
  eventId?: string;
  role: string;
  goals: number;
}

@Injectable({ providedIn: 'root' })
export class MuralHighlightsService {
  constructor(
    private readonly parseService: ParseService,
    private readonly performanceService: EventPerformanceService,
    private readonly muralService: MuralService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async getHighlights(
    scope: MuralScope,
    scopeId?: string,
    poolUserIds?: string[],
    participants?: PeladaParticipant[],
    preloadedRankings?: Record<MuralTargetRole, MuralRankingEntry[]>,
    preloadedVoteAggregates?: MuralVoteAggregates | null
  ): Promise<MuralHighlights> {
    const performances = await this.loadPerformancesForHighlights(scope, scopeId);

    const rankings = preloadedRankings ?? (await this.muralService.getRankings(scope, scopeId));
    const voteAggregates =
      preloadedVoteAggregates !== undefined
        ? preloadedVoteAggregates
        : await this.muralService.getVoteAggregates(scope, scopeId);
    const userIds = new Set<string>();

    for (const perf of performances) {
      if (perf.userId) userIds.add(perf.userId);
    }
    for (const roleList of Object.values(rankings ?? {})) {
      if (!Array.isArray(roleList)) continue;
      for (const entry of roleList) {
        if (entry?.userId) userIds.add(entry.userId);
      }
    }
    if (voteAggregates) {
      for (const role of MURAL_TARGET_ROLES) {
        for (const userId of Object.keys(voteAggregates[role] ?? {})) {
          if (userId) userIds.add(userId);
        }
      }
    }
    if (poolUserIds) {
      for (const id of poolUserIds) {
        if (id) userIds.add(id);
      }
    }

    const profiles = await this.loadParticipantProfiles(scope, scopeId, [...userIds], participants);

    const goalkeeperUserIds =
      scope === 'app' || scope === 'pelada'
        ? await this.muralService.getGoalkeeperUserIdsForScope(scope, scopeId)
        : new Set<string>();

    const craqueScores = this.buildVoteScoreMap(voteAggregates, 'athlete', rankings);
    for (const goalkeeperUserId of goalkeeperUserIds) {
      craqueScores.delete(goalkeeperUserId);
    }

    const goleadorGoals = this.aggregateGoleadorGoals(performances);

    const goleiroVoteScores = this.buildVoteScoreMap(voteAggregates, 'goalkeeper', rankings);

    const refereeScores = new Map<string, number>();
    for (const entry of rankings.referee ?? []) {
      refereeScores.set(entry.userId, entry.combinedScore);
    }

    if (scope === 'app' || scope === 'pelada') {
      await this.ensureProfilesForUserIds(profiles, [
        ...goleadorGoals.keys(),
        ...craqueScores.keys(),
      ]);
    }

    const craque =
      scope === 'event'
        ? ({ sub30: this.pickTop(craqueScores, profiles), sub60: null, plus60: null } as MuralAgeBandWinners)
        : this.applyAgeBandFallback(
            this.pickBestByBand(craqueScores, profiles, (score) => score > 0),
            this.pickTop(craqueScores, profiles)
          );
    const goleadorOverall =
      scope === 'app' || scope === 'pelada'
        ? this.pickTopWithLabel(goleadorGoals, profiles, 'Gols')
        : null;
    const goleador =
      scope === 'event'
        ? ({
            sub30: this.pickTopWithLabel(goleadorGoals, profiles, 'Gols'),
            sub60: null,
            plus60: null,
          } as MuralAgeBandWinners)
        : this.applyGoleadorAgeBands(
            this.pickBestByBand(goleadorGoals, profiles, (score) => score > 0, 'Gols'),
            goleadorGoals,
            profiles
          );
    const melhorGoleiro =
      scope === 'event'
        ? ({
            sub30: this.pickGoalkeeperByScore(
              goleiroVoteScores,
              profiles,
              rankings.goalkeeper ?? []
            ),
            sub60: null,
            plus60: null,
          } as MuralAgeBandWinners)
        : this.applyAgeBandFallback(
            this.pickBestByBand(goleiroVoteScores, profiles, (score) => score > 0, 'Pontos'),
            this.pickGoalkeeperByScore(goleiroVoteScores, profiles, rankings.goalkeeper ?? [])
          );

    const athleteProfiles = this.collectAthleteProfiles(profiles, participants);
    const promessa = this.pickExtremeAge(athleteProfiles, 'min');
    const master = this.pickExtremeAge(athleteProfiles, 'max');

    const birthdays = this.buildBirthdayList(profiles);
    const melhorJuiz = this.pickTop(refereeScores, profiles);
    const timeMaisAmado = await this.loadFavoriteProTeam(scope, scopeId, [...userIds]);

    return {
      craque,
      goleador,
      goleadorOverall,
      melhorGoleiro,
      timeMaisAmado,
      promessa,
      master,
      birthdays,
      melhorJuiz,
    };
  }

  private async loadFavoriteProTeam(
    scope: MuralScope,
    scopeId: string | undefined,
    userIds: string[]
  ): Promise<{ teamName: string; count: number } | null> {
    try {
      const result = (await Parse.Cloud.run('getFavoriteProTeamStats', {
        scope,
        scopeId,
        userIds,
      })) as { favoriteTeam?: { teamName: string; count: number } | null };
      const favorite = result?.favoriteTeam;
      if (favorite?.teamName && favorite.count > 0) {
        return { teamName: favorite.teamName, count: favorite.count };
      }
    } catch {
      // Cloud Code pode ainda nao estar publicado.
    }
    return null;
  }

  private buildVoteScoreMap(
    voteAggregates: MuralVoteAggregates | null,
    role: MuralTargetRole,
    rankings: Record<MuralTargetRole, MuralRankingEntry[]>
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const roleAgg = voteAggregates?.[role] ?? {};
    for (const [userId, data] of Object.entries(roleAgg)) {
      if (data.totalScore > 0) {
        scores.set(userId, data.totalScore);
      }
    }
    for (const entry of rankings[role] ?? []) {
      if (entry.totalScore <= 0) continue;
      const current = scores.get(entry.userId) ?? 0;
      if (entry.totalScore > current) {
        scores.set(entry.userId, entry.totalScore);
      }
    }
    return scores;
  }

  private buildVoteCountMap(
    voteAggregates: MuralVoteAggregates | null,
    role: MuralTargetRole,
    rankings: Record<MuralTargetRole, MuralRankingEntry[]>
  ): Map<string, number> {
    const counts = new Map<string, number>();
    const roleAgg = voteAggregates?.[role] ?? {};
    for (const [userId, data] of Object.entries(roleAgg)) {
      if (data.voteCount > 0) {
        counts.set(userId, data.voteCount);
      }
    }
    if (!counts.size) {
      for (const entry of rankings[role] ?? []) {
        if (entry.voteCount > 0) {
          counts.set(entry.userId, entry.voteCount);
        }
      }
    }
    return counts;
  }

  private async loadPerformancesForHighlights(
    scope: MuralScope,
    scopeId?: string
  ): Promise<HighlightPerformanceRow[]> {
    if (scope === 'event' && scopeId) {
      try {
        const rows = (await Parse.Cloud.run('getMuralHighlightPerformances', {
          scope: 'event',
          scopeId,
        })) as HighlightPerformanceRow[];
        if (Array.isArray(rows)) {
          return rows.map((row) => ({
            userId: String(row.userId || ''),
            eventId: row.eventId ? String(row.eventId) : scopeId,
            role: String(row.role || 'athlete'),
            goals: Number(row.goals || 0),
          }));
        }
      } catch {
        // Cloud Code pode ainda nao estar publicado; usa fallback local.
      }

      const rows = await this.performanceService.listForEvent(scopeId);
      return rows.map((perf) => ({
        userId: perf.userId,
        eventId: perf.eventId,
        role: String(perf.role),
        goals: getEffectiveGoalsFromPerformance(perf),
      }));
    }

    if (scope === 'app' || scope === 'pelada') {
      try {
        const rows = (await Parse.Cloud.run('getMuralHighlightPerformances', {
          scope,
          scopeId,
        })) as HighlightPerformanceRow[];
        if (Array.isArray(rows)) {
          return rows.map((row) => ({
            userId: String(row.userId || ''),
            eventId: row.eventId ? String(row.eventId) : undefined,
            role: String(row.role || 'athlete'),
            goals: Number(row.goals || 0),
          }));
        }
      } catch {
        // Cloud Code pode ainda nao estar publicado; usa fallback local.
      }
    }

    const fallback =
      scope === 'app'
        ? await this.performanceService.listForApp()
        : scope === 'pelada' && scopeId
          ? await this.performanceService.listForPelada(scopeId)
          : [];

    return fallback.map((perf) => ({
      userId: perf.userId,
      eventId: perf.eventId,
      role: String(perf.role),
      goals: getEffectiveGoalsFromPerformance(perf),
    }));
  }

  private aggregateGoleadorGoals(performances: HighlightPerformanceRow[]): Map<string, number> {
    const goalsByEventUser = new Map<string, number>();
    const goleadorGoals = new Map<string, number>();

    for (const perf of performances) {
      if (perf.role !== 'athlete') continue;
      if (!perf.userId) continue;
      const goals = Number(perf.goals || 0);
      if (!goals) continue;

      const eventUserKey = `${perf.eventId || perf.userId}:${perf.userId}`;
      const currentEventGoals = goalsByEventUser.get(eventUserKey) ?? 0;
      goalsByEventUser.set(eventUserKey, Math.max(currentEventGoals, goals));
    }

    for (const [eventUserKey, goals] of goalsByEventUser.entries()) {
      const userId = eventUserKey.split(':').slice(1).join(':');
      if (!userId) continue;
      goleadorGoals.set(userId, (goleadorGoals.get(userId) ?? 0) + goals);
    }

    return goleadorGoals;
  }

  private applyGoleadorAgeBands(
    bands: MuralAgeBandWinners,
    goals: Map<string, number>,
    profiles: Map<string, ParticipantProfile>
  ): MuralAgeBandWinners {
    const overall = this.pickTopWithLabel(goals, profiles, 'Gols');
    if (!overall) {
      return bands;
    }

    const result: MuralAgeBandWinners = { ...bands };
    const overallProfile = profiles.get(overall.userId);
    const overallBand = overallProfile?.ageBand ?? null;
    const overallGoals = overall.score ?? 0;

    if (overallBand) {
      const bandEntry = result[overallBand];
      const bandGoals = bandEntry?.score ?? 0;
      if (!bandEntry || overallGoals > bandGoals) {
        result[overallBand] = overall;
      }
    } else {
      const sub30Goals = result.sub30?.score ?? 0;
      if (overallGoals > sub30Goals) {
        result.sub30 = overall;
      }
    }

    if (!result.sub30 && !result.sub60 && !result.plus60) {
      result.sub30 = overall;
    }

    return result;
  }

  private async ensureProfilesForUserIds(
    profiles: Map<string, ParticipantProfile>,
    userIds: string[]
  ): Promise<void> {
    const missing = [...new Set(userIds.filter((id) => id && !profiles.has(id)))];
    if (!missing.length) return;

    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', missing);
    userQuery.limit(Math.min(missing.length, 100));
    const users = await userQuery.find();

    for (const user of users) {
      if (!user.id || profiles.has(user.id)) continue;
      const birthDate = user.get('birthDate') as Date | undefined;
      const age = birthDate ? this.calcAge(birthDate) : null;
      profiles.set(user.id, {
        userId: user.id,
        displayName:
          (user.get('apelido') as string) ||
          (user.get('name') as string) ||
          user.getUsername() ||
          'Participante',
        avatarUrl: getUserAvatarUrl(user, this.parseFileService) ?? undefined,
        profileLabel: 'Atleta',
        isAthlete: true,
        birthDate,
        age,
        ageBand: age !== null ? this.getAgeBand(age) : null,
      });
    }
  }

  private applyAgeBandFallback(
    bands: MuralAgeBandWinners,
    overall: MuralShowcaseEntry | null
  ): MuralAgeBandWinners {
    if (!overall || bands.sub30 || bands.sub60 || bands.plus60) {
      return bands;
    }
    return { ...bands, sub30: overall };
  }

  private collectAthleteProfiles(
    profiles: Map<string, ParticipantProfile>,
    participants?: PeladaParticipant[]
  ): ParticipantProfile[] {
    if (participants?.length) {
      return participants
        .filter((participant) => participant.roles.includes('athlete'))
        .map((participant) => this.participantToProfile(participant))
        .filter((profile) => profile.age !== null);
    }

    return [...profiles.values()].filter((profile) => profile.isAthlete && profile.age !== null);
  }

  private pickBestByBand(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    filter?: (score: number) => boolean,
    scoreLabel?: string
  ): MuralAgeBandWinners {
    const result: MuralAgeBandWinners = { sub30: null, sub60: null, plus60: null };

    for (const band of AGE_BANDS) {
      let bestUserId: string | null = null;
      let bestScore = -1;

      for (const [userId, score] of scores) {
        if (filter && !filter(score)) continue;
        const profile = profiles.get(userId);
        if (!profile || profile.ageBand !== band) continue;
        if (score > bestScore || (score === bestScore && this.isOlderProfile(profile, profiles.get(bestUserId!)))) {
          bestScore = score;
          bestUserId = userId;
        }
      }

      result[band] =
        bestUserId && bestScore >= 0
          ? this.toShowcaseEntry(profiles.get(bestUserId)!, bestScore, scoreLabel)
          : null;
    }

    return result;
  }

  private isOlderProfile(
    candidate: ParticipantProfile,
    incumbent: ParticipantProfile | undefined
  ): boolean {
    if (!incumbent) return true;
    return (candidate.age ?? -1) > (incumbent.age ?? -1);
  }

  private pickTopWithLabel(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    scoreLabel: string
  ): MuralShowcaseEntry | null {
    const entry = this.pickTop(scores, profiles);
    if (!entry) return null;
    return { ...entry, scoreLabel };
  }

  private pickGoalkeeperByScore(
    voteScores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    rankingEntries: MuralRankingEntry[]
  ): MuralShowcaseEntry | null {
    if (!voteScores.size) return null;

    const sorted = [...voteScores.entries()].sort((a, b) => {
      const scoreDiff = b[1] - a[1];
      if (scoreDiff !== 0) return scoreDiff;
      const ageA = profiles.get(a[0])?.age ?? -1;
      const ageB = profiles.get(b[0])?.age ?? -1;
      return ageB - ageA;
    });

    const [userId, points] = sorted[0];
    const profile = profiles.get(userId);
    if (!profile) {
      const ranking = rankingEntries.find((entry) => entry.userId === userId);
      if (!ranking) return null;
      return {
        userId,
        displayName: ranking.userName,
        avatarUrl: ranking.avatarUrl,
        profileLabel: 'Goleiro',
        score: points,
        scoreLabel: 'Pontos',
      };
    }
    return this.toShowcaseEntry(profile, points, 'Pontos');
  }

  private pickGoalkeeperByVotes(
    voteCounts: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    rankingEntries: MuralRankingEntry[]
  ): MuralShowcaseEntry | null {
    if (!voteCounts.size) return null;

    const sorted = [...voteCounts.entries()].sort((a, b) => {
      const voteDiff = b[1] - a[1];
      if (voteDiff !== 0) return voteDiff;
      const ageA = profiles.get(a[0])?.age ?? -1;
      const ageB = profiles.get(b[0])?.age ?? -1;
      return ageB - ageA;
    });

    const [userId, votes] = sorted[0];
    const profile = profiles.get(userId);
    if (!profile) {
      const ranking = rankingEntries.find((entry) => entry.userId === userId);
      if (!ranking) return null;
      return {
        userId,
        displayName: ranking.userName,
        avatarUrl: ranking.avatarUrl,
        profileLabel: 'Goleiro',
        score: votes,
        scoreLabel: 'Votos',
      };
    }
    return this.toShowcaseEntry(profile, votes, 'Votos');
  }

  private pickTop(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>
  ): MuralShowcaseEntry | null {
    let bestUserId: string | null = null;
    let bestScore = -1;

    for (const [userId, score] of scores) {
      if (score <= 0) continue;
      if (score > bestScore) {
        bestScore = score;
        bestUserId = userId;
      }
    }

    if (!bestUserId) return null;
    const profile = profiles.get(bestUserId);
    if (profile) {
      return this.toShowcaseEntry(profile, bestScore);
    }
    return {
      userId: bestUserId,
      displayName: 'Participante',
      profileLabel: 'Atleta',
      score: bestScore,
    };
  }

  private pickExtremeAge(
    profiles: ParticipantProfile[],
    mode: 'min' | 'max'
  ): MuralShowcaseEntry | null {
    if (!profiles.length) return null;

    const sorted = [...profiles].sort((a, b) => {
      const ageDiff = (a.age ?? 0) - (b.age ?? 0);
      if (ageDiff !== 0) return ageDiff;
      return a.displayName.localeCompare(b.displayName, 'pt-BR');
    });
    const profile = mode === 'min' ? sorted[0] : sorted[sorted.length - 1];
    return { ...this.toShowcaseEntry(profile), profileLabel: 'Atleta' };
  }

  private buildBirthdayList(profiles: Map<string, ParticipantProfile>): MuralBirthdayEntry[] {
    const month = new Date().getMonth();
    const entries: MuralBirthdayEntry[] = [];

    for (const profile of profiles.values()) {
      if (!profile.birthDate) continue;
      if (profile.birthDate.getMonth() !== month) continue;
      entries.push({
        ...this.toShowcaseEntry(profile),
        birthdayDay: profile.birthDate.getDate(),
      });
    }

    return entries.sort((a, b) => a.birthdayDay - b.birthdayDay);
  }

  private toShowcaseEntry(
    profile: ParticipantProfile,
    score?: number,
    scoreLabel?: string
  ): MuralShowcaseEntry {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileLabel: profile.profileLabel,
      favoriteProTeam: profile.favoriteProTeam,
      favoriteAmateurTeam: profile.favoriteAmateurTeam,
      proFootballIdol: profile.proFootballIdol,
      amateurFootballIdol: profile.amateurFootballIdol,
      score,
      scoreLabel,
      age: profile.age ?? undefined,
    };
  }

  private async loadParticipantProfiles(
    scope: MuralScope,
    scopeId: string | undefined,
    userIds: string[],
    participants?: PeladaParticipant[]
  ): Promise<Map<string, ParticipantProfile>> {
    try {
      const rows = (await Parse.Cloud.run('getMuralParticipantProfiles', {
        scope,
        scopeId,
        userIds,
      })) as CloudMuralParticipantProfile[];
      if (Array.isArray(rows) && rows.length) {
        return this.mapCloudProfiles(rows);
      }
    } catch {
      // Cloud Code pode ainda nao estar publicado; usa fallback local.
    }

    if (participants?.length) {
      return this.buildProfilesFromParticipants(participants);
    }

    return this.loadParticipantProfilesClient(userIds);
  }

  private participantToProfile(participant: PeladaParticipant): ParticipantProfile {
    const birthDate = participant.birthDate;
    const age = birthDate ? this.calcAge(birthDate) : null;
    const primaryRole = participant.roles[0];
    return {
      userId: participant.userId,
      displayName: participant.apelido || participant.userName || 'Participante',
      avatarUrl: participant.avatarUrl,
      profileLabel:
        participant.profileLabel ||
        (participant.roles.includes('athlete') ? 'Atleta' : undefined) ||
        (primaryRole ? PROFILE_ROLE_LABELS[primaryRole] : undefined) ||
        'Participante',
      isAthlete: participant.roles.includes('athlete'),
      favoriteProTeam: participant.favoriteProTeam,
      favoriteAmateurTeam: participant.favoriteAmateurTeam,
      proFootballIdol: participant.proFootballIdol,
      amateurFootballIdol: participant.amateurFootballIdol,
      birthDate,
      age,
      ageBand: age !== null ? this.getAgeBand(age) : null,
    };
  }

  private buildProfilesFromParticipants(
    participants: PeladaParticipant[]
  ): Map<string, ParticipantProfile> {
    const map = new Map<string, ParticipantProfile>();
    for (const participant of participants) {
      if (!participant.userId) continue;
      const birthDate = participant.birthDate;
      const age = birthDate ? this.calcAge(birthDate) : null;
      const primaryRole = participant.roles[0];
      map.set(participant.userId, {
        userId: participant.userId,
        displayName: participant.apelido || participant.userName || 'Participante',
        avatarUrl: participant.avatarUrl,
        profileLabel:
          participant.profileLabel ||
          (participant.roles.includes('athlete') ? 'Atleta' : undefined) ||
          (primaryRole ? PROFILE_ROLE_LABELS[primaryRole] : undefined) ||
          'Participante',
        isAthlete: participant.roles.includes('athlete'),
        favoriteProTeam: participant.favoriteProTeam,
        favoriteAmateurTeam: participant.favoriteAmateurTeam,
        proFootballIdol: participant.proFootballIdol,
        amateurFootballIdol: participant.amateurFootballIdol,
        birthDate,
        age,
        ageBand: age !== null ? this.getAgeBand(age) : null,
      });
    }
    return map;
  }

  private mapCloudProfiles(rows: CloudMuralParticipantProfile[]): Map<string, ParticipantProfile> {
    const map = new Map<string, ParticipantProfile>();
    for (const row of rows) {
      if (!row.userId) continue;
      const birthDate = row.birthDate ? new Date(row.birthDate) : undefined;
      const age = row.age ?? (birthDate ? this.calcAge(birthDate) : null);
      map.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        profileLabel: row.profileLabel || 'Participante',
        isAthlete: !!row.isAthlete,
        favoriteProTeam: row.favoriteProTeam,
        favoriteAmateurTeam: row.favoriteAmateurTeam,
        proFootballIdol: row.proFootballIdol,
        amateurFootballIdol: row.amateurFootballIdol,
        birthDate,
        age,
        ageBand: row.ageBand ?? (age !== null ? this.getAgeBand(age) : null),
      });
    }
    return map;
  }

  private async loadParticipantProfilesClient(
    userIds: string[]
  ): Promise<Map<string, ParticipantProfile>> {
    const map = new Map<string, ParticipantProfile>();
    if (!userIds.length) return map;

    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', userIds);
    userQuery.limit(userIds.length);
    const users = await userQuery.find();

    const athleteQuery = new Parse.Query('AthleteProfile');
    athleteQuery.containedIn('user', users);
    athleteQuery.limit(userIds.length);
    const athletes = await athleteQuery.find();
    const athleteByUserId = new Map<string, Parse.Object>();
    for (const row of athletes) {
      const user = row.get('user') as Parse.User | undefined;
      if (user?.id) athleteByUserId.set(user.id, row);
    }

    const teamQuery = new Parse.Query('AmateurTeam');
    teamQuery.containedIn('president', users);
    teamQuery.limit(userIds.length);
    const teams = await teamQuery.find();
    const teamByPresidentId = new Map<string, Parse.Object>();
    for (const row of teams) {
      const president = row.get('president') as Parse.User | undefined;
      if (president?.id) teamByPresidentId.set(president.id, row);
    }

    for (const user of users) {
      if (!user.id) continue;
      const athlete = athleteByUserId.get(user.id);
      const team = teamByPresidentId.get(user.id);
      const birthDate = user.get('birthDate') as Date | undefined;
      const age = birthDate ? this.calcAge(birthDate) : null;

      const primaryRole = user.get('primaryRole') as ProfileRole | undefined;
      const athletePosition = athlete?.get('primaryPosition') as string | undefined;
      const profileLabel =
        athletePosition ||
        (primaryRole ? PROFILE_ROLE_LABELS[primaryRole] : undefined) ||
        'Participante';

      map.set(user.id, {
        userId: user.id,
        displayName:
          (user.get('apelido') as string) ||
          (user.get('name') as string) ||
          user.getUsername() ||
          'Participante',
        avatarUrl: getUserAvatarUrl(user, this.parseFileService) ?? undefined,
        profileLabel,
        isAthlete: athleteByUserId.has(user.id),
        favoriteProTeam: readUserFavoriteProTeam(
          user,
          athlete?.get('favoriteProTeam') as string | undefined
        ),
        favoriteAmateurTeam: readUserFavoriteAmateurTeam(
          user,
          team?.get('name') as string | undefined
        ),
        proFootballIdol: readUserProFootballIdol(user),
        amateurFootballIdol: readUserAmateurFootballIdol(user),
        birthDate,
        age,
        ageBand: age !== null ? this.getAgeBand(age) : null,
      });
    }

    return map;
  }

  private calcAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age;
  }

  private getAgeBand(age: number): MuralAgeBand {
    if (age < 30) return 'sub30';
    if (age < 60) return 'sub60';
    return 'plus60';
  }
}
