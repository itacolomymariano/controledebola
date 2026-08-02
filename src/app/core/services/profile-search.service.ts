import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import { AthleteSearchResult } from '../models/athlete-search.model';
import {
  ProfileSearchResult,
  RolePublicProfile,
} from '../models/profile-search.model';
import { ProfileRole, PROFILE_ROLE_LABELS } from '../models/profile-role.model';
import {
  ProfessionalRole,
  RoleProfile,
  isProfessionalRole,
} from '../models/role-profile.model';
import { RoleParticipationHistory } from '../models/role-participation-history.model';
import { searchMatchesRoleKeyword } from '../utils/role-search.util';
import { normalizeSearchText } from '../utils/search-text.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import {
  readUserAmateurFootballIdol,
  readUserFavoriteProTeam,
  readUserProFootballIdol,
} from '../utils/user-personal-profile.util';
import { AthleteSearchService } from './athlete-search.service';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';
import { RoleProfileHistoryService } from './role-profile-history.service';

const ROLE_PROFILE_CLASS = 'RoleProfile';
const EVENT_REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class ProfileSearchService {
  private catalogCache = new Map<ProfileRole, ProfileSearchResult[]>();
  private catalogLoadPromises = new Map<ProfileRole, Promise<ProfileSearchResult[]>>();
  private cloudProfileFunctionsAvailable = true;

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService,
    private readonly athleteSearchService: AthleteSearchService,
    private readonly roleProfileHistoryService: RoleProfileHistoryService
  ) {
    this.parseService.init();
  }

  async preloadCatalog(role: ProfileRole): Promise<void> {
    await this.loadCatalog(role);
  }

  async listCatalog(role: ProfileRole): Promise<ProfileSearchResult[]> {
    return this.loadCatalog(role);
  }

  async search(role: ProfileRole, query: string): Promise<ProfileSearchResult[]> {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];

    if (role === 'athlete') {
      const athletes = await this.athleteSearchService.search(query);
      return athletes.map((entry) => this.fromAthleteResult(entry));
    }

    try {
      if (this.cloudProfileFunctionsAvailable) {
        const cloudResults = await Parse.Cloud.run('searchProfiles', {
          role,
          query: query.trim(),
        });
        if (Array.isArray(cloudResults) && cloudResults.length) {
          const ranked = this.filterAndRank(cloudResults as ProfileSearchResult[], normalized, role);
          this.mergeIntoCatalog(role, cloudResults as ProfileSearchResult[]);
          if (ranked.length) return ranked;
        }
      }
    } catch {
      this.cloudProfileFunctionsAvailable = false;
    }

    const catalog = await this.loadCatalog(role);
    const localResults = this.filterAndRank(catalog, normalized, role);
    if (localResults.length) return localResults;

    const serverResults = await this.searchOnServer(role, query.trim());
    this.mergeIntoCatalog(role, serverResults);

    const merged = new Map<string, ProfileSearchResult>();
    for (const entry of catalog) {
      if (entry.userId) merged.set(entry.userId, entry);
    }
    for (const entry of serverResults) {
      if (!entry.userId) continue;
      const existing = merged.get(entry.userId);
      merged.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    return this.filterAndRank(Array.from(merged.values()), normalized, role);
  }

  async getPublicProfile(role: ProfileRole, userId: string): Promise<RolePublicProfile | null> {
    if (role === 'athlete') {
      return null;
    }

    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;

    if (this.cloudProfileFunctionsAvailable) {
      try {
        const result = await Parse.Cloud.run('getRolePublicProfile', {
          role,
          userId: normalizedUserId,
        });
        if (result) return result as RolePublicProfile;
      } catch {
        this.cloudProfileFunctionsAvailable = false;
      }
    }

    return this.getPublicProfileClient(role, normalizedUserId);
  }

  private async getPublicProfileClient(
    role: ProfileRole,
    normalizedUserId: string
  ): Promise<RolePublicProfile | null> {
    const history = isProfessionalRole(role)
      ? await this.roleProfileHistoryService.getHistory(role, normalizedUserId)
      : await this.loadFanHistory(normalizedUserId);

    const { profile: roleProfile, legacyFavoriteProTeam } = isProfessionalRole(role)
      ? await this.findRoleProfile(normalizedUserId, role)
      : { profile: null, legacyFavoriteProTeam: undefined };

    const registrations = await this.loadRegistrationsForUser(normalizedUserId, role);
    const catalogEntry = (await this.loadCatalog(role)).find((entry) => entry.userId === normalizedUserId);

    if (!roleProfile && !registrations.length && !catalogEntry) {
      return null;
    }

    let user: Parse.User | null = null;
    try {
      user = await new Parse.Query(Parse.User).get(normalizedUserId);
    } catch {
      user = null;
    }

    const registration = registrations[0];
    const address = (user?.get('address') as Address | undefined) ?? undefined;
    const birthDate = user?.get('birthDate') as Date | undefined;

    const apelido =
      (user?.get('apelido') as string | undefined)?.trim() ||
      (registration?.get('apelido') as string | undefined)?.trim() ||
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
      PROFILE_ROLE_LABELS[role];

    return {
      userId: normalizedUserId,
      role,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      avatarUrl:
        catalogEntry?.avatarUrl ||
        (registration?.get('avatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
      state: address?.state || catalogEntry?.state,
      city: address?.city || catalogEntry?.city,
      neighborhood: address?.neighborhood,
      age: birthDate ? this.calcAge(birthDate) : undefined,
      proFootballIdol: readUserProFootballIdol(user),
      amateurFootballIdol: readUserAmateurFootballIdol(user),
      favoriteProTeam: readUserFavoriteProTeam(user, legacyFavoriteProTeam),
      roleProfile: roleProfile ?? undefined,
      history,
    };
  }

  private fromAthleteResult(entry: AthleteSearchResult): ProfileSearchResult {
    return {
      userId: entry.userId,
      displayName: entry.displayName,
      apelido: entry.apelido,
      fullName: entry.fullName,
      role: 'athlete',
      subtitle: entry.primaryPosition || undefined,
      city: entry.city,
      state: entry.state,
      avatarUrl: entry.avatarUrl,
    };
  }

  private async loadCatalog(role: ProfileRole): Promise<ProfileSearchResult[]> {
    const cached = this.catalogCache.get(role);
    if (cached) return cached;

    let promise = this.catalogLoadPromises.get(role);
    if (!promise) {
      promise = this.loadCatalogFromServer(role);
      this.catalogLoadPromises.set(role, promise);
    }

    return promise;
  }

  private async loadCatalogFromServer(role: ProfileRole): Promise<ProfileSearchResult[]> {
    const byUserId = new Map<string, ProfileSearchResult>();

    if (this.cloudProfileFunctionsAvailable) {
      try {
        const cloudCatalog = await Parse.Cloud.run('searchProfiles', { role, query: '' });
        if (Array.isArray(cloudCatalog)) {
          for (const entry of cloudCatalog as ProfileSearchResult[]) {
            if (!entry.userId) continue;
            const existing = byUserId.get(entry.userId);
            byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
          }
        }
      } catch {
        this.cloudProfileFunctionsAvailable = false;
      }
    }

    if (isProfessionalRole(role)) {
      try {
        const profiles = await new Parse.Query(ROLE_PROFILE_CLASS)
          .equalTo('role', role)
          .include('user')
          .limit(1000)
          .find();

        for (const profile of profiles) {
          const entry = this.toSearchResultFromRoleProfile(profile, role);
          if (!entry.userId) continue;
          byUserId.set(entry.userId, entry);
        }
      } catch {
        // CLP pode bloquear listagem de RoleProfile.
      }
    }

    try {
      for (const entry of await this.loadFromRegistrations(role)) {
        const existing = byUserId.get(entry.userId);
        byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
      }
    } catch {
      // CLP pode bloquear listagem de EventRegistration.
    }

    const catalog = Array.from(byUserId.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'pt-BR')
    );
    this.catalogCache.set(role, catalog);
    return catalog;
  }

  private async loadFromRegistrations(role: ProfileRole): Promise<ProfileSearchResult[]> {
    try {
      const query = new Parse.Query(EVENT_REGISTRATION_CLASS);
      query.equalTo('role', role);
      query.descending('createdAt');
      query.limit(2000);
      const registrations = await query.find();

      const byUserId = new Map<string, ProfileSearchResult>();
      for (const registration of registrations) {
        const entry = this.toSearchResultFromRegistration(registration, role);
        if (!entry.userId) continue;
        const existing = byUserId.get(entry.userId);
        byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
      }
      return Array.from(byUserId.values());
    } catch {
      return [];
    }
  }

  private async searchOnServer(role: ProfileRole, query: string): Promise<ProfileSearchResult[]> {
    const byUserId = new Map<string, ProfileSearchResult>();

    if (isProfessionalRole(role)) {
      try {
        const profileQueries = [
          this.matchesRoleProfileQuery(role, 'userApelido', query),
          this.matchesRoleProfileQuery(role, 'userName', query),
          this.matchesRoleProfileQuery(role, 'userFullName', query),
        ];
        const profileResults = await Parse.Query.or(...profileQueries).limit(200).find();
        for (const profile of profileResults) {
          const entry = this.toSearchResultFromRoleProfile(profile, role);
          if (!entry.userId) continue;
          byUserId.set(entry.userId, entry);
        }
      } catch {
        // CLP pode bloquear busca textual em RoleProfile.
      }
    }

    try {
      const registrationQueries = [
        this.matchesRegistrationQuery(role, 'apelido', query),
        this.matchesRegistrationQuery(role, 'userApelido', query),
        this.matchesRegistrationQuery(role, 'userDisplayName', query),
        this.matchesRegistrationQuery(role, 'userFullName', query),
      ];
      const registrationResults = await Parse.Query.or(...registrationQueries).limit(200).find();
      for (const registration of registrationResults) {
        const entry = this.toSearchResultFromRegistration(registration, role);
        if (!entry.userId) continue;
        const existing = byUserId.get(entry.userId);
        byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
      }
    } catch {
      // CLP pode bloquear busca textual em EventRegistration.
    }

    for (const entry of await this.searchUsersByTextForRole(role, query)) {
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }

    return Array.from(byUserId.values());
  }

  private async searchUsersByTextForRole(
    role: ProfileRole,
    query: string
  ): Promise<ProfileSearchResult[]> {
    let users: Parse.User[] = [];
    try {
      const apelidoUserQuery = new Parse.Query(Parse.User);
      apelidoUserQuery.matches('apelido', query, 'i');

      const nameUserQuery = new Parse.Query(Parse.User);
      nameUserQuery.matches('name', query, 'i');

      users = await Parse.Query.or(apelidoUserQuery, nameUserQuery).limit(200).find();
    } catch {
      return [];
    }

    if (!users.length) return [];

    const profileByUserId = new Map<string, Parse.Object>();
    if (isProfessionalRole(role)) {
      try {
        const profileQuery = new Parse.Query(ROLE_PROFILE_CLASS);
        profileQuery.equalTo('role', role);
        profileQuery.containedIn('user', users);
        profileQuery.include('user');
        const profiles = await profileQuery.find();
        for (const profile of profiles) {
          const user = profile.get('user') as Parse.User | undefined;
          const userId = user?.id || (profile.get('userId') as string | undefined);
          if (userId) profileByUserId.set(userId, profile);
        }
      } catch {
        // CLP pode bloquear leitura de RoleProfile.
      }
    }

    const registrationByUserId = new Map<string, Parse.Object>();
    try {
      const byUser = new Parse.Query(EVENT_REGISTRATION_CLASS);
      byUser.containedIn('user', users);
      byUser.equalTo('role', role);
      byUser.descending('createdAt');

      const byParticipantId = new Parse.Query(EVENT_REGISTRATION_CLASS);
      byParticipantId.containedIn(
        'participantUserId',
        users.map((user) => user.id).filter(Boolean) as string[]
      );
      byParticipantId.equalTo('role', role);
      byParticipantId.descending('createdAt');

      const registrationRows = await Parse.Query.or(byUser, byParticipantId).limit(400).find();
      for (const row of registrationRows) {
        const user = row.get('user') as Parse.User | undefined;
        const userId =
          (row.get('participantUserId') as string | undefined)?.trim() ||
          user?.id ||
          '';
        if (!userId || registrationByUserId.has(userId)) continue;
        registrationByUserId.set(userId, row);
      }
    } catch {
      // CLP pode bloquear leitura de EventRegistration.
    }

    const results: ProfileSearchResult[] = [];
    for (const user of users) {
      if (!user.id) continue;

      const profile = profileByUserId.get(user.id);
      if (profile) {
        results.push(this.toSearchResultFromRoleProfile(profile, role));
        continue;
      }

      const registration = registrationByUserId.get(user.id);
      if (registration) {
        results.push(this.toSearchResultFromRegistration(registration, role));
        continue;
      }

      if (isProfessionalRole(role) && user.get('primaryRole') === role) {
        results.push(this.toSearchResultFromUser(user, role));
      } else if (role === 'fan' && user.get('primaryRole') === 'fan') {
        results.push(this.toSearchResultFromUser(user, role));
      }
    }

    return results;
  }

  private toSearchResultFromUser(user: Parse.User, role: ProfileRole): ProfileSearchResult {
    const apelido = (user.get('apelido') as string | undefined)?.trim() || '';
    const fullName = (user.get('name') as string | undefined)?.trim() || '';
    const displayName = apelido || fullName || user.getUsername() || PROFILE_ROLE_LABELS[role];
    const address = (user.get('address') as Address | undefined) ?? undefined;

    return {
      userId: user.id!,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      role,
      subtitle: PROFILE_ROLE_LABELS[role],
      city: address?.city?.trim() || undefined,
      state: address?.state?.trim() || undefined,
      avatarUrl: getUserAvatarUrl(user, this.parseFileService) || undefined,
    };
  }

  private matchesRoleProfileQuery(role: ProfessionalRole, field: string, query: string): Parse.Query {
    const q = new Parse.Query(ROLE_PROFILE_CLASS);
    q.equalTo('role', role);
    q.matches(field, query, 'i');
    return q;
  }

  private matchesRegistrationQuery(role: ProfileRole, field: string, query: string): Parse.Query {
    const q = new Parse.Query(EVENT_REGISTRATION_CLASS);
    q.equalTo('role', role);
    q.matches(field, query, 'i');
    return q;
  }

  private mergeIntoCatalog(role: ProfileRole, entries: ProfileSearchResult[]): void {
    if (!entries.length) return;
    const byUserId = new Map<string, ProfileSearchResult>();
    for (const entry of this.catalogCache.get(role) ?? []) {
      if (entry.userId) byUserId.set(entry.userId, entry);
    }
    for (const entry of entries) {
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? this.mergeEntries(existing, entry) : entry);
    }
    this.catalogCache.set(role, Array.from(byUserId.values()));
  }

  private mergeEntries(primary: ProfileSearchResult, secondary: ProfileSearchResult): ProfileSearchResult {
    return {
      userId: primary.userId,
      role: primary.role,
      displayName:
        this.pickRicherText(primary.displayName, secondary.displayName) ??
        primary.displayName ??
        secondary.displayName ??
        PROFILE_ROLE_LABELS[primary.role],
      apelido: this.pickRicherText(primary.apelido, secondary.apelido),
      fullName: this.pickRicherText(primary.fullName, secondary.fullName),
      subtitle: this.pickRicherText(primary.subtitle, secondary.subtitle),
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

  private filterAndRank(
    catalog: ProfileSearchResult[],
    normalized: string,
    role: ProfileRole
  ): ProfileSearchResult[] {
    return [...catalog]
      .filter((entry) => this.matchesQuery(entry, normalized))
      .sort((a, b) => {
        const scoreDiff = this.relevanceScore(b, normalized) - this.relevanceScore(a, normalized);
        if (scoreDiff !== 0) return scoreDiff;
        return a.displayName.localeCompare(b.displayName, 'pt-BR');
      })
      .slice(0, 100)
      .map((entry) => ({ ...entry, role }));
  }

  private matchesQuery(entry: ProfileSearchResult, normalized: string): boolean {
    if (searchMatchesRoleKeyword(normalized, entry.role)) return true;
    const haystack = normalizeSearchText(
      `${entry.displayName} ${entry.apelido ?? ''} ${entry.fullName ?? ''} ${entry.subtitle ?? ''} ${entry.city ?? ''} ${entry.state ?? ''} ${PROFILE_ROLE_LABELS[entry.role]}`
    );
    if (haystack.includes(normalized)) return true;
    const tokens = normalized.split(/\s+/).filter((token) => token.length >= 2);
    return tokens.length > 1 && tokens.every((token) => haystack.includes(token));
  }

  private relevanceScore(entry: ProfileSearchResult, normalized: string): number {
    const fields = [entry.displayName, entry.apelido, entry.fullName, entry.subtitle]
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

  private toSearchResultFromRoleProfile(profile: Parse.Object, role: ProfileRole): ProfileSearchResult {
    const user = profile.get('user') as Parse.User | undefined;
    const userId = (profile.get('userId') as string | undefined) || user?.id || '';
    const apelido =
      (profile.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string | undefined)?.trim() ||
      '';
    const fullName =
      (profile.get('userFullName') as string | undefined)?.trim() ||
      (user?.get('name') as string | undefined)?.trim() ||
      '';
    const displayName =
      (profile.get('userName') as string | undefined)?.trim() ||
      apelido ||
      fullName ||
      user?.getUsername() ||
      PROFILE_ROLE_LABELS[role];
    const address = (user?.get('address') as Address | undefined) ?? undefined;

    return {
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      role,
      subtitle: PROFILE_ROLE_LABELS[role],
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

  private toSearchResultFromRegistration(
    registration: Parse.Object,
    role: ProfileRole
  ): ProfileSearchResult {
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
      PROFILE_ROLE_LABELS[role];

    return {
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      role,
      subtitle: PROFILE_ROLE_LABELS[role],
      avatarUrl:
        (registration.get('avatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
    };
  }

  private async findRoleProfile(
    userId: string,
    role: ProfessionalRole
  ): Promise<{ profile: RoleProfile | null; legacyFavoriteProTeam?: string }> {
    const userPtr = Parse.User.createWithoutData(userId);
    const query = new Parse.Query(ROLE_PROFILE_CLASS);
    query.equalTo('user', userPtr);
    query.equalTo('role', role);
    const row = await query.first();
    if (!row) return { profile: null };

    return {
      legacyFavoriteProTeam: row.get('favoriteProTeam') as string | undefined,
      profile: {
      objectId: row.id!,
      role,
      peladaRate: row.get('peladaRate') as number | undefined,
      matchRate: row.get('matchRate') as number | undefined,
      athleteRate: row.get('athleteRate') as number | undefined,
      peladaLiveRate: row.get('peladaLiveRate') as number | undefined,
      matchLiveRate: row.get('matchLiveRate') as number | undefined,
      peladaHighlightEditRate: row.get('peladaHighlightEditRate') as number | undefined,
      matchHighlightEditRate: row.get('matchHighlightEditRate') as number | undefined,
      peladaGoalNarrationEditRate: row.get('peladaGoalNarrationEditRate') as number | undefined,
      matchGoalNarrationEditRate: row.get('matchGoalNarrationEditRate') as number | undefined,
      teamTrainingRate: row.get('teamTrainingRate') as number | undefined,
      teamRate: row.get('teamRate') as number | undefined,
      hasOwnEquipment: row.get('hasOwnEquipment') as boolean | undefined,
      isFederatedReferee: row.get('isFederatedReferee') as boolean | undefined,
      federationName: row.get('federationName') as string | undefined,
      federationRegistrationNumber: row.get('federationRegistrationNumber') as string | undefined,
      equipmentDescription: row.get('equipmentDescription') as string | undefined,
      pixKey1: row.get('pixKey1') as string | undefined,
      pixKey2: row.get('pixKey2') as string | undefined,
      pixKey3: row.get('pixKey3') as string | undefined,
      },
    };
  }

  private async loadRegistrationsForUser(userId: string, role: ProfileRole): Promise<Parse.Object[]> {
    const userPtr = Parse.User.createWithoutData(userId);
    const byParticipantId = new Parse.Query(EVENT_REGISTRATION_CLASS);
    byParticipantId.equalTo('participantUserId', userId);
    byParticipantId.equalTo('role', role);

    const byUser = new Parse.Query(EVENT_REGISTRATION_CLASS);
    byUser.equalTo('user', userPtr);
    byUser.equalTo('role', role);

    const query = Parse.Query.or(byParticipantId, byUser);
    query.include('event');
    query.include('event.pelada');
    query.limit(2000);
    return query.find();
  }

  private async loadFanHistory(userId: string): Promise<RoleParticipationHistory> {
    const registrations = await this.loadRegistrationsForUser(userId, 'fan');
    const peladas = new Map<string, { id: string; name: string; score: number }>();

    for (const registration of registrations) {
      const event = registration.get('event') as Parse.Object | undefined;
      if (!event) continue;
      const pelada = event.get('pelada') as Parse.Object | undefined;
      const peladaId = pelada?.id;
      const name = (pelada?.get('name') as string | undefined) || (event.get('name') as string);
      if (!peladaId || !name) continue;
      if (!peladas.has(peladaId)) {
        peladas.set(peladaId, { id: peladaId, name, score: 0 });
      }
    }

    return {
      peladas: Array.from(peladas.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      matches: [],
      teams: [],
    };
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
