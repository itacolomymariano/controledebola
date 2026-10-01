import { Injectable } from '@angular/core';
import Parse from 'parse';
import { PROFILE_ROLE_LABELS, ProfileRole } from '../models/profile-role.model';
import {
  MuralAgeBand,
  MuralAgeBandWinnerLists,
  MuralAgeBandWinners,
  MuralBirthdayEntry,
  MuralFavoriteTeamEntry,
  MuralHighlights,
  MuralShowcaseEntry,
} from '../models/mural-highlights.model';
import { formatHighlightTenure } from '../utils/format-highlight-tenure.util';
import { teamSlug } from '../utils/team-shield.util';
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
  peladaGoals?: number;
  teamMatchGoals?: number;
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
    preloadedVoteAggregates?: MuralVoteAggregates | null,
    options?: {
      voteAggregatesPelada?: MuralVoteAggregates;
      voteAggregatesTeamMatch?: MuralVoteAggregates;
      appBucket?: 'merged' | 'pelada' | 'team_match';
    }
  ): Promise<MuralHighlights> {
    try {
      return await this.computeHighlights(
        scope,
        scopeId,
        poolUserIds,
        participants,
        preloadedRankings,
        preloadedVoteAggregates,
        options
      );
    } catch (error: unknown) {
      console.warn('getHighlights failed', error);
      return this.emptyHighlights();
    }
  }

  private emptyHighlights(): MuralHighlights {
    const emptyBands = (): MuralAgeBandWinners => ({ sub30: null, sub60: null, plus60: null });
    const emptyGoleadorBands = (): MuralAgeBandWinnerLists => ({
      sub30: [],
      sub60: [],
      plus60: [],
    });
    return {
      craque: emptyBands(),
      craquePelada: null,
      craqueConfronto: null,
      goleador: emptyGoleadorBands(),
      goleadorOverall: [],
      goleadorPelada: [],
      goleadorConfronto: [],
      melhorGoleiro: emptyBands(),
      melhorGoleiroPelada: null,
      melhorGoleiroConfronto: null,
      timeMaisAmado: null,
      promessa: null,
      master: null,
      birthdays: [],
      melhorJuiz: null,
    };
  }

  private async computeHighlights(
    scope: MuralScope,
    scopeId: string | undefined,
    poolUserIds: string[] | undefined,
    participants: PeladaParticipant[] | undefined,
    preloadedRankings: Record<MuralTargetRole, MuralRankingEntry[]> | undefined,
    preloadedVoteAggregates: MuralVoteAggregates | null | undefined,
    options?: {
      voteAggregatesPelada?: MuralVoteAggregates;
      voteAggregatesTeamMatch?: MuralVoteAggregates;
      appBucket?: 'merged' | 'pelada' | 'team_match';
    }
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
    const goleadorPeladaGoals = this.aggregateGoleadorGoalsByBucket(performances, 'pelada');
    const goleadorConfrontoGoals = this.aggregateGoleadorGoalsByBucket(performances, 'teamMatch');
    const goleadorMergedGoals = this.aggregateGoleadorGoalsMerged(performances);
    const goleadorMergedDisplayGoals = this.aggregateGoleadorGoalsDisplayMerged(performances);

    const goleiroVoteScores = this.buildVoteScoreMap(voteAggregates, 'goalkeeper', rankings);

    const refereeScores = new Map<string, number>();
    for (const entry of rankings.referee ?? []) {
      refereeScores.set(entry.userId, entry.combinedScore);
    }
    for (const [userId, agg] of Object.entries(voteAggregates?.referee ?? {})) {
      const row = agg as { totalScore?: number; rankingScore?: number };
      const current = refereeScores.get(userId) ?? 0;
      const rank = Number(row.rankingScore ?? row.totalScore ?? 0);
      refereeScores.set(userId, Math.max(current, rank));
    }

    if (scope === 'app' && options?.appBucket) {
      const bucketGoals =
        options.appBucket === 'merged'
          ? goleadorMergedGoals
          : options.appBucket === 'pelada'
            ? goleadorPeladaGoals
            : goleadorConfrontoGoals;
      const bucketDisplayGoals =
        options.appBucket === 'merged' ? goleadorMergedDisplayGoals : bucketGoals;
      await this.ensureProfilesForUserIds(profiles, [
        ...craqueScores.keys(),
        ...bucketGoals.keys(),
        ...goleiroVoteScores.keys(),
        ...refereeScores.keys(),
      ]);
      const craqueWinner = this.pickTopWithRankingFallback(
        craqueScores,
        profiles,
        rankings.athlete ?? []
      );
      const melhorGk = this.pickGoalkeeperByScore(
        goleiroVoteScores,
        profiles,
        rankings.goalkeeper ?? []
      );
      const goleadorWinners = this.enrichShowcaseEntriesFromRankings(
        this.pickAllTiedWithLabel(bucketGoals, profiles, 'Gols', bucketDisplayGoals),
        rankings.athlete ?? []
      );
      const athleteProfiles = this.collectAthleteProfiles(profiles, participants);
      const promessa = this.pickExtremeAge(athleteProfiles, 'min');
      const master = this.pickExtremeAge(athleteProfiles, 'max');
      await this.ensureProfilesForUserIds(profiles, [
        melhorGk?.userId,
        promessa?.userId,
        master?.userId,
      ].filter((id): id is string => !!id));
      const melhorJuiz = this.pickTopWithRankingFallback(
        refereeScores,
        profiles,
        rankings.referee ?? []
      );
      const timeMaisAmado = await this.loadFavoriteProTeam(scope, scopeId, [...userIds], profiles);
      const highlights: MuralHighlights = {
        craque: { sub30: craqueWinner, sub60: null, plus60: null },
        craquePelada: null,
        craqueConfronto: null,
        goleador: {
          sub30: goleadorWinners,
          sub60: [],
          plus60: [],
        },
        goleadorOverall: goleadorWinners,
        goleadorPelada: [],
        goleadorConfronto: [],
        melhorGoleiro: { sub30: melhorGk, sub60: null, plus60: null },
        melhorGoleiroPelada: null,
        melhorGoleiroConfronto: null,
        timeMaisAmado,
        promessa,
        master,
        birthdays: [],
        melhorJuiz,
      };
      return await this.applyAppBucketTenureLabels(
        await this.backfillHighlightFavoriteProTeams(highlights, profiles),
        options.appBucket
      );
    }

    if (scope === 'app' || scope === 'pelada') {
      await this.ensureProfilesForUserIds(profiles, [
        ...goleadorGoals.keys(),
        ...craqueScores.keys(),
        ...goleiroVoteScores.keys(),
        ...refereeScores.keys(),
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
        ? this.pickAllTiedWithLabel(goleadorGoals, profiles, 'Gols')
        : [];
    const goleador =
      scope === 'event'
        ? ({
            sub30: this.pickAllTiedWithLabel(goleadorGoals, profiles, 'Gols'),
            sub60: [],
            plus60: [],
          } as MuralAgeBandWinnerLists)
        : this.applyGoleadorAgeBands(
            this.pickAllTiedByBand(goleadorGoals, profiles, (score) => score > 0, 'Gols'),
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
    await this.ensureProfilesForUserIds(profiles, [
      promessa?.userId,
      master?.userId,
      ...goleiroVoteScores.keys(),
    ].filter((id): id is string => !!id));

    const birthdays = this.buildBirthdayList(profiles);
    const melhorJuiz = this.pickTop(refereeScores, profiles);
    const timeMaisAmado = await this.loadFavoriteProTeam(scope, scopeId, [...userIds], profiles);

    let craquePelada: MuralShowcaseEntry | null = null;
    let craqueConfronto: MuralShowcaseEntry | null = null;
    let goleadorPelada: MuralShowcaseEntry[] = [];
    let goleadorConfronto: MuralShowcaseEntry[] = [];
    let melhorGoleiroPelada: MuralShowcaseEntry | null = null;
    let melhorGoleiroConfronto: MuralShowcaseEntry | null = null;

    if (scope === 'app') {
      goleadorPelada = this.pickAllTiedWithLabel(goleadorPeladaGoals, profiles, 'Gols');
      goleadorConfronto = this.pickAllTiedWithLabel(goleadorConfrontoGoals, profiles, 'Gols');
      const peladaVotes = options?.voteAggregatesPelada;
      const matchVotes = options?.voteAggregatesTeamMatch;
      if (peladaVotes) {
        const craquePeladaScores = this.buildVoteScoreMap(peladaVotes, 'athlete', rankings);
        for (const goalkeeperUserId of goalkeeperUserIds) {
          craquePeladaScores.delete(goalkeeperUserId);
        }
        craquePelada = this.pickTop(craquePeladaScores, profiles);
        melhorGoleiroPelada = this.pickTopWithLabel(
          this.buildVoteScoreMap(peladaVotes, 'goalkeeper', rankings),
          profiles,
          'Pontos'
        );
      }
      if (matchVotes) {
        const craqueMatchScores = this.buildVoteScoreMap(matchVotes, 'athlete', rankings);
        for (const goalkeeperUserId of goalkeeperUserIds) {
          craqueMatchScores.delete(goalkeeperUserId);
        }
        craqueConfronto = this.pickTop(craqueMatchScores, profiles);
        melhorGoleiroConfronto = this.pickTopWithLabel(
          this.buildVoteScoreMap(matchVotes, 'goalkeeper', rankings),
          profiles,
          'Pontos'
        );
      }
    }

    return await this.backfillHighlightFavoriteProTeams(
      {
        craque,
        craquePelada,
        craqueConfronto,
        goleador,
        goleadorOverall,
        goleadorPelada,
        goleadorConfronto,
        melhorGoleiro,
        melhorGoleiroPelada,
        melhorGoleiroConfronto,
        timeMaisAmado,
        promessa,
        master,
        birthdays,
        melhorJuiz,
      },
      profiles
    );
  }

  private async loadFavoriteProTeam(
    scope: MuralScope,
    scopeId: string | undefined,
    userIds: string[],
    profiles?: Map<string, ParticipantProfile>
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
    if (profiles?.size) {
      return this.aggregateFavoriteProTeamFromProfiles(profiles);
    }
    return null;
  }

  private aggregateFavoriteProTeamFromProfiles(
    profiles: Map<string, ParticipantProfile>
  ): { teamName: string; count: number } | null {
    const counts = new Map<string, number>();
    for (const profile of profiles.values()) {
      const teamName = String(profile.favoriteProTeam || '').trim();
      if (!teamName || teamName.toLowerCase() === 'sem time') continue;
      counts.set(teamName, (counts.get(teamName) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'pt-BR');
    });
    if (!sorted.length) return null;
    return { teamName: sorted[0][0], count: sorted[0][1] };
  }

  private buildVoteScoreMap(
    voteAggregates: MuralVoteAggregates | null,
    role: MuralTargetRole,
    rankings: Record<MuralTargetRole, MuralRankingEntry[]>
  ): Map<string, number> {
    const scores = new Map<string, number>();
    const roleAgg = voteAggregates?.[role] ?? {};
    for (const [userId, data] of Object.entries(roleAgg)) {
      const row = data as { totalScore?: number; rankingScore?: number };
      const rank = Number(row.rankingScore ?? row.totalScore ?? 0);
      if (rank > 0) {
        scores.set(userId, rank);
      }
    }
    for (const entry of rankings[role] ?? []) {
      const rankingEntry = entry as MuralRankingEntry & { rankingScore?: number };
      const rank = Number(
        rankingEntry.rankingScore ?? rankingEntry.combinedScore ?? rankingEntry.totalScore ?? 0
      );
      if (rank <= 0) continue;
      const current = scores.get(entry.userId) ?? 0;
      if (rank > current) {
        scores.set(entry.userId, rank);
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
            peladaGoals:
              row.peladaGoals != null ? Number(row.peladaGoals) : undefined,
            teamMatchGoals:
              row.teamMatchGoals != null ? Number(row.teamMatchGoals) : undefined,
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

  private aggregateGoleadorGoalsMerged(performances: HighlightPerformanceRow[]): Map<string, number> {
    const pelada = this.aggregateGoleadorGoalsByBucket(performances, 'pelada');
    const confronto = this.aggregateGoleadorGoalsByBucket(performances, 'teamMatch');
    const merged = new Map<string, number>();
    for (const [userId, goals] of pelada.entries()) {
      merged.set(userId, (merged.get(userId) ?? 0) + goals);
    }
    for (const [userId, goals] of confronto.entries()) {
      // Sort key only (3x); display uses aggregateGoleadorGoalsDisplayMerged.
      merged.set(userId, (merged.get(userId) ?? 0) + goals * 3);
    }
    return merged;
  }

  /** Gols reais (pelada + confronto) para exibir no card do goleador GERAL. */
  private aggregateGoleadorGoalsDisplayMerged(
    performances: HighlightPerformanceRow[]
  ): Map<string, number> {
    const pelada = this.aggregateGoleadorGoalsByBucket(performances, 'pelada');
    const confronto = this.aggregateGoleadorGoalsByBucket(performances, 'teamMatch');
    const merged = new Map<string, number>();
    for (const [userId, goals] of pelada.entries()) {
      merged.set(userId, (merged.get(userId) ?? 0) + goals);
    }
    for (const [userId, goals] of confronto.entries()) {
      merged.set(userId, (merged.get(userId) ?? 0) + goals);
    }
    return merged;
  }

  private aggregateGoleadorGoalsByBucket(
    performances: HighlightPerformanceRow[],
    bucket: 'pelada' | 'teamMatch'
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const perf of performances) {
      if (perf.role !== 'athlete' || !perf.userId) continue;
      const value =
        bucket === 'teamMatch'
          ? Number(perf.teamMatchGoals ?? 0)
          : Number(perf.peladaGoals ?? 0);
      // Cloud may return aggregated rows (no eventId) with peladaGoals/teamMatchGoals.
      if (perf.peladaGoals != null || perf.teamMatchGoals != null) {
        if (value > 0) map.set(perf.userId, (map.get(perf.userId) ?? 0) + value);
        continue;
      }
      // Fallback client rows without split: count all into pelada bucket only.
      if (bucket === 'pelada') {
        const goals = Number(perf.goals || 0);
        if (goals > 0) map.set(perf.userId, (map.get(perf.userId) ?? 0) + goals);
      }
    }
    return map;
  }

  private applyGoleadorAgeBands(
    bands: MuralAgeBandWinnerLists,
    goals: Map<string, number>,
    profiles: Map<string, ParticipantProfile>
  ): MuralAgeBandWinnerLists {
    const overall = this.pickAllTiedWithLabel(goals, profiles, 'Gols');
    if (!overall.length) {
      return bands;
    }

    const result: MuralAgeBandWinnerLists = {
      sub30: [...bands.sub30],
      sub60: [...bands.sub60],
      plus60: [...bands.plus60],
    };
    const overallGoals = overall[0]?.score ?? 0;

    for (const entry of overall) {
      const overallProfile = profiles.get(entry.userId);
      const overallBand = overallProfile?.ageBand ?? null;
      if (overallBand) {
        const bandEntries = result[overallBand];
        const bandGoals = bandEntries[0]?.score ?? 0;
        if (!bandEntries.length || overallGoals > bandGoals) {
          result[overallBand] = [entry];
        } else if (overallGoals === bandGoals) {
          if (!bandEntries.some((e) => e.userId === entry.userId)) {
            result[overallBand] = [...bandEntries, entry];
          }
        }
      } else {
        const sub30Goals = result.sub30[0]?.score ?? 0;
        if (!result.sub30.length || overallGoals > sub30Goals) {
          result.sub30 = [entry];
        } else if (overallGoals === sub30Goals) {
          if (!result.sub30.some((e) => e.userId === entry.userId)) {
            result.sub30 = [...result.sub30, entry];
          }
        }
      }
    }

    if (!result.sub30.length && !result.sub60.length && !result.plus60.length) {
      result.sub30 = overall;
    }

    return result;
  }

  private async ensureProfilesForUserIds(
    profiles: Map<string, ParticipantProfile>,
    userIds: string[]
  ): Promise<void> {
    const uniqueIds = [...new Set(userIds.filter((id) => !!id))];
    if (!uniqueIds.length) return;

    const missing = uniqueIds.filter((id) => !profiles.has(id));
    const needsTeam = uniqueIds.filter((id) => {
      const profile = profiles.get(id);
      return !!profile && !profile.favoriteProTeam?.trim();
    });
    const fetchIds = [...new Set([...missing, ...needsTeam])];
    if (!fetchIds.length) return;

    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', fetchIds);
    userQuery.limit(Math.min(fetchIds.length, 100));
    const users = await userQuery.find();

    const athleteByUserId = new Map<string, Parse.Object>();
    const fanByUserId = new Map<string, Parse.Object>();
    if (users.length) {
      const athleteQuery = new Parse.Query('AthleteProfile');
      athleteQuery.containedIn('user', users);
      athleteQuery.limit(users.length);
      const athletes = await athleteQuery.find().catch(() => [] as Parse.Object[]);
      for (const row of athletes) {
        const userPtr = row.get('user') as Parse.User | undefined;
        if (userPtr?.id) athleteByUserId.set(userPtr.id, row);
      }

      const fanQuery = new Parse.Query('FanProfile');
      fanQuery.containedIn('user', users);
      fanQuery.limit(users.length);
      const fans = await fanQuery.find().catch(() => [] as Parse.Object[]);
      for (const row of fans) {
        const userPtr = row.get('user') as Parse.User | undefined;
        if (userPtr?.id) fanByUserId.set(userPtr.id, row);
      }
    }

    for (const user of users) {
      if (!user.id) continue;
      const birthDate = user.get('birthDate') as Date | undefined;
      const age = birthDate ? this.calcAge(birthDate) : null;
      const athlete = athleteByUserId.get(user.id);
      const fan = fanByUserId.get(user.id);
      const favoriteProTeam = readUserFavoriteProTeam(
        user,
        athlete?.get('favoriteProTeam') as string | undefined,
        fan?.get('favoriteProTeam') as string | undefined
      );
      const existing = profiles.get(user.id);
      if (existing) {
        if (!existing.favoriteProTeam?.trim() && favoriteProTeam) {
          profiles.set(user.id, { ...existing, favoriteProTeam });
        }
        continue;
      }
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
        favoriteProTeam,
        favoriteAmateurTeam: readUserFavoriteAmateurTeam(user, undefined),
        proFootballIdol: readUserProFootballIdol(user),
        amateurFootballIdol: readUserAmateurFootballIdol(user),
        birthDate,
        age,
        ageBand: age !== null ? this.getAgeBand(age) : null,
      });
    }
  }

  /** Garante favoriteProTeam nas entries de showcase (mesmo critério do Craque). */
  private async backfillHighlightFavoriteProTeams(
    highlights: MuralHighlights,
    profiles: Map<string, ParticipantProfile>
  ): Promise<MuralHighlights> {
    const collectIds = (entry: MuralShowcaseEntry | null | undefined) => {
      if (entry?.userId && !entry.favoriteProTeam?.trim()) return [entry.userId];
      return [] as string[];
    };
    const ids = [
      ...collectIds(highlights.craque.sub30),
      ...collectIds(highlights.craque.sub60),
      ...collectIds(highlights.craque.plus60),
      ...collectIds(highlights.craquePelada),
      ...collectIds(highlights.craqueConfronto),
      ...collectIds(highlights.melhorGoleiro.sub30),
      ...collectIds(highlights.melhorGoleiro.sub60),
      ...collectIds(highlights.melhorGoleiro.plus60),
      ...collectIds(highlights.melhorGoleiroPelada),
      ...collectIds(highlights.melhorGoleiroConfronto),
      ...collectIds(highlights.promessa),
      ...collectIds(highlights.master),
      ...collectIds(highlights.melhorJuiz),
      ...(highlights.goleador.sub30 ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.goleador.sub60 ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.goleador.plus60 ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.goleadorOverall ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.goleadorPelada ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.goleadorConfronto ?? []).flatMap((e) => collectIds(e)),
      ...(highlights.birthdays ?? []).flatMap((e) => collectIds(e)),
    ];
    await this.ensureProfilesForUserIds(profiles, ids);

    // Reforço Master / Melhor Goleiro: garante nova leitura User+Athlete+Fan.
    const criticalIds = [
      highlights.master?.userId,
      highlights.melhorGoleiro.sub30?.userId,
      highlights.melhorGoleiroPelada?.userId,
      highlights.melhorGoleiroConfronto?.userId,
    ].filter((id): id is string => !!id);
    if (criticalIds.length) {
      for (const id of criticalIds) {
        const existing = profiles.get(id);
        if (existing && !existing.favoriteProTeam?.trim()) {
          profiles.delete(id);
        }
      }
      await this.ensureProfilesForUserIds(profiles, criticalIds);
    }

    const patch = (entry: MuralShowcaseEntry | null): MuralShowcaseEntry | null => {
      if (!entry || entry.favoriteProTeam?.trim()) return entry;
      const team = profiles.get(entry.userId)?.favoriteProTeam?.trim();
      return team ? { ...entry, favoriteProTeam: team } : entry;
    };
    const patchList = (entries: MuralShowcaseEntry[]) =>
      entries.map((entry) => patch(entry) ?? entry);

    return {
      ...highlights,
      craque: {
        sub30: patch(highlights.craque.sub30),
        sub60: patch(highlights.craque.sub60),
        plus60: patch(highlights.craque.plus60),
      },
      craquePelada: patch(highlights.craquePelada ?? null),
      craqueConfronto: patch(highlights.craqueConfronto ?? null),
      melhorGoleiro: {
        sub30: patch(highlights.melhorGoleiro.sub30),
        sub60: patch(highlights.melhorGoleiro.sub60),
        plus60: patch(highlights.melhorGoleiro.plus60),
      },
      melhorGoleiroPelada: patch(highlights.melhorGoleiroPelada ?? null),
      melhorGoleiroConfronto: patch(highlights.melhorGoleiroConfronto ?? null),
      promessa: patch(highlights.promessa),
      master: patch(highlights.master),
      melhorJuiz: patch(highlights.melhorJuiz),
      goleador: {
        sub30: patchList(highlights.goleador.sub30),
        sub60: patchList(highlights.goleador.sub60),
        plus60: patchList(highlights.goleador.plus60),
      },
      goleadorOverall: highlights.goleadorOverall
        ? patchList(highlights.goleadorOverall)
        : highlights.goleadorOverall,
      goleadorPelada: highlights.goleadorPelada
        ? patchList(highlights.goleadorPelada)
        : highlights.goleadorPelada,
      goleadorConfronto: highlights.goleadorConfronto
        ? patchList(highlights.goleadorConfronto)
        : highlights.goleadorConfronto,
      birthdays: highlights.birthdays.map((entry) => {
        const patched = patch(entry) ?? entry;
        return { ...entry, ...patched };
      }),
    };
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
    const byUserId = new Map<string, ParticipantProfile>();

    for (const profile of profiles.values()) {
      if (profile.age === null || !profile.isAthlete) continue;
      byUserId.set(profile.userId, profile);
    }

    if (participants?.length) {
      for (const participant of participants) {
        if (!participant.userId || !participant.roles.includes('athlete')) continue;
        const base = this.participantToProfile(participant);
        const enriched = profiles.get(participant.userId);
        const merged = enriched
          ? {
              ...base,
              ...enriched,
              displayName: base.displayName || enriched.displayName,
              birthDate: enriched.birthDate ?? base.birthDate,
              age: enriched.age ?? base.age,
              ageBand: enriched.ageBand ?? base.ageBand,
              profileLabel: enriched.profileLabel || base.profileLabel,
              avatarUrl: enriched.avatarUrl ?? base.avatarUrl,
              favoriteProTeam: enriched.favoriteProTeam ?? base.favoriteProTeam,
              favoriteAmateurTeam: enriched.favoriteAmateurTeam ?? base.favoriteAmateurTeam,
              proFootballIdol: enriched.proFootballIdol ?? base.proFootballIdol,
              amateurFootballIdol: enriched.amateurFootballIdol ?? base.amateurFootballIdol,
              isAthlete: true,
            }
          : base;
        if (merged.age !== null) {
          byUserId.set(participant.userId, merged);
        }
      }
    }

    return [...byUserId.values()];
  }

  private enrichShowcaseEntriesFromRankings(
    entries: MuralShowcaseEntry[],
    rankingEntries: MuralRankingEntry[]
  ): MuralShowcaseEntry[] {
    return entries.map((entry) => {
      if (entry.avatarUrl) return entry;
      const ranking = rankingEntries.find((row) => row.userId === entry.userId);
      if (!ranking) return entry;
      return {
        ...entry,
        displayName: ranking.userName || entry.displayName,
        avatarUrl: ranking.avatarUrl ?? entry.avatarUrl,
      };
    });
  }

  private pickTopWithRankingFallback(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    rankingEntries: MuralRankingEntry[]
  ): MuralShowcaseEntry | null {
    const entry = this.pickTop(scores, profiles);
    if (!entry) return null;
    const ranking = rankingEntries.find((row) => row.userId === entry.userId);
    const displayScore = this.displayScoreFromRanking(ranking) ?? entry.score;
    const withDisplay = { ...entry, score: displayScore };
    if (withDisplay.avatarUrl) return withDisplay;
    if (!ranking) return withDisplay;
    return {
      ...withDisplay,
      displayName: ranking.userName || withDisplay.displayName,
      avatarUrl: ranking.avatarUrl ?? withDisplay.avatarUrl,
    };
  }

  private displayScoreFromRanking(ranking: MuralRankingEntry | undefined): number | undefined {
    if (!ranking) return undefined;
    if (ranking.voteCount > 0 && ranking.averageScore != null) {
      return Number(ranking.averageScore);
    }
    return Number(ranking.totalScore ?? ranking.combinedScore ?? 0);
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

  /** Empate no topo: um card por goleador com a mesma pontuacao maxima. */
  private pickAllTiedWithLabel(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    scoreLabel: string,
    displayScores?: Map<string, number>
  ): MuralShowcaseEntry[] {
    let bestScore = -1;
    for (const score of scores.values()) {
      if (score > bestScore) bestScore = score;
    }
    if (bestScore <= 0) return [];

    const tied: MuralShowcaseEntry[] = [];
    for (const [userId, score] of scores) {
      if (score !== bestScore) continue;
      const displayScore = displayScores?.get(userId) ?? score;
      const profile = profiles.get(userId);
      if (profile) {
        tied.push(this.toShowcaseEntry(profile, displayScore, scoreLabel));
      } else {
        tied.push({
          userId,
          displayName: 'Participante',
          profileLabel: 'Atleta',
          score: displayScore,
          scoreLabel,
        });
      }
    }
    return tied.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }

  private pickAllTiedByBand(
    scores: Map<string, number>,
    profiles: Map<string, ParticipantProfile>,
    filter?: (score: number) => boolean,
    scoreLabel?: string
  ): MuralAgeBandWinnerLists {
    const result: MuralAgeBandWinnerLists = { sub30: [], sub60: [], plus60: [] };

    for (const band of AGE_BANDS) {
      let bestScore = -1;
      for (const [userId, score] of scores) {
        if (filter && !filter(score)) continue;
        const profile = profiles.get(userId);
        if (!profile || profile.ageBand !== band) continue;
        if (score > bestScore) bestScore = score;
      }
      if (bestScore < 0) continue;

      const tied: MuralShowcaseEntry[] = [];
      for (const [userId, score] of scores) {
        if (filter && !filter(score)) continue;
        if (score !== bestScore) continue;
        const profile = profiles.get(userId);
        if (!profile || profile.ageBand !== band) continue;
        tied.push(this.toShowcaseEntry(profile, score, scoreLabel));
      }
      result[band] = tied.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
    }

    return result;
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
    const ranking = rankingEntries.find((entry) => entry.userId === userId);
    const displayScore = this.displayScoreFromRanking(ranking) ?? points;
    const profile = profiles.get(userId);
    if (!profile) {
      if (!ranking) return null;
      return {
        userId,
        displayName: ranking.userName,
        avatarUrl: ranking.avatarUrl,
        profileLabel: 'Goleiro',
        score: displayScore,
        scoreLabel: ranking.voteCount > 0 ? 'Nota' : 'Pontos',
      };
    }
    return {
      ...this.toShowcaseEntry(
        profile,
        displayScore,
        ranking && ranking.voteCount > 0 ? 'Nota' : 'Pontos'
      ),
      profileLabel: 'Goleiro',
    };
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
    const favoriteProTeam = profile.favoriteProTeam?.trim() || undefined;
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      profileLabel: profile.profileLabel,
      favoriteProTeam,
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

  private buildAppBucketTenureHolders(highlights: MuralHighlights): Record<string, string | null> {
    const holders: Record<string, string | null> = {};
    holders['craque'] = highlights.craque.sub30?.userId ?? null;
    holders['melhor_goleiro'] = highlights.melhorGoleiro.sub30?.userId ?? null;
    holders['melhor_juiz'] = highlights.melhorJuiz?.userId ?? null;
    holders['promessa'] = highlights.promessa?.userId ?? null;
    holders['master'] = highlights.master?.userId ?? null;
    holders['time_mais_amado'] = highlights.timeMaisAmado
      ? teamSlug(highlights.timeMaisAmado.teamName)
      : null;

    const goleadores = highlights.goleadorOverall?.length
      ? highlights.goleadorOverall
      : highlights.goleador.sub30;
    for (const entry of goleadores) {
      if (!entry.userId) continue;
      holders[`goleador:${entry.userId}`] = entry.userId;
    }

    return holders;
  }

  private tenureLabelFromSync(
    tenures: Record<string, { sinceAt?: string }> | undefined,
    highlightKey: string
  ): string | undefined {
    const sinceAt = tenures?.[highlightKey]?.sinceAt;
    if (!sinceAt) return undefined;
    const label = formatHighlightTenure(sinceAt);
    return label || undefined;
  }

  private withTenureLabel(
    entry: MuralShowcaseEntry | null,
    highlightKey: string,
    tenures: Record<string, { sinceAt?: string }> | undefined
  ): MuralShowcaseEntry | null {
    if (!entry) return null;
    const tenureLabel = this.tenureLabelFromSync(tenures, highlightKey);
    return tenureLabel ? { ...entry, tenureLabel } : entry;
  }

  private async applyAppBucketTenureLabels(
    highlights: MuralHighlights,
    bucket: 'merged' | 'pelada' | 'team_match'
  ): Promise<MuralHighlights> {
    const holders = this.buildAppBucketTenureHolders(highlights);
    let tenures: Record<string, { sinceAt?: string }> | undefined;
    try {
      const result = (await Parse.Cloud.run('syncMuralHighlightTenures', {
        bucket,
        holders,
      })) as { tenures?: Record<string, { sinceAt?: string }> };
      tenures = result?.tenures;
    } catch {
      return highlights;
    }

    const goleadorSub30 = highlights.goleador.sub30.map((entry) =>
      this.withTenureLabel(entry, `goleador:${entry.userId}`, tenures)
    ) as MuralShowcaseEntry[];
    const goleadorOverall = (highlights.goleadorOverall ?? goleadorSub30).map((entry) =>
      this.withTenureLabel(entry, `goleador:${entry.userId}`, tenures)
    ) as MuralShowcaseEntry[];

    let timeMaisAmado: MuralFavoriteTeamEntry | null = highlights.timeMaisAmado ?? null;
    if (timeMaisAmado) {
      const tenureLabel = this.tenureLabelFromSync(tenures, 'time_mais_amado');
      if (tenureLabel) {
        timeMaisAmado = { ...timeMaisAmado, tenureLabel };
      }
    }

    return {
      ...highlights,
      craque: {
        ...highlights.craque,
        sub30: this.withTenureLabel(highlights.craque.sub30, 'craque', tenures),
      },
      goleador: { ...highlights.goleador, sub30: goleadorSub30 },
      goleadorOverall,
      melhorGoleiro: {
        ...highlights.melhorGoleiro,
        sub30: this.withTenureLabel(highlights.melhorGoleiro.sub30, 'melhor_goleiro', tenures),
      },
      melhorJuiz: this.withTenureLabel(highlights.melhorJuiz, 'melhor_juiz', tenures),
      promessa: this.withTenureLabel(highlights.promessa, 'promessa', tenures),
      master: this.withTenureLabel(highlights.master, 'master', tenures),
      timeMaisAmado,
    };
  }
}
