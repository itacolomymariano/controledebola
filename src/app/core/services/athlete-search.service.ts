import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import {
  AthleteActivityIndicators,
  TeamMatchRecord,
  AthletePublicProfile,
  AthleteSearchResult,
} from '../models/athlete-search.model';
import { EventInviteCandidate } from '../models/event-hiring.model';
import { normalizeSearchText } from '../utils/search-text.util';
import { FOOTBALL_POSITIONS } from '../models/athlete-profile.model';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import {
  readUserAmateurFootballIdol,
  readUserFavoriteAmateurTeam,
  readUserFavoriteProTeam,
  readUserProFootballIdol,
} from '../utils/user-personal-profile.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const ATHLETE_PROFILE_CLASS = 'AthleteProfile';
const EVENT_REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class AthleteSearchService {
  private catalogCache: AthleteSearchResult[] | null = null;
  private catalogLoadPromise: Promise<AthleteSearchResult[]> | null = null;
  private cloudAthleteFunctionsAvailable = true;

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async preloadCatalog(): Promise<void> {
    await this.loadCatalog();
  }

  async listHiringCandidates(): Promise<EventInviteCandidate[]> {
    return this.fetchHiringCandidatesFromCloud('');
  }

  async searchHiringCandidates(
    query: string,
    baseCandidates: EventInviteCandidate[] = []
  ): Promise<EventInviteCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return baseCandidates.length ? baseCandidates : await this.listHiringCandidates();
    }

    const positionMatches = await this.searchHiringCandidatesByPosition(trimmed);
    if (positionMatches.length) {
      return positionMatches;
    }

    const localMatches = this.filterHiringCandidates(baseCandidates, trimmed);
    const cloudMatches = await this.fetchHiringCandidatesFromCloud(trimmed);

    if (!cloudMatches.length) {
      return localMatches;
    }

    const merged = new Map<string, EventInviteCandidate>();
    for (const candidate of localMatches) {
      merged.set(candidate.userId, candidate);
    }
    for (const candidate of cloudMatches) {
      merged.set(candidate.userId, candidate);
    }

    return Array.from(merged.values()).sort((a, b) =>
      (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
    );
  }

  filterHiringCandidates(candidates: EventInviteCandidate[], search: string): EventInviteCandidate[] {
    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) return candidates;

    return candidates
      .filter((candidate) => {
        const haystack = normalizeSearchText(
          `${candidate.userName} ${candidate.apelido} ${candidate.primaryPosition ?? ''} ${candidate.city ?? ''} ${candidate.state ?? ''}`
        );
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR'));
  }

  /** Busca por posicao principal (mesma lista da aba Buscar). */
  private async searchHiringCandidatesByPosition(query: string): Promise<EventInviteCandidate[]> {
    const normalized = normalizeSearchText(query);
    if (!normalized || normalized.length < 3) return [];

    const exact = FOOTBALL_POSITIONS.find((position) => normalizeSearchText(position) === normalized);
    const partial = FOOTBALL_POSITIONS.filter((position) =>
      normalizeSearchText(position).includes(normalized)
    );
    const position = exact || (partial.length === 1 ? partial[0] : '');
    if (!position) return [];

    const rows = await this.search('', position);
    return rows
      .map((row) => this.mapSearchResultToInviteCandidate(row))
      .sort((a, b) => (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR'));
  }

  private mapSearchResultToInviteCandidate(
    row: AthleteSearchResult & { peladaRate?: number; teamMatchRate?: number },
    profile?: AthletePublicProfile | null
  ): EventInviteCandidate {
    return {
      userId: row.userId,
      userName: row.fullName || row.displayName,
      apelido: row.apelido || row.displayName,
      avatarUrl: row.avatarUrl,
      city: row.city,
      state: row.state,
      primaryPosition: row.primaryPosition || profile?.primaryPosition,
      peladaRate: row.peladaRate ?? profile?.peladaRate,
      matchRate: row.teamMatchRate ?? profile?.teamMatchRate,
    };
  }

  private async fetchHiringCandidatesFromCloud(query: string): Promise<EventInviteCandidate[]> {
    const trimmed = query.trim();
    try {
      const result = await Parse.Cloud.run('listAthleteHiringCandidates', { query: trimmed });
      if (Array.isArray(result)) {
        return this.mapCloudHiringRows(result);
      }
    } catch (error) {
      console.warn('listAthleteHiringCandidates failed', error);
    }

    try {
      const fallback = await Parse.Cloud.run('searchAthletes', { query: trimmed });
      if (Array.isArray(fallback) && fallback.length) {
        return this.mapSearchAthletesToHiringCandidates(fallback);
      }
    } catch (error) {
      console.warn('searchAthletes fallback failed', error);
    }

    const catalog = await this.loadCatalog();
    const candidates: EventInviteCandidate[] = [];
    for (const entry of catalog.slice(0, 500)) {
      if (!entry.userId) continue;
      candidates.push(this.mapSearchResultToInviteCandidate(entry));
    }
    return trimmed
      ? this.filterHiringCandidates(candidates, trimmed)
      : candidates.sort((a, b) =>
          (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
        );
  }

  private mapCloudHiringRows(rows: unknown[]): EventInviteCandidate[] {
    return rows.map((entry) => {
      const row = entry as EventInviteCandidate;
      return {
        userId: String(row.userId || ''),
        userName: String(row.userName || 'Atleta'),
        apelido: String(row.apelido || row.userName || 'Atleta'),
        avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
        city: row.city ? String(row.city) : undefined,
        state: row.state ? String(row.state) : undefined,
        peladaRate:
          row.peladaRate != null && !Number.isNaN(Number(row.peladaRate))
            ? Number(row.peladaRate)
            : undefined,
        matchRate:
          row.matchRate != null && !Number.isNaN(Number(row.matchRate))
            ? Number(row.matchRate)
            : undefined,
        primaryPosition: row.primaryPosition ? String(row.primaryPosition) : undefined,
      };
    });
  }

  private mapSearchAthletesToHiringCandidates(rows: unknown[]): EventInviteCandidate[] {
    const candidates: EventInviteCandidate[] = [];
    for (const entry of rows) {
      const row = entry as AthleteSearchResult & {
        peladaRate?: number;
        teamMatchRate?: number;
      };
      if (!row.userId) continue;
      candidates.push(this.mapSearchResultToInviteCandidate(row));
    }
    return candidates;
  }

  async search(query: string, primaryPosition?: string): Promise<AthleteSearchResult[]> {
    const normalized = normalizeSearchText(query);
    const position = primaryPosition?.trim() || '';
    if (!normalized && !position) {
      return [];
    }

    let results: AthleteSearchResult[] = [];
    if (position) {
      const byPosition = await this.searchProfilesByExactPosition(position);
      results = normalized
        ? byPosition.filter((entry) => this.matchesNameQuery(entry, normalized))
        : byPosition;
    }

    if (normalized) {
      const textResults = await this.searchByText(query, normalized, position);
      const compatible = position
        ? textResults.filter(
            (entry) =>
              this.samePosition(entry.primaryPosition, position) &&
              this.matchesNameQuery(entry, normalized)
          )
        : textResults;
      results = this.mergeResultLists(results, compatible);
    }

    const ranked = normalized
      ? this.rankResults(results, normalized)
      : [...results]
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
          .slice(0, 100);
    await this.attachBodyMeasures(ranked);
    return ranked;
  }

  /** Busca textual existente (nome, apelido e, sem filtro de posicao, primaryPosition). */
  private async searchByText(
    query: string,
    normalized: string,
    position = ''
  ): Promise<AthleteSearchResult[]> {
    try {
      if (this.cloudAthleteFunctionsAvailable) {
        const cloudResults = await Parse.Cloud.run('searchAthletes', { query: query.trim() });
        if (Array.isArray(cloudResults) && cloudResults.length) {
          const ranked = this.rankResults(cloudResults as AthleteSearchResult[], normalized);
          this.mergeIntoCatalog(cloudResults as AthleteSearchResult[]);
          return ranked;
        }
      }
    } catch {
      this.cloudAthleteFunctionsAvailable = false;
    }

    const catalog = await this.loadCatalog();
    const localResults = this.filterAndRank(catalog, normalized);
    if (localResults.length) {
      return localResults;
    }

    const serverResults = await this.searchOnServer(query.trim(), position);
    this.mergeIntoCatalog(serverResults);
    const merged = new Map<string, AthleteSearchResult>();
    for (const entry of catalog) {
      if (entry.userId) merged.set(entry.userId, entry);
    }
    for (const entry of serverResults) {
      if (!entry.userId) continue;
      const existing = merged.get(entry.userId);
      merged.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    return this.filterAndRank(Array.from(merged.values()), normalized);
  }

  /** Igualdade da posicao principal (nao substring: Lateral direito != Lateral esquerdo). */
  private async searchProfilesByExactPosition(position: string): Promise<AthleteSearchResult[]> {
    try {
      const query = new Parse.Query(ATHLETE_PROFILE_CLASS);
      query.equalTo('primaryPosition', position);
      query.include('user');
      query.limit(100);
      const profiles = await query.find();
      const results = profiles
        .map((profile) => this.toSearchResultFromProfile(profile))
        .filter((entry) => entry.userId && this.samePosition(entry.primaryPosition, position));
      if (results.length) {
        this.mergeIntoCatalog(results);
        return results;
      }
    } catch {
      // CLP pode bloquear a classe; cai no catalogo.
    }

    const catalog = await this.loadCatalog();
    return catalog.filter((entry) => this.samePosition(entry.primaryPosition, position));
  }

  private samePosition(value: string | undefined, position: string): boolean {
    return (value ?? '').trim().toLowerCase() === position.trim().toLowerCase();
  }

  private matchesNameQuery(entry: AthleteSearchResult, normalized: string): boolean {
    if (!normalized) return true;
    const haystack = normalizeSearchText(
      `${entry.displayName} ${entry.apelido ?? ''} ${entry.fullName ?? ''}`
    );
    return haystack.includes(normalized);
  }

  private mergeResultLists(
    primary: AthleteSearchResult[],
    secondary: AthleteSearchResult[]
  ): AthleteSearchResult[] {
    const byUserId = new Map<string, AthleteSearchResult>();
    for (const entry of primary) {
      if (!entry.userId) continue;
      byUserId.set(entry.userId, entry);
    }
    for (const entry of secondary) {
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }
    return Array.from(byUserId.values());
  }

  private readMeasure(value: unknown): number | undefined {
    if (value == null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  private async attachBodyMeasures(results: AthleteSearchResult[]): Promise<void> {
    const pending = results.filter(
      (entry) => entry.userId && (entry.heightCm == null || entry.weightKg == null)
    );
    if (!pending.length) return;

    const ids = Array.from(new Set(pending.map((entry) => entry.userId)));
    let profiles: Parse.Object[] = [];
    try {
      const byUserId = new Parse.Query(ATHLETE_PROFILE_CLASS);
      byUserId.containedIn('userId', ids);
      const byUser = new Parse.Query(ATHLETE_PROFILE_CLASS);
      byUser.containedIn(
        'user',
        ids.map((id) => Parse.User.createWithoutData(id))
      );
      profiles = await Parse.Query.or(byUserId, byUser).limit(200).find();
    } catch {
      return;
    }

    const byId = new Map<string, Parse.Object>();
    for (const profile of profiles) {
      const user = profile.get('user') as Parse.User | undefined;
      const userId = ((profile.get('userId') as string | undefined) || user?.id || '').trim();
      if (userId && !byId.has(userId)) byId.set(userId, profile);
    }

    for (const entry of pending) {
      const profile = byId.get(entry.userId);
      if (!profile) continue;
      if (entry.heightCm == null) entry.heightCm = this.readMeasure(profile.get('height'));
      if (entry.weightKg == null) entry.weightKg = this.readMeasure(profile.get('weight'));
    }
  }

  async getPublicProfile(userId: string): Promise<AthletePublicProfile | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;

    let profile: AthletePublicProfile | null = null;
    if (this.cloudAthleteFunctionsAvailable) {
      try {
        const result = await Parse.Cloud.run('getAthletePublicProfile', {
          userId: normalizedUserId,
        });
        if (result) profile = result as AthletePublicProfile;
      } catch {
        this.cloudAthleteFunctionsAvailable = false;
      }
    }

    if (!profile) {
      profile = await this.getPublicProfileClient(normalizedUserId);
    }
    if (profile) {
      await this.fillBodyMeasuresOnProfile(profile);
    }
    return profile;
  }

  private async fillBodyMeasuresOnProfile(profile: AthletePublicProfile): Promise<void> {
    if (profile.heightCm != null && profile.weightKg != null) return;
    try {
      const athleteProfile = await this.findAthleteProfileForUser(profile.userId);
      if (!athleteProfile) return;
      if (profile.heightCm == null) {
        profile.heightCm = this.readMeasure(athleteProfile.get('height'));
      }
      if (profile.weightKg == null) {
        profile.weightKg = this.readMeasure(athleteProfile.get('weight'));
      }
    } catch {
      // Altura e peso sao opcionais na ficha.
    }
  }

  async getActivityIndicators(
    userId: string,
    months = 3
  ): Promise<AthleteActivityIndicators | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;
    try {
      const result = await Parse.Cloud.run('getAthleteActivityIndicators', {
        userId: normalizedUserId,
        months,
      });
      if (!result || typeof result !== 'object') return null;
      const row = result as Record<string, unknown>;
      return {
        windowStart: String(row['windowStart'] || ''),
        windowEnd: String(row['windowEnd'] || ''),
        months: Number(row['months'] || months),
        gamesPlayed: Number(row['gamesPlayed'] || 0),
        peladasPlayed: Number(row['peladasPlayed'] || 0),
        gamesAbsent: Number(row['gamesAbsent'] || 0),
        peladasAbsent: Number(row['peladasAbsent'] || 0),
        teamMatchInvitesReceived: Number(row['teamMatchInvitesReceived'] || 0),
        teamMatchInvitesDeclined: Number(row['teamMatchInvitesDeclined'] || 0),
        peladaInvitesReceived: Number(row['peladaInvitesReceived'] || 0),
        peladaInvitesDeclined: Number(row['peladaInvitesDeclined'] || 0),
      };
    } catch {
      return null;
    }
  }

  async getUserTeamMatchRecord(
    userId: string,
    roleContext: 'athlete' | 'coach' = 'athlete'
  ): Promise<TeamMatchRecord | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;
    try {
      const result = await Parse.Cloud.run('getUserTeamMatchRecord', {
        userId: normalizedUserId,
        roleContext,
      });
      return this.mapTeamMatchRecord(result);
    } catch {
      return null;
    }
  }

  async getPresidentTeamMatchRecord(userId: string): Promise<TeamMatchRecord | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;
    try {
      const result = await Parse.Cloud.run('getPresidentTeamMatchRecord', {
        userId: normalizedUserId,
      });
      return this.mapTeamMatchRecord(result);
    } catch {
      return null;
    }
  }

  private mapTeamMatchRecord(raw: unknown): TeamMatchRecord | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    return {
      matchesPlayed: Number(row['matchesPlayed'] || 0),
      wins: Number(row['wins'] || 0),
      losses: Number(row['losses'] || 0),
      draws: Number(row['draws'] || 0),
      winRatePercent: Number(row['winRatePercent'] || 0),
      teamsPresided:
        row['teamsPresided'] != null ? Number(row['teamsPresided']) : undefined,
    };
  }

  private async loadCatalog(): Promise<AthleteSearchResult[]> {
    if (this.catalogCache) {
      return this.catalogCache;
    }

    if (!this.catalogLoadPromise) {
      this.catalogLoadPromise = this.loadCatalogFromServer();
    }

    return this.catalogLoadPromise;
  }

  private async loadCatalogFromServer(): Promise<AthleteSearchResult[]> {
    const byUserId = new Map<string, AthleteSearchResult>();

    if (this.cloudAthleteFunctionsAvailable) {
      try {
        const cloudCatalog = await Parse.Cloud.run('searchAthletes', { query: '' });
        if (Array.isArray(cloudCatalog)) {
          for (const entry of cloudCatalog as AthleteSearchResult[]) {
            if (!entry.userId) continue;
            const existing = byUserId.get(entry.userId);
            byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
          }
        }
      } catch {
        this.cloudAthleteFunctionsAvailable = false;
      }
    }

    const profileEntries = await this.loadFromAthleteProfiles();
    for (const entry of profileEntries) {
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    const registrationEntries = await this.loadFromEventRegistrations();
    for (const entry of registrationEntries) {
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    this.catalogCache = Array.from(byUserId.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR')
    );
    return this.catalogCache;
  }

  private async loadFromAthleteProfiles(): Promise<AthleteSearchResult[]> {
    const query = new Parse.Query(ATHLETE_PROFILE_CLASS);
    query.include('user');
    query.limit(1000);
    const profiles = await query.find();

    return profiles
      .map((profile) => this.toSearchResultFromProfile(profile))
      .filter((entry) => entry.userId);
  }

  private async loadFromEventRegistrations(): Promise<AthleteSearchResult[]> {
    const query = new Parse.Query(EVENT_REGISTRATION_CLASS);
    query.equalTo('role', 'athlete');
    query.descending('createdAt');
    query.limit(2000);
    const registrations = await query.find();

    const byUserId = new Map<string, AthleteSearchResult>();
    for (const registration of registrations) {
      const entry = this.toSearchResultFromRegistration(registration);
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    return Array.from(byUserId.values());
  }

  private async searchOnServer(query: string, position = ''): Promise<AthleteSearchResult[]> {
    const byUserId = new Map<string, AthleteSearchResult>();

    const profileQueries = [
      this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'userApelido', query),
      this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'userName', query),
    ];
    if (position) {
      for (const profileQuery of profileQueries) {
        profileQuery.equalTo('primaryPosition', position);
      }
    } else {
      profileQueries.push(
        this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'primaryPosition', query)
      );
    }

    const profileResults = await Parse.Query.or(...profileQueries).limit(200).find();
    for (const profile of profileResults) {
      const entry = this.toSearchResultFromProfile(profile);
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    const registrationQueries = [
      this.matchesRegistrationQuery('apelido', query),
      this.matchesRegistrationQuery('userApelido', query),
      this.matchesRegistrationQuery('userDisplayName', query),
      this.matchesRegistrationQuery('userFullName', query),
    ];

    const registrationResults = await Parse.Query.or(...registrationQueries).limit(200).find();
    for (const registration of registrationResults) {
      const entry = this.toSearchResultFromRegistration(registration);
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    return Array.from(byUserId.values());
  }

  private matchesQueryForClass(className: string, field: string, query: string): Parse.Query {
    const q = new Parse.Query(className);
    q.matches(field, query, 'i');
    return q;
  }

  private matchesRegistrationQuery(field: string, query: string): Parse.Query {
    const q = new Parse.Query(EVENT_REGISTRATION_CLASS);
    q.equalTo('role', 'athlete');
    q.matches(field, query, 'i');
    return q;
  }

  private mergeIntoCatalog(entries: AthleteSearchResult[]): void {
    if (!entries.length) return;

    const byUserId = new Map<string, AthleteSearchResult>();
    for (const entry of this.catalogCache ?? []) {
      if (entry.userId) byUserId.set(entry.userId, entry);
    }
    for (const entry of entries) {
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }
    this.catalogCache = Array.from(byUserId.values());
  }

  private mergeEntries(
    primary: AthleteSearchResult,
    secondary: AthleteSearchResult
  ): AthleteSearchResult {
    const displayName =
      this.pickRicherText(primary.displayName, secondary.displayName) ??
      primary.displayName ??
      secondary.displayName ??
      'Atleta';
    const primaryPosition =
      this.pickRicherText(primary.primaryPosition, secondary.primaryPosition) ?? '';

    return {
      userId: primary.userId,
      displayName,
      apelido: this.pickRicherText(primary.apelido, secondary.apelido),
      fullName: this.pickRicherText(primary.fullName, secondary.fullName),
      primaryPosition,
      city: primary.city || secondary.city,
      state: primary.state || secondary.state,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      heightCm: primary.heightCm ?? secondary.heightCm,
      weightKg: primary.weightKg ?? secondary.weightKg,
    };
  }

  private pickRicherText(a?: string, b?: string): string | undefined {
    const left = a?.trim();
    const right = b?.trim();
    if (!left) return right || undefined;
    if (!right) return left;
    return left.length >= right.length ? left : right;
  }

  private filterAndRank(catalog: AthleteSearchResult[], normalized: string): AthleteSearchResult[] {
    const filtered = catalog.filter((entry) => this.matchesQuery(entry, normalized));
    return this.rankResults(filtered, normalized);
  }

  private matchesQuery(entry: AthleteSearchResult, normalized: string): boolean {
    const haystack = normalizeSearchText(
      `${entry.displayName} ${entry.apelido ?? ''} ${entry.fullName ?? ''} ${entry.primaryPosition} ${entry.city ?? ''} ${entry.state ?? ''}`
    );
    return haystack.includes(normalized);
  }

  private rankResults(results: AthleteSearchResult[], normalized: string): AthleteSearchResult[] {
    return [...results]
      .sort((a, b) => {
        const scoreDiff = this.relevanceScore(b, normalized) - this.relevanceScore(a, normalized);
        if (scoreDiff !== 0) return scoreDiff;
        return a.displayName.localeCompare(b.displayName, 'pt-BR');
      })
      .slice(0, 100);
  }

  private relevanceScore(entry: AthleteSearchResult, normalized: string): number {
    const fields = [entry.displayName, entry.apelido, entry.fullName, entry.primaryPosition]
      .filter(Boolean)
      .map((value) => normalizeSearchText(String(value)));

    let best = 0;
    for (const field of fields) {
      if (field === normalized) best = Math.max(best, 100);
      else if (field.startsWith(normalized)) best = Math.max(best, 80);
      else if (field.includes(normalized)) best = Math.max(best, 50);
    }
    return best;
  }

  private toSearchResultFromProfile(profile: Parse.Object): AthleteSearchResult {
    const user = profile.get('user') as Parse.User | undefined;
    const userId = (profile.get('userId') as string | undefined) || user?.id || '';
    const apelido =
      (profile.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string | undefined)?.trim() ||
      '';
    const fullName = (user?.get('name') as string | undefined)?.trim() || '';
    const displayName =
      (profile.get('userName') as string | undefined)?.trim() ||
      apelido ||
      fullName ||
      user?.getUsername() ||
      'Atleta';
    const address = (user?.get('address') as Address | undefined) ?? undefined;

    return {
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      primaryPosition: (profile.get('primaryPosition') as string) || '',
      city:
        (profile.get('userCity') as string | undefined)?.trim() ||
        address?.city?.trim() ||
        undefined,
      state:
        (profile.get('userState') as string | undefined)?.trim() ||
        address?.state?.trim() ||
        undefined,
      avatarUrl:
        (profile.get('userAvatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
      heightCm: this.readMeasure(profile.get('height')),
      weightKg: this.readMeasure(profile.get('weight')),
    };
  }

  private toSearchResultFromRegistration(registration: Parse.Object): AthleteSearchResult {
    const user = registration.get('user') as Parse.User | undefined;
    const userId =
      (registration.get('participantUserId') as string | undefined)?.trim() ||
      user?.id ||
      '';
    const apelido =
      (registration.get('apelido') as string | undefined)?.trim() ||
      (registration.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string | undefined)?.trim() ||
      '';
    const fullName =
      (registration.get('userFullName') as string | undefined)?.trim() ||
      (user?.get('name') as string | undefined)?.trim() ||
      '';
    const displayName =
      (registration.get('userDisplayName') as string | undefined)?.trim() ||
      apelido ||
      fullName ||
      user?.getUsername() ||
      'Atleta';

    return {
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      primaryPosition: '',
      avatarUrl:
        (registration.get('avatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
    };
  }

  private async getPublicProfileClient(userId: string): Promise<AthletePublicProfile | null> {
    try {
      if (!this.catalogCache) {
        await this.loadCatalog();
      }

      const catalogEntry = this.catalogCache?.find((entry) => entry.userId === userId);

      const athleteProfile = await this.findAthleteProfileForUser(userId);
      const registrations = await this.loadRegistrationsForUser(userId);

      if (!athleteProfile && !registrations.length) {
        return null;
      }

      let user: Parse.User | null = null;
      try {
        user = await new Parse.Query(Parse.User).get(userId);
      } catch {
        user = null;
      }

      const userPtr = Parse.User.createWithoutData(userId);
      const performances = await this.loadPerformancesForUser(userId);
      const sumulaTotals = this.sumRefereeSumulaStatsClient(performances, userId);
      const goals = sumulaTotals.goals;
      const yellowCards = sumulaTotals.yellowCards;
      const redCards = sumulaTotals.redCards;

      const peladaNames = new Set<string>();
      const teamNames = new Set<string>();
      for (const registration of registrations) {
        const event = registration.get('event') as Parse.Object | undefined;
        if (!event) continue;
        const pelada = event.get('pelada') as Parse.Object | undefined;
        if (pelada?.get('name')) {
          peladaNames.add(pelada.get('name') as string);
        }
        const homeTeamName = event.get('homeTeamName') as string | undefined;
        const awayTeamName = event.get('awayTeamName') as string | undefined;
        if (homeTeamName) teamNames.add(homeTeamName);
        if (awayTeamName) teamNames.add(awayTeamName);
      }

      const amateurTeams = await new Parse.Query('AmateurTeam')
        .equalTo('president', userPtr)
        .limit(20)
        .find();
      for (const team of amateurTeams) {
        const name = team.get('name') as string | undefined;
        if (name) teamNames.add(name);
      }

      const registration = registrations[0];
      const apelido =
        (user?.get('apelido') as string | undefined)?.trim() ||
        (registration?.get('apelido') as string | undefined)?.trim() ||
        (registration?.get('userApelido') as string | undefined)?.trim() ||
        catalogEntry?.apelido?.trim() ||
        '';
      const fullName =
        (user?.get('name') as string | undefined)?.trim() ||
        (registration?.get('userFullName') as string | undefined)?.trim() ||
        catalogEntry?.fullName?.trim() ||
        '';
      const displayName =
        catalogEntry?.displayName ||
        (registration?.get('userDisplayName') as string | undefined)?.trim() ||
        apelido ||
        fullName ||
        'Atleta';

      const address = (user?.get('address') as Address | undefined) ?? undefined;
      const birthDate = user?.get('birthDate') as Date | undefined;

      return {
        userId,
        displayName,
        apelido: apelido || undefined,
        fullName: fullName || undefined,
        avatarUrl:
          catalogEntry?.avatarUrl ||
          (athleteProfile?.get('userAvatarUrl') as string | undefined)?.trim() ||
          (registration?.get('avatarUrl') as string | undefined)?.trim() ||
          getUserAvatarUrl(user, this.parseFileService) ||
          undefined,
        state: address?.state || catalogEntry?.state || undefined,
        city: address?.city || catalogEntry?.city || undefined,
        neighborhood: address?.neighborhood || undefined,
        age: birthDate ? this.calcAge(birthDate) : undefined,
        peladas: Array.from(peladaNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        teams: Array.from(teamNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        favoriteProTeam: readUserFavoriteProTeam(
          user,
          athleteProfile?.get('favoriteProTeam') as string | undefined
        ),
        favoriteAmateurTeam: readUserFavoriteAmateurTeam(
          user,
          amateurTeams[0]?.get('name') as string | undefined
        ),
        goals,
        yellowCards,
        redCards,
        proFootballIdol: readUserProFootballIdol(user),
        amateurFootballIdol: readUserAmateurFootballIdol(user),
        craquePeladas: [],
        phone: user?.get('showPhoneInProfile')
          ? ((user?.get('phone') as string | undefined)?.trim() || undefined)
          : undefined,
        email: user?.get('showEmailInProfile')
          ? ((user?.get('email') as string | undefined)?.trim() || undefined)
          : undefined,
        phoneVisible: !!user?.get('showPhoneInProfile'),
        emailVisible: !!user?.get('showEmailInProfile'),
        peladaRate: athleteProfile?.get('peladaRate') as number | undefined,
        teamMatchRate: athleteProfile?.get('teamMatchRate') as number | undefined,
        primaryPosition:
          (athleteProfile?.get('primaryPosition') as string | undefined) ||
          catalogEntry?.primaryPosition ||
          '',
        heightCm: athleteProfile ? this.readMeasure(athleteProfile.get('height')) : undefined,
        weightKg: athleteProfile ? this.readMeasure(athleteProfile.get('weight')) : undefined,
      };
    } catch {
      return null;
    }
  }

  private async findAthleteProfileForUser(userId: string): Promise<Parse.Object | null> {
    const byUserIdField = new Parse.Query(ATHLETE_PROFILE_CLASS);
    byUserIdField.equalTo('userId', userId);
    const byField = await byUserIdField.first();
    if (byField) return byField;

    const userPtr = Parse.User.createWithoutData(userId);
    const byUser = new Parse.Query(ATHLETE_PROFILE_CLASS);
    byUser.equalTo('user', userPtr);
    const byUserProfile = await byUser.first();
    return byUserProfile ?? null;
  }

  private async loadPerformancesForUser(userId: string): Promise<Parse.Object[]> {
    const userPtr = Parse.User.createWithoutData(userId);
    const byUser = new Parse.Query('EventPerformance');
    byUser.equalTo('user', userPtr);
    const byParticipant = new Parse.Query('EventPerformance');
    byParticipant.equalTo('participantUserId', userId);
    const rows = await Parse.Query.or(byUser, byParticipant).limit(2000).find();
    const seen = new Set<string>();
    return rows.filter((perf) => {
      if (!perf.id || seen.has(perf.id)) return false;
      seen.add(perf.id);
      return true;
    });
  }

  private performanceRowMatchesUser(perf: Parse.Object, userId: string): boolean {
    const wanted = userId.trim();
    if (!wanted) return false;
    const explicit = String(perf.get('participantUserId') || '').trim();
    if (explicit === wanted) return true;
    const user = perf.get('user') as Parse.User | undefined;
    return !!(user?.id && user.id === wanted);
  }

  private hasRefereeSumulaDataClient(perf: Parse.Object): boolean {
    if (perf.get('refereeSumulaSaved')) return true;
    return (
      Number(perf.get('refereeGoals') || 0) > 0 ||
      Number(perf.get('refereeGoalsConceded') || 0) > 0 ||
      Number(perf.get('refereeYellowCards') || 0) > 0 ||
      Number(perf.get('refereeRedCards') || 0) > 0 ||
      Number(perf.get('refereeFoulsCommitted') || 0) > 0
    );
  }

  private readRefereeStatClient(perf: Parse.Object, field: 'goals' | 'yellowCards' | 'redCards'): number {
    const map: Record<string, string> = {
      goals: 'refereeGoals',
      yellowCards: 'refereeYellowCards',
      redCards: 'refereeRedCards',
    };
    const storage = map[field];
    const explicit = perf.get(storage);
    if (explicit !== undefined && explicit !== null) {
      return Number(explicit) || 0;
    }
    return 0;
  }

  private sumRefereeSumulaStatsClient(
    performances: Parse.Object[],
    userId: string
  ): { goals: number; yellowCards: number; redCards: number } {
    let goals = 0;
    let yellowCards = 0;
    let redCards = 0;
    for (const perf of performances) {
      if (!this.performanceRowMatchesUser(perf, userId)) continue;
      if (!this.hasRefereeSumulaDataClient(perf)) continue;
      goals += this.readRefereeStatClient(perf, 'goals');
      yellowCards += this.readRefereeStatClient(perf, 'yellowCards');
      redCards += this.readRefereeStatClient(perf, 'redCards');
    }
    return { goals, yellowCards, redCards };
  }

  private async loadRegistrationsForUser(userId: string): Promise<Parse.Object[]> {
    const userPtr = Parse.User.createWithoutData(userId);
    const byParticipantId = new Parse.Query(EVENT_REGISTRATION_CLASS);
    byParticipantId.equalTo('participantUserId', userId);
    byParticipantId.equalTo('role', 'athlete');

    const byUser = new Parse.Query(EVENT_REGISTRATION_CLASS);
    byUser.equalTo('user', userPtr);
    byUser.equalTo('role', 'athlete');

    const query = Parse.Query.or(byParticipantId, byUser);
    query.include('event');
    query.include('event.pelada');
    query.limit(2000);
    return query.find();
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
}
