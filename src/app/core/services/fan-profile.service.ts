import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import { EventInviteCandidate } from '../models/event-hiring.model';
import {
  CreateFanProfilePayload,
  FanProfile,
  UpdateFanProfilePayload,
} from '../models/fan-profile.model';
import { locationProximityScore } from '../utils/location-proximity.util';
import { normalizeSearchText } from '../utils/search-text.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'FanProfile';

@Injectable({ providedIn: 'root' })
export class FanProfileService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async getForCurrentUser(): Promise<FanProfile | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    const result = await query.first();
    return result ? this.toProfile(result) : null;
  }

  async create(payload: CreateFanProfilePayload): Promise<FanProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para criar o perfil de torcedor.');

    const existing = await this.getForCurrentUser();
    if (existing) return this.update(payload);

    const profile = new Parse.Object(CLASS);
    profile.set('user', user);
    if (user.id) profile.set('userId', user.id);
    this.applyPayload(profile, payload);
    this.applyUserDisplayFields(profile, user);

    try {
      const saved = await profile.save();
      return this.toProfile(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async update(payload: UpdateFanProfilePayload): Promise<FanProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para atualizar o perfil de torcedor.');

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    let profile = await query.first();
    if (!profile) {
      return this.create(payload as CreateFanProfilePayload);
    }

    this.applyPayload(profile, payload);
    this.applyUserDisplayFields(profile, user);

    try {
      const saved = await profile.save();
      return this.toProfile(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async listCandidates(eventAddress?: Address): Promise<EventInviteCandidate[]> {
    const byProfileId = new Map<string, EventInviteCandidate>();

    const profileQuery = new Parse.Query(CLASS);
    profileQuery.include('user');
    profileQuery.limit(1000);
    const profiles = await profileQuery.find();

    for (const row of profiles) {
      const candidate = this.toCandidateFromProfile(row, eventAddress);
      if (candidate.userId) byProfileId.set(candidate.userId, candidate);
    }

    try {
      const userQuery = new Parse.Query(Parse.User);
      userQuery.equalTo('primaryRole', 'fan');
      userQuery.limit(1000);
      const users = await userQuery.find();
      for (const user of users) {
        if (!user.id || byProfileId.has(user.id)) continue;
        byProfileId.set(user.id, this.toCandidateFromUser(user, null, eventAddress));
      }
    } catch {
      // CLP pode bloquear busca em _User.
    }

    return this.sortCandidates(Array.from(byProfileId.values()));
  }

  async searchCandidates(search: string, eventAddress?: Address): Promise<EventInviteCandidate[]> {
    const all = await this.listCandidates(eventAddress);
    const normalized = normalizeSearchText(search);
    if (!normalized) return all;

    const filtered = all.filter((candidate) => {
      const haystack = normalizeSearchText(
        `${candidate.userName} ${candidate.apelido} ${candidate.city ?? ''} ${candidate.state ?? ''}`
      );
      return haystack.includes(normalized);
    });

    if (filtered.length || search.trim().length < 2) {
      return filtered;
    }

    const apelidoQuery = new Parse.Query(CLASS);
    apelidoQuery.matches('userApelido', search.trim(), 'i');
    const nameQuery = new Parse.Query(CLASS);
    nameQuery.matches('userName', search.trim(), 'i');
    const rows = await Parse.Query.or(apelidoQuery, nameQuery).limit(200).find();

    const byUserId = new Map(all.map((candidate) => [candidate.userId, candidate]));
    for (const row of rows) {
      const candidate = this.toCandidateFromProfile(row, eventAddress);
      if (!candidate.userId) continue;
      byUserId.set(candidate.userId, candidate);
    }

    return this.filterAndSort(Array.from(byUserId.values()), normalized);
  }

  filterCandidates(candidates: EventInviteCandidate[], search: string): EventInviteCandidate[] {
    const normalized = normalizeSearchText(search);
    if (!normalized) return candidates;
    return this.filterAndSort(candidates, normalized);
  }

  private filterAndSort(candidates: EventInviteCandidate[], normalized: string): EventInviteCandidate[] {
    return this.sortCandidates(
      candidates.filter((candidate) => {
        const haystack = normalizeSearchText(
          `${candidate.userName} ${candidate.apelido} ${candidate.city ?? ''} ${candidate.state ?? ''}`
        );
        return haystack.includes(normalized);
      })
    );
  }

  private sortCandidates(candidates: EventInviteCandidate[]): EventInviteCandidate[] {
    return [...candidates].sort((a, b) => {
      const proximityDiff = (b.proximityScore ?? 0) - (a.proximityScore ?? 0);
      if (proximityDiff !== 0) return proximityDiff;
      return a.userName.localeCompare(b.userName, 'pt-BR');
    });
  }

  private toCandidateFromProfile(row: Parse.Object, eventAddress?: Address): EventInviteCandidate {
    const user = row.get('user') as Parse.User | undefined;
    return {
      ...this.toCandidateFromUser(user, row, eventAddress),
      peladaPresentialRate: row.get('peladaPresentialRate') as number | undefined,
      peladaRemoteRate: row.get('peladaRemoteRate') as number | undefined,
      matchPresentialRate: row.get('matchPresentialRate') as number | undefined,
      matchRemoteRate: row.get('matchRemoteRate') as number | undefined,
    };
  }

  private toCandidateFromUser(
    user: Parse.User | undefined,
    profile: Parse.Object | null,
    eventAddress?: Address
  ): EventInviteCandidate {
    const apelido =
      (profile?.get('userApelido') as string | undefined)?.trim() ||
      (user?.get('apelido') as string | undefined)?.trim() ||
      '';
    const fullName = (user?.get('name') as string | undefined)?.trim() || '';
    const userName =
      (profile?.get('userName') as string | undefined)?.trim() ||
      apelido ||
      fullName ||
      user?.getUsername() ||
      'Torcedor';
    const address = (user?.get('address') as Address | undefined) ?? undefined;

    return {
      userId: user?.id ?? (profile?.get('userId') as string | undefined) ?? '',
      userName,
      apelido,
      avatarUrl:
        (profile?.get('userAvatarUrl') as string | undefined)?.trim() ||
        getUserAvatarUrl(user, this.parseFileService) ||
        undefined,
      city: address?.city,
      state: address?.state,
      proximityScore: locationProximityScore(eventAddress, address),
    };
  }

  private applyPayload(profile: Parse.Object, payload: UpdateFanProfilePayload): void {
    this.setOptionalMoney(profile, 'peladaPresentialRate', payload.peladaPresentialRate);
    this.setOptionalMoney(profile, 'peladaRemoteRate', payload.peladaRemoteRate);
    this.setOptionalMoney(profile, 'matchPresentialRate', payload.matchPresentialRate);
    this.setOptionalMoney(profile, 'matchRemoteRate', payload.matchRemoteRate);
    if (payload.acceptsPaidCommitments !== undefined) {
      profile.set('acceptsPaidCommitments', !!payload.acceptsPaidCommitments);
    }
  }

  private setOptionalMoney(profile: Parse.Object, key: string, value?: number): void {
    if (value == null || Number.isNaN(value)) {
      profile.unset(key);
      return;
    }
    profile.set(key, Math.max(0, value));
  }

  private applyUserDisplayFields(profile: Parse.Object, user: Parse.User): void {
    const apelido = (user.get('apelido') as string) || '';
    const name = (user.get('name') as string) || '';
    profile.set('userApelido', apelido);
    profile.set('userName', apelido || name || user.getUsername() || 'Torcedor');
    if (user.id) profile.set('userId', user.id);
    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) profile.set('userAvatarUrl', avatarUrl);
    else profile.unset('userAvatarUrl');
  }

  private toProfile(obj: Parse.Object): FanProfile {
    return {
      objectId: obj.id!,
      peladaPresentialRate: obj.get('peladaPresentialRate') as number | undefined,
      peladaRemoteRate: obj.get('peladaRemoteRate') as number | undefined,
      matchPresentialRate: obj.get('matchPresentialRate') as number | undefined,
      matchRemoteRate: obj.get('matchRemoteRate') as number | undefined,
      acceptsPaidCommitments: !!obj.get('acceptsPaidCommitments'),
    };
  }
}
