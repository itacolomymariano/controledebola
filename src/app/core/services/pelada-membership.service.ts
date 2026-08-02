import { Injectable } from '@angular/core';
import Parse from 'parse';
import {
  PeladaMembership,
  PeladaMembershipRole,
  PeladaMembershipStatus,
} from '../models/pelada-membership.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import {
  applyMemberDisplayFields,
  MemberDisplayFields,
  membershipDisplayFromObject,
} from '../utils/membership-display.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'PeladaMembership';

@Injectable({ providedIn: 'root' })
export class PeladaMembershipService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async listForPelada(peladaId: string): Promise<PeladaMembership[]> {
    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const query = new Parse.Query(CLASS);
    query.equalTo('pelada', peladaPtr);
    query.include('user');
    query.ascending('joinedAt');
    const results = await query.find();
    return results.map((obj) => this.toMembership(obj));
  }

  async listForPeladaAsAdmin(peladaId: string): Promise<PeladaMembership[]> {
    try {
      const rows = await Parse.Cloud.run('listPeladaMembershipsForAdmin', { peladaId });
      if (Array.isArray(rows)) {
        return rows.map((row) =>
          this.adminRowToMembership(peladaId, row as Record<string, unknown>)
        );
      }
    } catch {
      // Fallback quando a Cloud Function ainda nao foi publicada.
    }

    const [clientMembers, activeFromCloud] = await Promise.all([
      this.listForPelada(peladaId),
      this.listActiveFromCloud(peladaId),
    ]);

    return this.mergeMembershipLists(clientMembers, activeFromCloud ?? []);
  }

  private mergeMembershipLists(
    base: PeladaMembership[],
    overlays: PeladaMembership[]
  ): PeladaMembership[] {
    const priority: Record<PeladaMembershipStatus, number> = {
      active: 3,
      pending: 2,
      inactive: 1,
    };
    const map = new Map<string, PeladaMembership>();

    for (const member of base) {
      map.set(member.userId, member);
    }

    for (const overlay of overlays) {
      const existing = map.get(overlay.userId);
      if (!existing || priority[overlay.status] > priority[existing.status]) {
        map.set(overlay.userId, overlay);
      }
    }

    return Array.from(map.values());
  }

  private adminRowToMembership(
    peladaId: string,
    row: Record<string, unknown>
  ): PeladaMembership {
    const displayName = String(row['displayName'] || row['userName'] || 'Socio');
    return {
      objectId: String(row['objectId'] || ''),
      peladaId,
      userId: String(row['userId'] || ''),
      userName: displayName,
      userApelido: row['apelido'] ? String(row['apelido']) : undefined,
      userFullName: row['fullName'] ? String(row['fullName']) : undefined,
      userNickname: row['apelido'] ? String(row['apelido']) : undefined,
      avatarUrl: row['avatarUrl'] ? String(row['avatarUrl']) : undefined,
      status: (row['status'] as PeladaMembershipStatus) || 'pending',
      role: (row['role'] as PeladaMembershipRole) || 'socio',
      joinedAt: row['joinedAt'] ? new Date(String(row['joinedAt'])) : new Date(),
    };
  }

  async listActiveForDisplay(peladaId: string): Promise<PeladaMembership[]> {
    const fromCloud = await this.listActiveFromCloud(peladaId);
    if (fromCloud) {
      return fromCloud;
    }

    return (await this.listForPelada(peladaId)).filter((member) => member.status === 'active');
  }

  private async listActiveFromCloud(peladaId: string): Promise<PeladaMembership[] | null> {
    try {
      const rows = await Parse.Cloud.run('listPeladaActiveSocios', { peladaId });
      if (!Array.isArray(rows)) {
        return null;
      }
      return rows.map((row) => this.cloudRowToMembership(peladaId, row));
    } catch {
      return null;
    }
  }

  private cloudRowToMembership(peladaId: string, row: Record<string, unknown>): PeladaMembership {
    const displayName = String(row['displayName'] || row['userName'] || 'Socio');
    const apelido = String(row['apelido'] || '');
    const fullName = String(row['fullName'] || '');
    const avatarUrl = row['avatarUrl'] ? String(row['avatarUrl']) : undefined;

    return {
      objectId: String(row['membershipId'] || row['objectId'] || ''),
      peladaId,
      userId: String(row['userId'] || ''),
      userName: displayName,
      userApelido: apelido || undefined,
      userFullName: fullName || undefined,
      avatarUrl,
      status: 'active',
      role: (row['role'] as PeladaMembershipRole) || 'socio',
      joinedAt: row['joinedAt'] ? new Date(String(row['joinedAt'])) : new Date(),
    };
  }

  async getForCurrentUser(peladaId: string): Promise<PeladaMembership | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const query = new Parse.Query(CLASS);
    query.equalTo('pelada', peladaPtr);
    query.equalTo('user', user);
    const result = await query.first();
    return result ? this.toMembership(result) : null;
  }

  async isActiveMember(peladaId: string, userId?: string): Promise<boolean> {
    const user = userId
      ? Parse.User.createWithoutData(userId)
      : Parse.User.current();
    if (!user) return false;

    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const query = new Parse.Query(CLASS);
    query.equalTo('pelada', peladaPtr);
    query.equalTo('user', user);
    query.equalTo('status', 'active');
    const result = await query.first();
    return !!result;
  }

  async addMember(
    peladaId: string,
    userId: string,
    role: PeladaMembershipRole = 'socio',
    display?: MemberDisplayFields
  ): Promise<PeladaMembership> {
    const admin = Parse.User.current();
    if (!admin) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const peladaAdmin = peladaObj.get('admin') as Parse.User | undefined;
    if (peladaAdmin?.id !== admin.id) {
      throw new Error('Apenas o administrador pode adicionar socios.');
    }

    const existing = await this.getForUser(peladaId, userId);
    if (existing) {
      if (existing.status === 'active') {
        throw new Error('Usuario ja e socio desta pelada.');
      }
      return this.updateStatus(existing.objectId, 'active', display);
    }

    const user = await this.fetchUserForDisplay(userId);
    const membership = new Parse.Object(CLASS);
    membership.set('pelada', peladaObj);
    membership.set('user', user);
    membership.set('status', 'active');
    membership.set('role', role);
    membership.set('joinedAt', new Date());
    applyMemberDisplayFields(membership, user, this.parseFileService, display);

    try {
      const saved = await membership.save();
      await saved.fetchWithInclude('user');
      return this.toMembership(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async setSocioActive(
    peladaId: string,
    userId: string,
    active: boolean,
    display?: MemberDisplayFields
  ): Promise<PeladaMembership | null> {
    const admin = Parse.User.current();
    if (!admin) throw new Error('Faca login.');

    const peladaQuery = new Parse.Query('Pelada');
    peladaQuery.include('admin');
    const peladaObj = await peladaQuery.get(peladaId);
    const peladaAdmin = peladaObj.get('admin') as Parse.User | undefined;
    if (peladaAdmin?.id !== admin.id) {
      throw new Error('Apenas o administrador pode alterar socios.');
    }

    const existing = await this.getForUser(peladaId, userId);
    if (active) {
      const maxSocios = Number(peladaObj.get('maxSocios') ?? 0);
      if (maxSocios > 0) {
        const activeMembers = await this.listActiveFromCloud(peladaId);
        const activeCount = activeMembers?.length ?? (await this.listForPelada(peladaId)).filter(
          (member) => member.status === 'active'
        ).length;
        const alreadyActive = existing?.status === 'active';
        if (!alreadyActive && activeCount >= maxSocios) {
          throw new Error(`Limite de ${maxSocios} socios atingido nesta pelada.`);
        }
      }

      if (existing) {
        if (existing.status === 'active') {
          return existing;
        }
        return this.updateStatus(existing.objectId, 'active', display);
      }
      return this.addMember(peladaId, userId, 'socio', display);
    }

    if (!existing || existing.status !== 'active') {
      return existing;
    }

    return this.updateStatus(existing.objectId, 'inactive');
  }

  async updateStatus(
    membershipId: string,
    status: PeladaMembershipStatus,
    display?: MemberDisplayFields
  ): Promise<PeladaMembership> {
    const admin = Parse.User.current();
    if (!admin) throw new Error('Faca login.');

    const query = new Parse.Query(CLASS);
    query.include(['user', 'pelada']);
    const membership = await query.get(membershipId);
    const pelada = membership.get('pelada') as Parse.Object;
    const peladaAdmin = pelada.get('admin') as Parse.User | undefined;
    if (peladaAdmin?.id !== admin.id) {
      throw new Error('Apenas o administrador pode alterar o status.');
    }

    membership.set('status', status);
    const user = membership.get('user') as Parse.User | undefined;
    if (user?.id && status === 'active') {
      const userObj = user.get('apelido') ? user : await this.fetchUserForDisplay(user.id);
      applyMemberDisplayFields(membership, userObj, this.parseFileService, display);
    }

    const saved = await membership.save();
    await saved.fetchWithInclude('user');
    return this.toMembership(saved);
  }

  async requestMembership(peladaId: string): Promise<PeladaMembership> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para solicitar socio.');

    const existing = await this.getForCurrentUser(peladaId);
    if (existing) {
      throw new Error('Voce ja possui vinculo com esta pelada.');
    }

    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);

    const membership = new Parse.Object(CLASS);
    membership.set('pelada', peladaPtr);
    membership.set('user', user);
    membership.set('status', 'pending');
    membership.set('role', 'socio');
    membership.set('joinedAt', new Date());
    applyMemberDisplayFields(membership, user, this.parseFileService);

    try {
      const saved = await membership.save();
      await saved.fetchWithInclude('user');
      return this.toMembership(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  private async fetchUserForDisplay(userId: string): Promise<Parse.User> {
    try {
      return await new Parse.Query(Parse.User).get(userId);
    } catch {
      return Parse.User.createWithoutData(userId) as Parse.User;
    }
  }

  private async getForUser(peladaId: string, userId: string): Promise<PeladaMembership | null> {
    const pelada = Parse.Object.extend('Pelada');
    const peladaPtr = pelada.createWithoutData(peladaId);
    const user = Parse.User.createWithoutData(userId);

    const query = new Parse.Query(CLASS);
    query.equalTo('pelada', peladaPtr);
    query.equalTo('user', user);
    query.include('user');
    query.descending('updatedAt');
    query.limit(20);
    const results = await query.find();
    if (!results.length) {
      return null;
    }

    const priority: Record<PeladaMembershipStatus, number> = {
      active: 3,
      pending: 2,
      inactive: 1,
    };

    const best = results
      .map((obj) => this.toMembership(obj))
      .sort((a, b) => priority[b.status] - priority[a.status])[0];

    return best ?? null;
  }

  private toMembership(obj: Parse.Object): PeladaMembership {
    const user = obj.get('user') as Parse.User | undefined;
    const display = membershipDisplayFromObject(obj, user, this.parseFileService);

    return {
      objectId: obj.id!,
      peladaId: (obj.get('pelada') as Parse.Object)?.id ?? '',
      userId: display.userId,
      userName: display.displayName || 'Socio',
      userApelido: display.apelido,
      userFullName: display.fullName,
      userNickname: display.apelido,
      avatarUrl: display.avatarUrl,
      status: (obj.get('status') as PeladaMembershipStatus) ?? 'pending',
      role: (obj.get('role') as PeladaMembershipRole) ?? 'socio',
      joinedAt: (obj.get('joinedAt') as Date) ?? new Date(),
    };
  }
}
