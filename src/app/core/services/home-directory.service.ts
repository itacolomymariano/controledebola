import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address, emptyAddress, normalizeBrazilUf } from '../models/address.model';
import { ProfileRole } from '../models/profile-role.model';
import { SEARCHABLE_PROFILE_ROLES } from '../models/profile-search.model';
import { normalizeSearchText } from '../utils/search-text.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const PAGE_SIZE = 100;
const MAX_ROWS = 400;

export interface HomeTeamBrief {
  objectId: string;
  name: string;
  presidentName: string;
  imageUrl?: string;
  address: Address;
}

export interface HomeDirectoryUser {
  userId: string;
  apelido: string;
  fullName: string;
  /** Nome denormalizado em perfis (userName), quando apelido/nome completo faltam no cliente. */
  profileUserName?: string;
  /** Nome completo para a lista (User.name, perfil ou userName). */
  listFullName: string;
  displayName: string;
  roles: ProfileRole[];
  positions: string[];
  state: string;
  city: string;
  neighborhood: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
}

interface TeamDraft extends HomeTeamBrief {
  presidentId: string;
}

interface UserDraft {
  userId: string;
  apelido: string;
  fullName: string;
  profileUserName: string;
  city: string;
  neighborhood: string;
  state: string;
  latitude?: number;
  longitude?: number;
  avatarUrl?: string;
  roles: ProfileRole[];
  positions: string[];
}

const ROLE_SET = new Set<string>(SEARCHABLE_PROFILE_ROLES);

@Injectable({ providedIn: 'root' })
export class HomeDirectoryService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async listTeams(): Promise<HomeTeamBrief[]> {
    const rows = await Parse.Cloud.run('listHomeDirectoryTeams', { limit: MAX_ROWS });
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => this.cloudRowToTeamBrief(row as Record<string, unknown>))
      .filter((team) => team.objectId && team.name);
  }

  async teamsByIds(ids: string[]): Promise<Map<string, HomeTeamBrief>> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return new Map();
    try {
      const rows = await Parse.Cloud.run('listHomeDirectoryTeams', { objectIds: unique });
      if (!Array.isArray(rows)) return new Map();
      return new Map(
        rows
          .map((row) => this.cloudRowToTeamBrief(row as Record<string, unknown>))
          .filter((team) => team.objectId)
          .map((team) => [team.objectId, team])
      );
    } catch {
      return new Map();
    }
  }

  async listUsers(): Promise<HomeDirectoryUser[]> {
    const map = new Map<string, UserDraft>();
    const sources: Array<{ className: string; role?: ProfileRole }> = [
      { className: 'RoleProfile' },
      { className: 'AthleteProfile', role: 'athlete' },
      { className: 'FanProfile', role: 'fan' },
    ];
    const settled = await Promise.allSettled(
      sources.map((source) =>
        this.findPages(source.className, (query) => {
          query.include('user');
        }).then((rows) => ({ source, rows }))
      )
    );

    let loaded = 0;
    let firstError: unknown;
    for (const result of settled) {
      if (result.status === 'rejected') {
        firstError = firstError ?? result.reason;
        continue;
      }
      loaded += 1;
      for (const row of result.value.rows) {
        this.absorbListRow(map, row, result.value.source.role);
      }
    }

    if (!loaded) {
      throw firstError instanceof Error
        ? firstError
        : new Error('Não foi possível carregar os usuários.');
    }

    return [...map.values()].map((draft) => this.freeze(draft));
  }

  async getPublicUser(userId: string): Promise<HomeDirectoryUser | null> {
    const id = userId.trim();
    if (!id) return null;

    const draft = this.blankUser(id);
    let found = false;

    try {
      const user = await new Parse.Query(Parse.User).get(id);
      found = true;
      this.applyUser(draft, user);
    } catch {
      /* o ponteiro do usuario pode nao ser legivel */
    }

    const sources: Array<{ className: string; role?: ProfileRole }> = [
      { className: 'RoleProfile' },
      { className: 'AthleteProfile', role: 'athlete' },
      { className: 'FanProfile', role: 'fan' },
    ];

    for (const source of sources) {
      try {
        const rows = await this.profilesForUser(source.className, id);
        if (rows.length) found = true;
        for (const row of rows) this.absorbRow(draft, row, source.role);
      } catch {
        /* classe pode estar fechada */
      }
    }

    if (!found) return null;
    return this.freeze(draft);
  }

  private async profilesForUser(className: string, userId: string): Promise<Parse.Object[]> {
    const pointer = Parse.User.createWithoutData(userId);
    const byPointer = new Parse.Query(className);
    byPointer.equalTo('user', pointer);
    byPointer.include('user');
    const byField = new Parse.Query(className);
    byField.equalTo('userId', userId);
    byField.include('user');
    const query = Parse.Query.or(byPointer, byField);
    query.include('user');
    query.limit(40);
    return query.find();
  }

  private async findPages(
    className: string,
    configure: (query: Parse.Query) => void
  ): Promise<Parse.Object[]> {
    const all: Parse.Object[] = [];
    for (let skip = 0; skip < MAX_ROWS; skip += PAGE_SIZE) {
      const query = new Parse.Query(className);
      configure(query);
      query.limit(PAGE_SIZE);
      query.skip(skip);
      const rows = await query.find();
      all.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    return all;
  }

  private absorbListRow(
    map: Map<string, UserDraft>,
    row: Parse.Object,
    fallbackRole?: ProfileRole
  ): void {
    const user = row.get('user') as Parse.User | undefined;
    const userId = user?.id || String(row.get('userId') || '').trim();
    if (!userId) return;
    const draft = map.get(userId) ?? this.blankUser(userId);
    this.absorbRow(draft, row, fallbackRole);
    map.set(userId, draft);
  }

  private absorbRow(draft: UserDraft, row: Parse.Object, fallbackRole?: ProfileRole): void {
    const user = row.get('user') as Parse.User | undefined;
    if (user) this.applyUser(draft, user);

    const role = fallbackRole ?? row.get('role');
    if (isProfileRole(role) && !draft.roles.includes(role)) draft.roles.push(role);
    this.collectPositions(draft, row);

    this.fillText(draft, 'apelido', String(row.get('userApelido') || '').trim());
    this.fillText(draft, 'fullName', String(row.get('userFullName') || '').trim());
    this.fillText(draft, 'city', String(row.get('userCity') || '').trim());
    this.fillText(draft, 'neighborhood', String(row.get('userNeighborhood') || '').trim());
    if (!draft.state) draft.state = normalizeBrazilUf(String(row.get('userState') || ''));
    if (draft.latitude == null) draft.latitude = this.parseCoord(row.get('userLatitude'));
    if (draft.longitude == null) draft.longitude = this.parseCoord(row.get('userLongitude'));
    this.fillAvatar(draft, String(row.get('userAvatarUrl') || '').trim());

    const userName = String(row.get('userName') || '').trim();
    if (userName && !userName.includes('@') && !isPlaceholderName(userName)) {
      if (!draft.profileUserName) draft.profileUserName = userName;
      if (!draft.fullName && userName !== draft.apelido) this.fillText(draft, 'fullName', userName);
      if (!draft.apelido && !draft.fullName) this.fillText(draft, 'apelido', userName);
    }
  }

  private applyUser(draft: UserDraft, user: Parse.User): void {
    this.fillText(draft, 'apelido', String(user.get('apelido') || '').trim());
    this.fillText(draft, 'fullName', String(user.get('name') || '').trim());
    const address = user.get('address') as Address | undefined;
    if (address) {
      this.fillText(draft, 'city', String(address.city || '').trim());
      this.fillText(draft, 'neighborhood', String(address.neighborhood || '').trim());
      if (!draft.state) draft.state = normalizeBrazilUf(address.state);
      if (draft.latitude == null && typeof address.latitude === 'number') {
        draft.latitude = address.latitude;
      }
      if (draft.longitude == null && typeof address.longitude === 'number') {
        draft.longitude = address.longitude;
      }
    }
    if (!draft.avatarUrl) {
      const url = getUserAvatarUrl(user, this.parseFileService);
      if (url) draft.avatarUrl = url;
    }
  }

  private fillText(
    draft: UserDraft,
    key: 'apelido' | 'fullName' | 'city' | 'neighborhood',
    value: string
  ): void {
    if (!value || draft[key]) return;
    draft[key] = value;
  }

  private fillAvatar(draft: UserDraft, url: string): void {
    if (!draft.avatarUrl && url) draft.avatarUrl = url;
  }

  private blankUser(userId: string): UserDraft {
    return {
      userId,
      apelido: '',
      fullName: '',
      profileUserName: '',
      city: '',
      neighborhood: '',
      state: '',
      roles: [],
      positions: [],
    };
  }

  private collectPositions(draft: UserDraft, row: Parse.Object): void {
    for (const key of ['primaryPosition', 'secondaryPosition', 'thirdPosition'] as const) {
      const value = String(row.get(key) || '').trim();
      if (value && !draft.positions.includes(value)) draft.positions.push(value);
    }
  }

  private freeze(draft: UserDraft): HomeDirectoryUser {
    const apelido = draft.apelido.trim();
    const fullName = draft.fullName.trim();
    const profileUserName = draft.profileUserName.trim();
    const listFullName =
      fullName || (profileUserName && profileUserName !== apelido ? profileUserName : '');
    return {
      userId: draft.userId,
      apelido,
      fullName,
      profileUserName: profileUserName || undefined,
      listFullName,
      displayName: apelido || fullName || profileUserName,
      roles: SEARCHABLE_PROFILE_ROLES.filter((role) => draft.roles.includes(role)),
      positions: [...draft.positions],
      state: draft.state,
      city: draft.city,
      neighborhood: draft.neighborhood,
      latitude: draft.latitude,
      longitude: draft.longitude,
      avatarUrl: draft.avatarUrl,
    };
  }

  private toTeamDraft(obj: Parse.Object): TeamDraft {
    const president = obj.get('president') as Parse.User | undefined;
    const apelido = president ? String(president.get('apelido') || '').trim() : '';
    const name = president ? String(president.get('name') || '').trim() : '';
    return {
      objectId: obj.id || '',
      name: String(obj.get('name') || '').trim(),
      presidentId: president?.id || '',
      presidentName: apelido || name,
      address: this.asAddress(obj.get('homeVenueAddress')),
    };
  }

  private publishTeam(team: TeamDraft): HomeTeamBrief {
    return {
      objectId: team.objectId,
      name: team.name,
      presidentName: team.presidentName,
      address: team.address,
    };
  }

  private cloudRowToTeamBrief(row: Record<string, unknown>): HomeTeamBrief {
    const imageUrl = String(row['imageUrl'] || '').trim();
    return {
      objectId: String(row['objectId'] || ''),
      name: String(row['name'] || '').trim(),
      presidentName: String(row['presidentName'] || '').trim(),
      imageUrl: imageUrl || undefined,
      address: this.asAddress(row['homeVenueAddress']),
    };
  }

  private async fillPresidentNames(teams: TeamDraft[]): Promise<void> {
    const missing = [
      ...new Set(teams.filter((team) => team.presidentId && !team.presidentName).map((team) => team.presidentId)),
    ];
    if (!missing.length) return;

    const names = new Map<string, string>();
    for (let index = 0; index < missing.length; index += PAGE_SIZE) {
      const slice = missing.slice(index, index + PAGE_SIZE);
      try {
        const query = new Parse.Query(Parse.User);
        query.containedIn('objectId', slice);
        query.limit(slice.length);
        const users = await query.find();
        for (const user of users) {
          if (!user.id) continue;
          const apelido = String(user.get('apelido') || '').trim();
          const fullName = String(user.get('name') || '').trim();
          names.set(user.id, apelido || fullName);
        }
      } catch {
        return;
      }
    }

    for (const team of teams) {
      if (!team.presidentName && team.presidentId) {
        team.presidentName = names.get(team.presidentId) || '';
      }
    }
  }

  private asAddress(value: unknown): Address {
    if (!value || typeof value !== 'object') return emptyAddress();
    const raw = value as Partial<Address>;
    return {
      street: String(raw.street || ''),
      neighborhood: String(raw.neighborhood || ''),
      city: String(raw.city || ''),
      state: normalizeBrazilUf(raw.state),
      zipCode: String(raw.zipCode || ''),
      latitude: typeof raw.latitude === 'number' ? raw.latitude : undefined,
      longitude: typeof raw.longitude === 'number' ? raw.longitude : undefined,
    };
  }

  private parseCoord(value: unknown): number | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim().replace(',', '.'));
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}

function isProfileRole(value: unknown): value is ProfileRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

function isPlaceholderName(value: string): boolean {
  return new Set(['usuario', 'atleta', 'torcedor']).has(normalizeSearchText(value));
}
