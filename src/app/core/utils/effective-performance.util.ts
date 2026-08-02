import Parse from 'parse';
import { EventPerformance } from '../models/event-performance.model';
import { PeladaStatsConflictSource } from '../models/pelada.model';

const SCOUT_GOAL_TYPE_FIELDS = [
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
] as const;

function sumScoutTypedGoalsFromParse(obj: Parse.Object): number {
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(obj.get(field) ?? 0);
  }
  return total;
}

function readScoutGoalsFromParse(obj: Parse.Object): number {
  const scoutGoals = obj.get('scoutGoals');
  const goals = obj.get('goals');
  const fromScout =
    scoutGoals !== undefined && scoutGoals !== null
      ? Number(scoutGoals)
      : goals !== undefined && goals !== null
        ? Number(goals)
        : 0;
  return Math.max(fromScout, sumScoutTypedGoalsFromParse(obj));
}

function readRefereeGoalsFromParse(obj: Parse.Object): number {
  const refereeGoals = obj.get('refereeGoals');
  return refereeGoals !== undefined && refereeGoals !== null ? Number(refereeGoals) : 0;
}

function hasRefereeSumulaSaved(obj: Parse.Object): boolean {
  if (obj.get('refereeSumulaSaved')) return true;
  if (obj.get('refereeObservation')) return true;
  if (Number(obj.get('refereeGoals') ?? 0) > 0) return true;
  if (Number(obj.get('refereeYellowCards') ?? 0) > 0) return true;
  if (Number(obj.get('refereeRedCards') ?? 0) > 0) return true;
  if (Number(obj.get('refereeFoulsCommitted') ?? 0) > 0) return true;
  return false;
}

function hasScoutApontamentoSaved(obj: Parse.Object): boolean {
  if (obj.get('scoutApontamentoSaved')) return true;
  if (readScoutGoalsFromParse(obj) > 0) return true;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    if (Number(obj.get(field) ?? 0) > 0) return true;
  }
  return false;
}

export function resolveEffectiveGoalsFromParse(
  obj: Parse.Object,
  priority: PeladaStatsConflictSource = 'referee'
): number {
  const scoutGoals = readScoutGoalsFromParse(obj);
  const refereeGoals = readRefereeGoalsFromParse(obj);
  const scoutSaved = hasScoutApontamentoSaved(obj);
  const refereeSaved = hasRefereeSumulaSaved(obj);
  const useScoutFirst = priority === 'scout';

  if (useScoutFirst) {
    if (scoutSaved) return scoutGoals;
    if (refereeSaved) return refereeGoals;
  } else {
    if (refereeSaved) return refereeGoals;
    if (scoutSaved) return scoutGoals;
  }
  return Math.max(scoutGoals, refereeGoals);
}

export function resolvePerformanceUserId(obj: Parse.Object): string {
  const explicit = (obj.get('participantUserId') as string | undefined)?.trim();
  if (explicit) return explicit;

  const user = obj.get('user') as Parse.User | undefined;
  if (user?.id) return user.id;

  return '';
}

export function getEffectiveGoalsFromParse(obj: Parse.Object): number {
  return resolveEffectiveGoalsFromParse(obj, 'referee');
}

export function getEffectiveGoalsFromPerformance(perf: EventPerformance): number {
  return Number(perf.goals || 0);
}
