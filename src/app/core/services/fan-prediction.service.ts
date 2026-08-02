import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  CreateFanPredictionPayload,
  EventAthleteOption,
  FanPrediction,
  GoalScorerPrediction,
  PredictionRankingEntry,
} from '../models/fan-prediction.model';
import { MuralScope } from '../models/mural.model';
import { ParseService } from './parse.service';

const CLASS = 'FanPrediction';
const REGISTRATION_CLASS = 'EventRegistration';
const EVENT_CLASS = 'Event';

@Injectable({ providedIn: 'root' })
export class FanPredictionService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async getForEvent(eventId: string): Promise<FanPrediction | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    query.equalTo('user', user);
    const result = await query.first();
    return result ? this.toPrediction(result) : null;
  }

  async save(payload: CreateFanPredictionPayload): Promise<FanPrediction> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para salvar palpites.');

    const eventPtr = Parse.Object.extend(EVENT_CLASS).createWithoutData(payload.eventId);
    const existingQuery = new Parse.Query(CLASS);
    existingQuery.equalTo('event', eventPtr);
    existingQuery.equalTo('user', user);
    const existing = await existingQuery.first();

    const obj = existing ?? new Parse.Object(CLASS);
    if (!existing) {
      obj.set('user', user);
      obj.set('event', eventPtr);
    }

    this.applyPayload(obj, payload);
    const saved = await obj.save();
    return this.toPrediction(saved);
  }

  async getRankings(scope: MuralScope, scopeId?: string): Promise<PredictionRankingEntry[]> {
    try {
      const result = await Parse.Cloud.run('getPredictionRankings', {
        scope,
        scopeId,
        limit: 10,
      });
      const entries = (result as { entries?: unknown[] })?.entries;
      if (!Array.isArray(entries)) return [];
      return entries.map((row) => {
        const entry = row as PredictionRankingEntry;
        return {
          userId: String(entry.userId || ''),
          userName: String(entry.userName || 'Participante'),
          avatarUrl: entry.avatarUrl ? String(entry.avatarUrl) : undefined,
          totalScore: Number(entry.totalScore) || 0,
          eventsCount: Number(entry.eventsCount) || 0,
        };
      });
    } catch {
      return [];
    }
  }

  async listAthletesForEvent(eventId: string): Promise<EventAthleteOption[]> {
    try {
      const rows = await Parse.Cloud.run('listEventAthletesForPredictions', { eventId });
      if (Array.isArray(rows)) {
        return rows.map((row) => this.mapAthleteOption(row));
      }
    } catch (error) {
      console.warn('listEventAthletesForPredictions indisponivel, usando fallback.', error);
    }

    try {
      const rows = await Parse.Cloud.run('listEventParticipantsForVoting', { eventId });
      if (Array.isArray(rows)) {
        return rows
          .filter((row) => (row as { role?: string }).role === 'athlete')
          .map((row) => this.mapAthleteOption(row));
      }
    } catch {
      // fallback client-side abaixo
    }

    return this.listAthletesForEventClient(eventId);
  }

  isPrimaryGoalkeeperAthlete(athlete: EventAthleteOption): boolean {
    return (athlete.primaryPosition ?? '').toLowerCase() === 'goleiro';
  }

  private mapAthleteOption(row: unknown): EventAthleteOption {
    const entry = row as Record<string, unknown>;
    const apelidoRaw = String(entry['apelido'] || '');
    const userName = String(entry['userName'] || apelidoRaw || 'Atleta');
    return {
      userId: String(entry['userId'] || ''),
      userName,
      apelido: apelidoRaw || userName,
      avatarUrl: entry['avatarUrl'] ? String(entry['avatarUrl']) : undefined,
      primaryPosition: entry['primaryPosition'] ? String(entry['primaryPosition']) : undefined,
      secondaryPosition: entry['secondaryPosition']
        ? String(entry['secondaryPosition'])
        : undefined,
      thirdPosition: entry['thirdPosition'] ? String(entry['thirdPosition']) : undefined,
    };
  }

  private async listAthletesForEventClient(eventId: string): Promise<EventAthleteOption[]> {
    const query = new Parse.Query(REGISTRATION_CLASS);
    query.equalTo('event', Parse.Object.extend(EVENT_CLASS).createWithoutData(eventId));
    query.equalTo('role', 'athlete');
    query.include('user');
    query.include('athlete');
    query.ascending('createdAt');
    query.limit(500);
    const results = await query.find();

    const athletes: EventAthleteOption[] = [];
    const seen = new Set<string>();
    for (const row of results) {
      const user = row.get('user') as Parse.User | undefined;
      const userId = String(row.get('participantUserId') || user?.id || '');
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);

      const apelido = (row.get('apelido') as string) || (user?.get('apelido') as string) || '';
      const userName =
        apelido || (user?.get('name') as string) || user?.getUsername() || 'Atleta';
      const athleteProfile = row.get('athlete') as Parse.Object | undefined;
      const avatarUrl =
        ((row.get('avatarUrl') as string | undefined)?.trim() ||
          (user?.get('avatarUrl') as string | undefined)?.trim() ||
          '') || undefined;

      athletes.push({
        userId,
        userName,
        apelido: apelido || userName,
        avatarUrl,
        primaryPosition: athleteProfile?.get('primaryPosition') as string | undefined,
        secondaryPosition: athleteProfile?.get('secondaryPosition') as string | undefined,
        thirdPosition: athleteProfile?.get('thirdPosition') as string | undefined,
      });
    }

    return athletes;
  }

  splitAthletesByTeam(athletes: EventAthleteOption[]): {
    home: EventAthleteOption[];
    away: EventAthleteOption[];
  } {
    const mid = Math.ceil(athletes.length / 2);
    return {
      home: athletes.slice(0, mid),
      away: athletes.slice(mid),
    };
  }

  private applyPayload(obj: Parse.Object, payload: CreateFanPredictionPayload): void {
    const optionalString = (key: string, value?: string) => {
      const trimmed = value?.trim();
      if (trimmed) obj.set(key, trimmed);
      else obj.unset(key);
    };

    const optionalNumber = (key: string, value?: number) => {
      if (value !== undefined && value !== null && !Number.isNaN(value)) obj.set(key, value);
      else obj.unset(key);
    };

    optionalString('topScorerUserId', payload.topScorerUserId);
    optionalString('leastConcededKeeperUserId', payload.leastConcededKeeperUserId);
    optionalNumber('homeScore', payload.homeScore);
    optionalNumber('awayScore', payload.awayScore);
    optionalString('homeTeamName', payload.homeTeamName);
    optionalString('awayTeamName', payload.awayTeamName);

    if (payload.goalScorers?.length) {
      obj.set('goalScorers', payload.goalScorers);
    } else {
      obj.unset('goalScorers');
    }

    if (payload.expelledUserIds?.length) {
      obj.set('expelledUserIds', payload.expelledUserIds);
    } else {
      obj.unset('expelledUserIds');
    }

    if (payload.yellowCardUserIds?.length) {
      obj.set('yellowCardUserIds', payload.yellowCardUserIds);
    } else {
      obj.unset('yellowCardUserIds');
    }
  }

  private toPrediction(obj: Parse.Object): FanPrediction {
    const event = obj.get('event') as Parse.Object | undefined;
    return {
      objectId: obj.id!,
      eventId: event?.id ?? '',
      topScorerUserId: obj.get('topScorerUserId') as string | undefined,
      leastConcededKeeperUserId: obj.get('leastConcededKeeperUserId') as string | undefined,
      homeScore: obj.get('homeScore') as number | undefined,
      awayScore: obj.get('awayScore') as number | undefined,
      homeTeamName: obj.get('homeTeamName') as string | undefined,
      awayTeamName: obj.get('awayTeamName') as string | undefined,
      goalScorers: (obj.get('goalScorers') as GoalScorerPrediction[] | undefined) ?? [],
      expelledUserIds: (obj.get('expelledUserIds') as string[] | undefined) ?? [],
      yellowCardUserIds: (obj.get('yellowCardUserIds') as string[] | undefined) ?? [],
    };
  }
}
