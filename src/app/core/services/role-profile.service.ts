import { Injectable } from '@angular/core';
import Parse from 'parse';
import { RefereeInviteCandidate } from '../models/referee-invitation.model';
import { EventInviteCandidate } from '../models/event-hiring.model';
import { PROFILE_ROLE_LABELS } from '../models/profile-role.model';
import { searchMatchesRoleKeyword } from '../utils/role-search.util';
import {
  CreateRoleProfilePayload,
  ProfessionalRole,
  RoleProfile,
  UpdateRoleProfilePayload,
} from '../models/role-profile.model';
import { Address, normalizeBrazilUf } from '../models/address.model';
import { locationProximityScore } from '../utils/location-proximity.util';
import { normalizeSearchText } from '../utils/search-text.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { ParseService } from './parse.service';
import { ParseFileService } from './parse-file.service';

const CLASS = 'RoleProfile';
const EVENT_REGISTRATION_CLASS = 'EventRegistration';

@Injectable({ providedIn: 'root' })
export class RoleProfileService {
  private cloudProfileSearchAvailable = true;

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async getForCurrentUser(): Promise<RoleProfile | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    const result = await query.first();
    return result ? this.toProfile(result) : null;
  }

  async getForRole(role: ProfessionalRole): Promise<RoleProfile | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.equalTo('role', role);
    const result = await query.first();
    return result ? this.toProfile(result) : null;
  }

  async listRefereeCandidates(eventAddress?: Address): Promise<RefereeInviteCandidate[]> {
    return this.loadAllRefereeCandidates(eventAddress);
  }

  async searchRefereeCandidates(
    search: string,
    eventAddress?: Address
  ): Promise<RefereeInviteCandidate[]> {
    const allCandidates = await this.loadAllRefereeCandidates(eventAddress);
    const normalizedSearch = normalizeSearchText(search);

    if (!normalizedSearch) {
      return allCandidates;
    }

    const byUserId = new Map(allCandidates.map((candidate) => [candidate.userId, candidate]));

    const serverMatches = await this.findRefereesByTextOnServer(search, eventAddress);
    for (const candidate of serverMatches) {
      if (!byUserId.has(candidate.userId)) {
        byUserId.set(candidate.userId, candidate);
      }
    }

    return this.filterAndSortRefereeCandidates(Array.from(byUserId.values()), normalizedSearch);
  }

  filterRefereeCandidates(
    candidates: RefereeInviteCandidate[],
    search: string
  ): RefereeInviteCandidate[] {
    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) return candidates;
    return this.filterAndSortRefereeCandidates(candidates, normalizedSearch);
  }

  async listRoleCandidates(
    role: ProfessionalRole,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    if (role === 'referee') {
      return this.loadAllRefereeCandidates(eventAddress);
    }

    return this.loadAllRoleCandidates(role, eventAddress);
  }

  async listRefereeFlagCandidates(eventAddress?: Address): Promise<EventInviteCandidate[]> {
    const user = Parse.User.current();
    const query = new Parse.Query(CLASS);
    query.equalTo('role', 'referee');
    query.equalTo('hasFlags', true);
    query.include('user');
    query.limit(500);
    const profiles = await query.find();
    const candidates: EventInviteCandidate[] = [];
    for (const row of profiles) {
      const candidate = this.toRoleCandidateFromProfile(row, eventAddress);
      if (!candidate.userId || candidate.userId === user?.id) continue;
      candidates.push(candidate);
    }
    return this.sortRoleCandidates(candidates);
  }

  async listScoutAssistantCandidates(eventAddress?: Address): Promise<EventInviteCandidate[]> {
    const user = Parse.User.current();
    const candidates = await this.listRoleCandidates('scout', eventAddress);
    return candidates.filter((candidate) => candidate.userId !== user?.id);
  }

  async searchRefereeFlagCandidates(
    search: string,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const all = await this.listRefereeFlagCandidates(eventAddress);
    return this.filterRoleCandidates(all, search);
  }

  async searchScoutAssistantCandidates(
    search: string,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const all = await this.listScoutAssistantCandidates(eventAddress);
    return this.filterRoleCandidates(all, search);
  }

  async searchRoleCandidates(
    role: ProfessionalRole,
    search: string,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const allCandidates = await this.listRoleCandidates(role, eventAddress);
    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) return allCandidates;

    const byUserId = new Map(allCandidates.map((candidate) => [candidate.userId, candidate]));

    try {
      if (this.cloudProfileSearchAvailable) {
        const cloudResults = await Parse.Cloud.run('searchProfiles', {
          role,
          query: search.trim(),
        });
        if (Array.isArray(cloudResults)) {
          for (const entry of cloudResults as Array<Record<string, unknown>>) {
            const candidate = this.toRoleCandidateFromCloudSearch(entry, eventAddress, byUserId);
            if (!candidate.userId) continue;
            const existing = byUserId.get(candidate.userId);
            byUserId.set(
              candidate.userId,
              existing ? this.mergeRoleCandidates(existing, candidate) : candidate
            );
          }
        }
      }
    } catch {
      this.cloudProfileSearchAvailable = false;
    }

    const serverMatches = await this.findRoleProfilesByTextOnServer(role, search, eventAddress);
    for (const candidate of serverMatches) {
      const existing = byUserId.get(candidate.userId);
      byUserId.set(
        candidate.userId,
        existing ? this.mergeRoleCandidates(existing, candidate) : candidate
      );
    }

    return this.filterRoleCandidates(Array.from(byUserId.values()), search, role);
  }

  filterRoleCandidates(
    candidates: EventInviteCandidate[],
    search: string,
    role?: ProfessionalRole
  ): EventInviteCandidate[] {
    const normalizedSearch = normalizeSearchText(search);
    if (!normalizedSearch) return candidates;

    return this.sortRoleCandidates(
      candidates.filter((candidate) => this.matchesRoleCandidateSearch(candidate, normalizedSearch, role))
    );
  }

  private async loadAllRoleCandidates(
    role: ProfessionalRole,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const candidatesByUserId = new Map<string, EventInviteCandidate>();

    try {
      const roleQuery = new Parse.Query(CLASS);
      roleQuery.equalTo('role', role);
      roleQuery.include('user');
      roleQuery.limit(1000);
      const roleProfiles = await roleQuery.find();

      for (const row of roleProfiles) {
        const candidate = this.toRoleCandidateFromProfile(row, eventAddress);
        if (!candidate.userId) continue;
        candidatesByUserId.set(candidate.userId, candidate);
      }
    } catch {
      // CLP pode bloquear listagem de RoleProfile de outros usuarios.
    }

    try {
      for (const candidate of await this.loadRoleCandidatesFromRegistrations(role, eventAddress)) {
        const existing = candidatesByUserId.get(candidate.userId);
        candidatesByUserId.set(
          candidate.userId,
          existing ? this.mergeRoleCandidates(existing, candidate) : candidate
        );
      }
    } catch {
      // CLP pode bloquear listagem de EventRegistration.
    }

    try {
      const userQuery = new Parse.Query(Parse.User);
      userQuery.equalTo('primaryRole', role);
      userQuery.limit(1000);
      const users = await userQuery.find();

      for (const user of users) {
        if (!user.id || candidatesByUserId.has(user.id)) continue;
        candidatesByUserId.set(
          user.id,
          this.toRoleCandidateFromUser(user, null, eventAddress)
        );
      }
    } catch {
      // Ignora quando a CLP bloqueia busca em _User.
    }

    return this.sortRoleCandidates(Array.from(candidatesByUserId.values()));
  }

  private async findRoleProfilesByTextOnServer(
    role: ProfessionalRole,
    search: string,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const trimmed = search.trim();
    if (trimmed.length < 2) return [];

    const candidatesByUserId = new Map<string, EventInviteCandidate>();

    const apelidoQuery = new Parse.Query(CLASS);
    apelidoQuery.equalTo('role', role);
    apelidoQuery.matches('userApelido', trimmed, 'i');

    const nameQuery = new Parse.Query(CLASS);
    nameQuery.equalTo('role', role);
    nameQuery.matches('userName', trimmed, 'i');

    const fullNameQuery = new Parse.Query(CLASS);
    fullNameQuery.equalTo('role', role);
    fullNameQuery.matches('userFullName', trimmed, 'i');

    try {
      const roleProfiles = await Parse.Query.or(apelidoQuery, nameQuery, fullNameQuery)
        .limit(200)
        .find();
      for (const row of roleProfiles) {
        const candidate = this.toRoleCandidateFromProfile(row, eventAddress);
        if (candidate.userId) {
          candidatesByUserId.set(candidate.userId, candidate);
        }
      }
    } catch {
      // CLP pode bloquear busca textual em RoleProfile.
    }

    const userMatches = await this.findUsersByTextMatchingRole(role, trimmed, eventAddress);
    for (const candidate of userMatches) {
      if (!candidatesByUserId.has(candidate.userId)) {
        candidatesByUserId.set(candidate.userId, candidate);
      }
    }

    try {
      const registrationQueries = [
        this.matchesRegistrationFieldQuery(role, 'apelido', trimmed),
        this.matchesRegistrationFieldQuery(role, 'userApelido', trimmed),
        this.matchesRegistrationFieldQuery(role, 'userDisplayName', trimmed),
        this.matchesRegistrationFieldQuery(role, 'userFullName', trimmed),
      ];
      const registrationRows = await Parse.Query.or(...registrationQueries).limit(200).find();
      for (const row of registrationRows) {
        const candidate = this.toRoleCandidateFromRegistration(row, eventAddress);
        if (!candidate.userId) continue;
        const existing = candidatesByUserId.get(candidate.userId);
        candidatesByUserId.set(
          candidate.userId,
          existing ? this.mergeRoleCandidates(existing, candidate) : candidate
        );
      }
    } catch {
      // CLP pode bloquear busca textual em EventRegistration.
    }

    return Array.from(candidatesByUserId.values());
  }

  private async findUsersByTextMatchingRole(
    role: ProfessionalRole,
    search: string,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    let users: Parse.User[] = [];
    try {
      const apelidoUserQuery = new Parse.Query(Parse.User);
      apelidoUserQuery.matches('apelido', search, 'i');

      const nameUserQuery = new Parse.Query(Parse.User);
      nameUserQuery.matches('name', search, 'i');

      users = await Parse.Query.or(apelidoUserQuery, nameUserQuery).limit(200).find();
    } catch {
      return [];
    }

    if (!users.length) return [];

    const profileByUserId = new Map<string, Parse.Object>();
    try {
      const userIds = users.map((user) => user.id).filter(Boolean) as string[];
      const byPointer = new Parse.Query(CLASS);
      byPointer.equalTo('role', role);
      byPointer.containedIn('user', users);
      byPointer.include('user');
      const byUserIdField = new Parse.Query(CLASS);
      byUserIdField.equalTo('role', role);
      byUserIdField.containedIn('userId', userIds);
      byUserIdField.include('user');
      const profiles = await Parse.Query.or(byPointer, byUserIdField).limit(400).find();
      for (const profile of profiles) {
        const user = profile.get('user') as Parse.User | undefined;
        const userId = user?.id || (profile.get('userId') as string | undefined);
        if (userId) profileByUserId.set(userId, profile);
      }
    } catch {
      // CLP pode bloquear leitura de RoleProfile de outros usuarios.
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

    const candidates: EventInviteCandidate[] = [];
    for (const user of users) {
      if (!user.id) continue;

      const profile = profileByUserId.get(user.id);
      if (profile) {
        candidates.push(this.toRoleCandidateFromProfile(profile, eventAddress));
        continue;
      }

      const registration = registrationByUserId.get(user.id);
      if (registration) {
        candidates.push(this.toRoleCandidateFromRegistration(registration, eventAddress));
        continue;
      }

      if (user.get('primaryRole') === role) {
        candidates.push(this.toRoleCandidateFromUser(user, null, eventAddress));
      }
    }

    return candidates.filter((candidate) => candidate.userId);
  }

  private sortRoleCandidates(candidates: EventInviteCandidate[]): EventInviteCandidate[] {
    return [...candidates].sort((a, b) => {
      const proximityDiff = (b.proximityScore ?? 0) - (a.proximityScore ?? 0);
      if (proximityDiff !== 0) return proximityDiff;
      return a.userName.localeCompare(b.userName, 'pt-BR');
    });
  }

  private toRoleCandidateFromProfile(
    row: Parse.Object,
    eventAddress?: Address
  ): EventInviteCandidate {
    const user = row.get('user') as Parse.User | undefined;
    const userId = user?.id ?? (row.get('userId') as string | undefined) ?? '';
    const apelido =
      (row.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string) ||
      '';
    const fullName =
      (user?.get('name') as string | undefined)?.trim() ||
      (row.get('userFullName') as string | undefined)?.trim() ||
      '';
    const userName =
      fullName ||
      (row.get('userName') as string | undefined)?.trim() ||
      apelido ||
      user?.getUsername() ||
      'Usuario';
    const city =
      (row.get('userCity') as string | undefined) ??
      ((user?.get('address') as Address | undefined)?.city);
    const state = normalizeBrazilUf(
      (row.get('userState') as string | undefined) ??
        ((user?.get('address') as Address | undefined)?.state)
    );
    const latitude = this.parseCoordinate(row.get('userLatitude'));
    const longitude = this.parseCoordinate(row.get('userLongitude'));
    const addressFromProfile: Address | undefined =
      city || state || latitude != null || longitude != null
        ? ({ city, state: state || undefined, latitude, longitude } as Address)
        : undefined;

    return {
      userId,
      userName,
      apelido,
      fullName: fullName || undefined,
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
      avatarUrl:
        (row.get('userAvatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
      city,
      state: state || undefined,
      proximityScore: locationProximityScore(addressFromProfile, eventAddress),
    };
  }

  async syncDisplayFieldsForCurrentUser(): Promise<void> {
    const user = Parse.User.current();
    if (!user) return;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.limit(20);
    const profiles = await query.find();
    if (!profiles.length) return;

    for (const profile of profiles) {
      this.applyUserDisplayFields(profile, user);
    }
    await Parse.Object.saveAll(profiles);
  }

  private async loadAllRefereeCandidates(eventAddress?: Address): Promise<RefereeInviteCandidate[]> {
    const candidatesByUserId = new Map<string, RefereeInviteCandidate>();

    const roleQuery = new Parse.Query(CLASS);
    roleQuery.equalTo('role', 'referee');
    roleQuery.include('user');
    roleQuery.limit(1000);
    const roleProfiles = await roleQuery.find();

    for (const row of roleProfiles) {
      const candidate = this.toRefereeCandidateFromProfile(row, eventAddress);
      if (!candidate.userId) continue;
      candidatesByUserId.set(candidate.userId, candidate);
    }

    try {
      const userQuery = new Parse.Query(Parse.User);
      userQuery.equalTo('primaryRole', 'referee');
      userQuery.limit(1000);
      const refereeUsers = await userQuery.find();

      for (const user of refereeUsers) {
        if (!user.id || candidatesByUserId.has(user.id)) continue;
        candidatesByUserId.set(user.id, this.toRefereeCandidateFromUser(user, null, eventAddress));
      }
    } catch {
      // Ignora quando a CLP bloqueia busca em _User.
    }

    return this.sortRefereeCandidates(Array.from(candidatesByUserId.values()));
  }

  private async findRefereesByTextOnServer(
    search: string,
    eventAddress?: Address
  ): Promise<RefereeInviteCandidate[]> {
    const trimmed = search.trim();
    if (trimmed.length < 2) return [];

    const apelidoQuery = new Parse.Query(CLASS);
    apelidoQuery.equalTo('role', 'referee');
    apelidoQuery.matches('userApelido', trimmed, 'i');

    const nameQuery = new Parse.Query(CLASS);
    nameQuery.equalTo('role', 'referee');
    nameQuery.matches('userName', trimmed, 'i');

    const roleProfiles = await Parse.Query.or(apelidoQuery, nameQuery).limit(200).find();
    return roleProfiles
      .map((row) => this.toRefereeCandidateFromProfile(row, eventAddress))
      .filter((candidate) => candidate.userId);
  }

  private filterAndSortRefereeCandidates(
    candidates: RefereeInviteCandidate[],
    normalizedSearch: string
  ): RefereeInviteCandidate[] {
    const filtered = candidates.filter((candidate) => {
      const haystack = normalizeSearchText(
        `${candidate.userName} ${candidate.apelido} ${candidate.city ?? ''} ${candidate.state ?? ''}`
      );
      return haystack.includes(normalizedSearch);
    });

    return this.sortRefereeCandidates(filtered);
  }

  private sortRefereeCandidates(candidates: RefereeInviteCandidate[]): RefereeInviteCandidate[] {
    return [...candidates].sort((a, b) => {
      const proximityDiff = (b.proximityScore ?? 0) - (a.proximityScore ?? 0);
      if (proximityDiff !== 0) return proximityDiff;
      return a.userName.localeCompare(b.userName, 'pt-BR');
    });
  }

  private toRefereeCandidateFromProfile(
    row: Parse.Object,
    eventAddress?: Address
  ): RefereeInviteCandidate {
    const user = row.get('user') as Parse.User | undefined;
    const userId = user?.id ?? (row.get('userId') as string | undefined) ?? '';
    const apelido =
      (row.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string) ||
      '';
    const userName =
      (row.get('userName') as string | undefined)?.trim() ||
      apelido ||
      (user?.get('name') as string) ||
      user?.getUsername() ||
      'Arbitro';

    const city =
      (row.get('userCity') as string | undefined) ??
      ((user?.get('address') as Address | undefined)?.city);
    const state =
      (row.get('userState') as string | undefined) ??
      ((user?.get('address') as Address | undefined)?.state);
    const latitude = this.parseCoordinate(row.get('userLatitude'));
    const longitude = this.parseCoordinate(row.get('userLongitude'));
    const addressFromProfile: Address | undefined =
      city || state || latitude != null || longitude != null
        ? ({ city, state, latitude, longitude } as Address)
        : undefined;

    const avatarUrl =
      (row.get('userAvatarUrl') as string | undefined)?.trim() ||
      getUserAvatarUrl(user, this.parseFileService) ||
      undefined;

    return {
      userId,
      userName,
      apelido,
      peladaRate: row.get('peladaRate') as number | undefined,
      matchRate: row.get('matchRate') as number | undefined,
      avatarUrl,
      city,
      state,
      proximityScore: locationProximityScore(addressFromProfile, eventAddress),
    };
  }

  private toRefereeCandidateFromUser(
    user: Parse.User,
    roleProfile: Parse.Object | null,
    eventAddress?: Address
  ): RefereeInviteCandidate {
    return this.toRoleCandidateFromUser(user, roleProfile, eventAddress);
  }

  private toRoleCandidateFromUser(
    user: Parse.User,
    roleProfile: Parse.Object | null,
    eventAddress?: Address
  ): EventInviteCandidate {
    const apelido = (user.get('apelido') as string) || '';
    const fullName = ((user.get('name') as string) || '').trim();
    const userName = fullName || apelido || user.getUsername() || 'Usuario';
    const address = (user.get('address') as Address | undefined) ?? undefined;

    return {
      userId: user.id!,
      userName,
      apelido,
      fullName: fullName || undefined,
      peladaRate: roleProfile?.get('peladaRate') as number | undefined,
      matchRate: roleProfile?.get('matchRate') as number | undefined,
      athleteRate: roleProfile?.get('athleteRate') as number | undefined,
      peladaLiveRate: roleProfile?.get('peladaLiveRate') as number | undefined,
      matchLiveRate: roleProfile?.get('matchLiveRate') as number | undefined,
      peladaHighlightEditRate: roleProfile?.get('peladaHighlightEditRate') as number | undefined,
      matchHighlightEditRate: roleProfile?.get('matchHighlightEditRate') as number | undefined,
      peladaGoalNarrationEditRate: roleProfile?.get('peladaGoalNarrationEditRate') as number | undefined,
      matchGoalNarrationEditRate: roleProfile?.get('matchGoalNarrationEditRate') as number | undefined,
      teamTrainingRate: roleProfile?.get('teamTrainingRate') as number | undefined,
      teamRate: roleProfile?.get('teamRate') as number | undefined,
      avatarUrl: getUserAvatarUrl(user, this.parseFileService) ?? undefined,
      city: address?.city,
      state: address?.state,
      proximityScore: locationProximityScore(address, eventAddress),
    };
  }

  private async loadRoleCandidatesFromRegistrations(
    role: ProfessionalRole,
    eventAddress?: Address
  ): Promise<EventInviteCandidate[]> {
    const query = new Parse.Query(EVENT_REGISTRATION_CLASS);
    query.equalTo('role', role);
    query.descending('createdAt');
    query.limit(2000);
    const rows = await query.find();

    const byUserId = new Map<string, EventInviteCandidate>();
    for (const row of rows) {
      const candidate = this.toRoleCandidateFromRegistration(row, eventAddress);
      if (!candidate.userId) continue;
      const existing = byUserId.get(candidate.userId);
      byUserId.set(
        candidate.userId,
        existing ? this.mergeRoleCandidates(existing, candidate) : candidate
      );
    }

    return Array.from(byUserId.values());
  }

  private toRoleCandidateFromRegistration(
    row: Parse.Object,
    eventAddress?: Address
  ): EventInviteCandidate {
    const user = row.get('user') as Parse.User | undefined;
    const userId =
      (row.get('participantUserId') as string | undefined)?.trim() ||
      user?.id ||
      '';
    const apelido =
      (row.get('apelido') as string | undefined)?.trim() ||
      (row.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string | undefined)?.trim() ||
      '';
    const fullName =
      (row.get('userFullName') as string | undefined)?.trim() ||
      (user?.get('name') as string | undefined)?.trim() ||
      '';
    const userName =
      fullName ||
      (row.get('userDisplayName') as string | undefined)?.trim() ||
      apelido ||
      user?.getUsername() ||
      'Usuario';

    return {
      userId,
      userName,
      apelido,
      fullName: fullName || undefined,
      avatarUrl:
        (row.get('avatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
      proximityScore: locationProximityScore(undefined, eventAddress),
    };
  }

  private matchesRegistrationFieldQuery(
    role: ProfessionalRole,
    field: string,
    query: string
  ): Parse.Query {
    const q = new Parse.Query(EVENT_REGISTRATION_CLASS);
    q.equalTo('role', role);
    q.matches(field, query, 'i');
    return q;
  }

  private matchesRoleCandidateSearch(
    candidate: EventInviteCandidate,
    normalizedSearch: string,
    role?: ProfessionalRole
  ): boolean {
    if (role && searchMatchesRoleKeyword(normalizedSearch, role)) return true;
    const haystack = normalizeSearchText(
      `${candidate.userName} ${candidate.apelido} ${candidate.fullName ?? ''} ${candidate.city ?? ''} ${candidate.state ?? ''} ${role ? PROFILE_ROLE_LABELS[role] : ''}`
    );
    if (haystack.includes(normalizedSearch)) return true;
    const tokens = normalizedSearch.split(/\s+/).filter((token) => token.length >= 2);
    return tokens.length > 1 && tokens.every((token) => haystack.includes(token));
  }

  private mergeRoleCandidates(
    primary: EventInviteCandidate,
    secondary: EventInviteCandidate
  ): EventInviteCandidate {
    return {
      ...primary,
      userName: this.pickRicherText(primary.userName, secondary.userName) ?? primary.userName,
      apelido: primary.apelido || secondary.apelido,
      fullName: primary.fullName || secondary.fullName,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      city: primary.city || secondary.city,
      state: primary.state || secondary.state,
      proximityScore: Math.max(primary.proximityScore ?? 0, secondary.proximityScore ?? 0),
      peladaRate: primary.peladaRate ?? secondary.peladaRate,
      matchRate: primary.matchRate ?? secondary.matchRate,
      athleteRate: primary.athleteRate ?? secondary.athleteRate,
      peladaLiveRate: primary.peladaLiveRate ?? secondary.peladaLiveRate,
      matchLiveRate: primary.matchLiveRate ?? secondary.matchLiveRate,
      peladaHighlightEditRate: primary.peladaHighlightEditRate ?? secondary.peladaHighlightEditRate,
      matchHighlightEditRate: primary.matchHighlightEditRate ?? secondary.matchHighlightEditRate,
      peladaGoalNarrationEditRate:
        primary.peladaGoalNarrationEditRate ?? secondary.peladaGoalNarrationEditRate,
      matchGoalNarrationEditRate:
        primary.matchGoalNarrationEditRate ?? secondary.matchGoalNarrationEditRate,
      teamTrainingRate: primary.teamTrainingRate ?? secondary.teamTrainingRate,
      teamRate: primary.teamRate ?? secondary.teamRate,
    };
  }

  private toRoleCandidateFromCloudSearch(
    entry: Record<string, unknown>,
    eventAddress: Address | undefined,
    knownByUserId: Map<string, EventInviteCandidate>
  ): EventInviteCandidate {
    const userId = String(entry['userId'] || '').trim();
    const apelido = String(entry['apelido'] || '').trim();
    const fullName = String(entry['fullName'] || '').trim();
    const displayName = String(entry['displayName'] || '').trim();
    const known = knownByUserId.get(userId);

    return {
      userId,
      userName: fullName || displayName || apelido || known?.userName || 'Usuario',
      apelido: apelido || known?.apelido || '',
      fullName: fullName || known?.fullName,
      avatarUrl: String(entry['avatarUrl'] || known?.avatarUrl || '').trim() || undefined,
      city: String(entry['city'] || known?.city || '').trim() || undefined,
      state: String(entry['state'] || known?.state || '').trim() || undefined,
      proximityScore: known?.proximityScore ?? locationProximityScore(undefined, eventAddress),
      peladaRate: known?.peladaRate,
      matchRate: known?.matchRate,
      athleteRate: known?.athleteRate,
      peladaLiveRate: known?.peladaLiveRate,
      matchLiveRate: known?.matchLiveRate,
      peladaHighlightEditRate: known?.peladaHighlightEditRate,
      matchHighlightEditRate: known?.matchHighlightEditRate,
      peladaGoalNarrationEditRate: known?.peladaGoalNarrationEditRate,
      matchGoalNarrationEditRate: known?.matchGoalNarrationEditRate,
      teamTrainingRate: known?.teamTrainingRate,
      teamRate: known?.teamRate,
    };
  }

  private pickRicherText(a?: string, b?: string): string | undefined {
    const left = a?.trim();
    const right = b?.trim();
    if (!left) return right || undefined;
    if (!right) return left;
    return left.length >= right.length ? left : right;
  }

  private parseCoordinate(value: unknown): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim().replace(',', '.'));
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private applyUserDisplayFields(profile: Parse.Object, user: Parse.User): void {
    const apelido = (user.get('apelido') as string) || '';
    const name = (user.get('name') as string) || '';
    profile.set('userApelido', apelido);
    profile.set('userFullName', name.trim());
    profile.set('userName', apelido || name || user.getUsername() || 'Usuario');
    if (user.id) profile.set('userId', user.id);

    const address = (user.get('address') as Address | undefined) ?? undefined;
    if (address?.city?.trim()) profile.set('userCity', address.city.trim());
    else profile.unset('userCity');
    const normalizedState = address?.state ? normalizeBrazilUf(address.state) : '';
    if (normalizedState) profile.set('userState', normalizedState);
    else profile.unset('userState');
    if (typeof address?.latitude === 'number' && !Number.isNaN(address.latitude)) {
      profile.set('userLatitude', String(address.latitude));
    } else {
      profile.unset('userLatitude');
    }
    if (typeof address?.longitude === 'number' && !Number.isNaN(address.longitude)) {
      profile.set('userLongitude', String(address.longitude));
    } else {
      profile.unset('userLongitude');
    }

    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) profile.set('userAvatarUrl', avatarUrl);
    else profile.unset('userAvatarUrl');
  }

  async create(payload: CreateRoleProfilePayload): Promise<RoleProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para criar o perfil.');

    const existing = await this.getForRole(payload.role);
    if (existing) return existing;

    const profile = new Parse.Object(CLASS);
    profile.set('user', user);
    profile.set('role', payload.role);
    this.applyPayload(profile, payload);
    this.applyUserDisplayFields(profile, user);
    if (user.id) {
      profile.set('userId', user.id);
    }
    this.applyHiringReadAcl(profile, user);

    const saved = await profile.save();
    return this.toProfile(saved);
  }

  async update(role: ProfessionalRole, payload: UpdateRoleProfilePayload): Promise<RoleProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para atualizar o perfil.');

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    query.equalTo('role', role);
    const profile = await query.first();
    if (!profile) throw new Error('Perfil nao encontrado.');

    this.applyPayload(profile, { role, ...payload });
    this.applyUserDisplayFields(profile, user);
    this.applyHiringReadAcl(profile, user);

    const saved = await profile.save();
    return this.toProfile(saved);
  }

  private applyHiringReadAcl(profile: Parse.Object, user: Parse.User): void {
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    if (user.id) {
      acl.setWriteAccess(user, true);
    }
    profile.setACL(acl);
  }

  private applyPayload(obj: Parse.Object, payload: CreateRoleProfilePayload): void {
    const keys: (keyof CreateRoleProfilePayload)[] = [
      'role',
      'peladaRate',
      'matchRate',
      'athleteRate',
      'peladaLiveRate',
      'matchLiveRate',
      'peladaHighlightEditRate',
      'matchHighlightEditRate',
      'peladaGoalNarrationEditRate',
      'matchGoalNarrationEditRate',
      'teamTrainingRate',
      'teamRate',
      'hasOwnEquipment',
      'isFederatedReferee',
      'federationName',
      'federationRegistrationNumber',
      'equipmentDescription',
      'pixKey1',
      'pixKey2',
      'pixKey3',
    ];

    for (const key of keys) {
      if (key === 'role') continue;
      const value = payload[key];
      if (value === undefined || value === null || value === '') {
        obj.unset(key);
      } else if (typeof value === 'string') {
        obj.set(key, value.trim());
      } else {
        obj.set(key, value);
      }
    }
  }

  private toProfile(obj: Parse.Object): RoleProfile {
    return {
      objectId: obj.id!,
      role: obj.get('role') as ProfessionalRole,
      peladaRate: obj.get('peladaRate') as number | undefined,
      matchRate: obj.get('matchRate') as number | undefined,
      athleteRate: obj.get('athleteRate') as number | undefined,
      peladaLiveRate: obj.get('peladaLiveRate') as number | undefined,
      matchLiveRate: obj.get('matchLiveRate') as number | undefined,
      peladaHighlightEditRate: obj.get('peladaHighlightEditRate') as number | undefined,
      matchHighlightEditRate: obj.get('matchHighlightEditRate') as number | undefined,
      peladaGoalNarrationEditRate: obj.get('peladaGoalNarrationEditRate') as number | undefined,
      matchGoalNarrationEditRate: obj.get('matchGoalNarrationEditRate') as number | undefined,
      teamTrainingRate: obj.get('teamTrainingRate') as number | undefined,
      teamRate: obj.get('teamRate') as number | undefined,
      hasOwnEquipment: obj.get('hasOwnEquipment') as boolean | undefined,
      hasUniform: obj.get('hasUniform') as boolean | undefined,
      hasFlags: obj.get('hasFlags') as boolean | undefined,
      flagAssistantUserIds: Array.isArray(obj.get('flagAssistantUserIds'))
        ? (obj.get('flagAssistantUserIds') as string[])
        : undefined,
      hasMarkingAssistants: obj.get('hasMarkingAssistants') as boolean | undefined,
      markingAssistantUserIds: Array.isArray(obj.get('markingAssistantUserIds'))
        ? (obj.get('markingAssistantUserIds') as string[])
        : undefined,
      isFederatedReferee: obj.get('isFederatedReferee') as boolean | undefined,
      federationName: obj.get('federationName') as string | undefined,
      federationRegistrationNumber: obj.get('federationRegistrationNumber') as string | undefined,
      equipmentDescription: obj.get('equipmentDescription') as string | undefined,
      pixKey1: obj.get('pixKey1') as string | undefined,
      pixKey2: obj.get('pixKey2') as string | undefined,
      pixKey3: obj.get('pixKey3') as string | undefined,
    };
  }
}
