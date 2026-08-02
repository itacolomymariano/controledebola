import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import {
  AthletePublicProfile,
  AthleteSearchResult,
} from '../models/athlete-search.model';
import { EventInviteCandidate } from '../models/event-hiring.model';
import { normalizeSearchText } from '../utils/search-text.util';
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
          `${candidate.userName} ${candidate.apelido} ${candidate.city ?? ''} ${candidate.state ?? ''}`
        );
        return haystack.includes(normalizedSearch);
      })
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

  async search(query: string): Promise<AthleteSearchResult[]> {
    const normalized = normalizeSearchText(query);
    if (!normalized) {
      return [];
    }

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

    const serverResults = await this.searchOnServer(query.trim());
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

  async getPublicProfile(userId: string): Promise<AthletePublicProfile | null> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;

    if (this.cloudAthleteFunctionsAvailable) {
      try {
        const result = await Parse.Cloud.run('getAthletePublicProfile', {
          userId: normalizedUserId,
        });
        if (result) return result as AthletePublicProfile;
      } catch {
        this.cloudAthleteFunctionsAvailable = false;
      }
    }

    return this.getPublicProfileClient(normalizedUserId);
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

  private async searchOnServer(query: string): Promise<AthleteSearchResult[]> {
    const byUserId = new Map<string, AthleteSearchResult>();

    const profileQueries = [
      this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'userApelido', query),
      this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'userName', query),
      this.matchesQueryForClass(ATHLETE_PROFILE_CLASS, 'primaryPosition', query),
    ];

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
      const performances = await new Parse.Query('EventPerformance')
        .equalTo('user', userPtr)
        .limit(2000)
        .find();

      let goals = 0;
      let yellowCards = 0;
      let redCards = 0;
      for (const perf of performances) {
        goals += Number(perf.get('goals') ?? 0);
        yellowCards += Number(perf.get('yellowCards') ?? 0);
        redCards += Number(perf.get('redCards') ?? 0);
      }

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
