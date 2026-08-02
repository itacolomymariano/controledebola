import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  computePerformanceScore,
  CreateEventPerformancePayload,
  EventPerformance,
  MuralTargetRole,
} from '../models/event-performance.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import {
  getEffectiveGoalsFromParse,
  resolvePerformanceUserId,
} from '../utils/effective-performance.util';
import { ParseService } from './parse.service';

const CLASS = 'EventPerformance';

@Injectable({ providedIn: 'root' })
export class EventPerformanceService {
  constructor(private readonly parseService: ParseService) {
    this.parseService.init();
  }

  async listForEvent(eventId: string): Promise<EventPerformance[]> {
    const event = Parse.Object.extend('Event');
    const eventPtr = event.createWithoutData(eventId);

    const query = new Parse.Query(CLASS);
    query.equalTo('event', eventPtr);
    query.include('user');
    query.limit(500);
    const results = await query.find();
    return results.map((obj) => this.toPerformance(obj));
  }

  async listForPelada(peladaId: string): Promise<EventPerformance[]> {
    const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);

    const eventQuery = new Parse.Query('Event');
    eventQuery.equalTo('pelada', peladaPtr);
    eventQuery.limit(500);
    const events = await eventQuery.find();
    const eventPtrs = events.map((event) => event);

    const byPelada = new Parse.Query(CLASS);
    byPelada.equalTo('pelada', peladaPtr);

    const queries = [byPelada];
    if (eventPtrs.length) {
      const byEvent = new Parse.Query(CLASS);
      byEvent.containedIn('event', eventPtrs);
      queries.push(byEvent);
    }

    const combined = Parse.Query.or(...queries);
    combined.include('user');
    combined.limit(3000);
    const results = await combined.find();
    return this.dedupePerformances(results.map((obj) => this.toPerformance(obj)));
  }

  async listForApp(): Promise<EventPerformance[]> {
    const query = new Parse.Query(CLASS);
    query.include('user');
    query.limit(3000);
    const results = await query.find();
    return this.dedupePerformances(results.map((obj) => this.toPerformance(obj)));
  }

  async upsert(payload: CreateEventPerformancePayload): Promise<EventPerformance> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const eventQuery = new Parse.Query('Event');
    eventQuery.include(['admin', 'pelada']);
    const eventObj = await eventQuery.get(payload.eventId);
    const admin = eventObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador do evento pode registrar desempenho.');
    }

    const targetUser = Parse.User.createWithoutData(payload.userId);
    const pelada = eventObj.get('pelada') as Parse.Object | undefined;

    const existingQuery = new Parse.Query(CLASS);
    existingQuery.equalTo('event', eventObj);
    existingQuery.equalTo('user', targetUser);
    let perfObj = await existingQuery.first();

    if (!perfObj) {
      perfObj = new Parse.Object(CLASS);
      perfObj.set('event', eventObj);
      perfObj.set('user', targetUser);
      if (pelada) perfObj.set('pelada', pelada);
    }

    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(false);
    perfObj.setACL(acl);

    perfObj.set('role', payload.role);
    perfObj.set('goals', Math.max(0, payload.goals ?? 0));
    perfObj.set('assists', Math.max(0, payload.assists ?? 0));
    perfObj.set('saves', Math.max(0, payload.saves ?? 0));
    perfObj.set('yellowCards', Math.max(0, payload.yellowCards ?? 0));
    perfObj.set('redCards', Math.max(0, payload.redCards ?? 0));
    perfObj.set(
      'points',
      Math.max(0, payload.goals ?? 0) * 3 +
        Math.max(0, payload.assists ?? 0) * 2 +
        Math.max(0, payload.saves ?? 0) * 2
    );

    try {
      const saved = await perfObj.save();
      await saved.fetchWithInclude('user');
      return this.toPerformance(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  aggregateByUserAndRole(performances: EventPerformance[]): Map<string, number> {
    const scores = new Map<string, number>();
    for (const perf of performances) {
      const key = `${perf.userId}:${perf.role}`;
      const score = computePerformanceScore(perf);
      scores.set(key, (scores.get(key) ?? 0) + score);
    }
    return scores;
  }

  private dedupePerformances(performances: EventPerformance[]): EventPerformance[] {
    const byKey = new Map<string, EventPerformance>();
    for (const perf of performances) {
      const key = perf.objectId || `${perf.eventId}:${perf.userId}:${perf.role}`;
      if (!byKey.has(key)) {
        byKey.set(key, perf);
      }
    }
    return [...byKey.values()];
  }

  private toPerformance(obj: Parse.Object): EventPerformance {
    const user = obj.get('user') as Parse.User | undefined;
    const event = obj.get('event') as Parse.Object | undefined;
    const pelada = obj.get('pelada') as Parse.Object | undefined;
    const userId = resolvePerformanceUserId(obj);
    const userName = user
      ? (user.get('name') as string) || user.getUsername() || 'Usuario'
      : 'Participante';
    return {
      objectId: obj.id!,
      eventId: event?.id ?? '',
      peladaId: pelada?.id,
      userId,
      userName,
      role: obj.get('role') as MuralTargetRole,
      goals: getEffectiveGoalsFromParse(obj),
      assists: Number(obj.get('assists') ?? 0),
      saves: Number(obj.get('saves') ?? 0),
      yellowCards: Number(obj.get('yellowCards') ?? 0),
      redCards: Number(obj.get('redCards') ?? 0),
      points: Number(obj.get('points') ?? 0),
      shotsOffTarget: Number(obj.get('shotsOffTarget') ?? 0),
      shotsOnTarget: Number(obj.get('shotsOnTarget') ?? 0),
      foulsCommitted: Number(obj.get('foulsCommitted') ?? 0),
      foulsSuffered: Number(obj.get('foulsSuffered') ?? 0),
      ownGoals: Number(obj.get('ownGoals') ?? 0),
      passesCompleted: Number(obj.get('passesCompleted') ?? 0),
      passesMissed: Number(obj.get('passesMissed') ?? 0),
    };
  }
}
