import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { Address, normalizeAddress } from '../models/address.model';
import {
  CreatePeladaPayload,
  Pelada,
  PeladaListItem,
  PeladaSport,
  UpdatePeladaPayload,
  UpdatePeladaSettingsPayload,
} from '../models/pelada.model';
import { parseErrorMessage } from '../utils/parse-error.util';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { applyMemberDisplayFields, membershipDisplayFromObject, MemberDisplayFields } from '../utils/membership-display.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'Pelada';
const EVENT_CLASS = 'Event';

@Injectable({ providedIn: 'root' })
export class PeladaService {
  private readonly peladasChanged$ = new Subject<void>();
  private legacyMigrationCheckedForUserId: string | null = null;

  readonly onPeladasChanged = this.peladasChanged$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  notifyPeladasChanged(): void {
    this.peladasChanged$.next();
  }

  async getById(id: string): Promise<Pelada | null> {
    const query = new Parse.Query(CLASS);
    query.include('admin');
    const obj = await query.get(id);
    let pelada = this.toPelada(obj);

    // Sempre reconciliar admin via Cloud (Master Key) para evitar nome/adminId desatualizados.
    const fromCloud = await this.fetchPeladaDisplayFromCloud(id);
    if (fromCloud) {
      pelada = {
        ...pelada,
        ...fromCloud,
        adminId: fromCloud.adminId || pelada.adminId,
        adminName: fromCloud.adminName || pelada.adminName,
      };
    }

    const user = Parse.User.current();
    if (user && user.id === pelada.adminId) {
      try {
        pelada = await this.syncAdminDisplayFields(id);
      } catch {
        // Mantem dados ja carregados se a sincronizacao falhar.
      }
    }

    return pelada;
  }

  async syncAdminDisplayFields(peladaId: string): Promise<Pelada> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login.');

    const query = new Parse.Query(CLASS);
    query.include('admin');
    const peladaObj = await query.get(peladaId);
    const admin = peladaObj.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode atualizar os dados de exibicao.');
    }

    this.applyAdminDisplayFields(peladaObj, user);
    const saved = await peladaObj.save();
    return this.toPelada(saved);
  }

  async listForFeed(userCity?: string): Promise<PeladaListItem[]> {
    await this.migrateLegacyEventsForCurrentUser();

    const city = userCity?.toLowerCase().trim();
    const currentUser = Parse.User.current();

    try {
      const rows = await Parse.Cloud.run('listPeladasForFeed');
      if (Array.isArray(rows)) {
        const peladas = rows.map((row) =>
          this.cloudRowToPeladaListItem(row as Record<string, unknown>)
        );
        const withCounts = await this.ensureHeldEventCounts(peladas);
        return this.sortPeladaFeed(withCounts, city, currentUser?.id);
      }
    } catch {
      // Fallback client-side se a Cloud Function ainda nao estiver publicada.
    }

    const query = new Parse.Query(CLASS);
    query.include('admin');
    query.limit(100);
    const results = await query.find();
    const peladas = results.map((obj) => this.toPeladaListItem(obj));
    const withCounts = await this.ensureHeldEventCounts(peladas);
    return this.sortPeladaFeed(withCounts, city, currentUser?.id);
  }

  private resolveIsCurrentUserAdmin(
    pelada: Pick<PeladaListItem, 'adminId' | 'isCurrentUserAdmin'>,
    currentUserId: string | undefined
  ): boolean {
    if (!currentUserId) return false;
    if (pelada.isCurrentUserAdmin) return true;
    return !!pelada.adminId && pelada.adminId === currentUserId;
  }

  async create(payload: CreatePeladaPayload): Promise<Pelada> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para criar uma pelada.');

    const name = payload.name.trim();
    if (!name) throw new Error('Informe o nome da pelada.');

    const pelada = new Parse.Object(CLASS);
    pelada.set('name', name);
    pelada.set('sport', payload.sport);
    pelada.set('admin', user);
    pelada.set('address', normalizeAddress(payload.address));
    pelada.set('memberCount', Math.max(0, payload.memberCount ?? 0));
    pelada.set('monthlyFee', Math.max(0, payload.monthlyFee ?? 0));
    pelada.set('caixaMembersOnly', true);
    pelada.set('socioGoodStandingPaymentExempt', false);
    pelada.set('expulsionBanEventCount', 0);
    pelada.set('maxSocios', 0);
    pelada.set('maxAthletesPerEvent', 0);
    pelada.set('statsConflictSource', 'referee');
    if (payload.foundedAt) pelada.set('foundedAt', payload.foundedAt);

    if (payload.adminPhotoFile) {
      const file = await this.parseFileService.uploadImage(
        payload.adminPhotoFile,
        `pelada-admin-${user.id}`
      );
      pelada.set('adminPhoto', file);
    }

    if (payload.locationPhotoFile) {
      const file = await this.parseFileService.uploadImage(
        payload.locationPhotoFile,
        `pelada-location-${user.id}`
      );
      pelada.set('locationPhoto', file);
    }

    this.applyAdminDisplayFields(pelada, user);

    try {
      const saved = await pelada.save();
      await saved.fetchWithInclude('admin');

      const membership = new Parse.Object('PeladaMembership');
      membership.set('pelada', saved);
      membership.set('user', user);
      membership.set('status', 'active');
      membership.set('role', 'admin');
      membership.set('joinedAt', new Date());
      applyMemberDisplayFields(membership, user, this.parseFileService);
      await membership.save();

      this.notifyPeladasChanged();
      return this.toPelada(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async update(peladaId: string, payload: UpdatePeladaPayload): Promise<Pelada> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para editar a pelada.');

    const query = new Parse.Query(CLASS);
    query.include('admin');
    const pelada = await query.get(peladaId);
    const admin = pelada.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode editar a pelada.');
    }

    if (payload.name?.trim()) pelada.set('name', payload.name.trim());
    if (payload.sport) pelada.set('sport', payload.sport);
    if (payload.address) pelada.set('address', normalizeAddress(payload.address));
    if (payload.memberCount !== undefined) pelada.set('memberCount', Math.max(0, payload.memberCount));
    if (payload.monthlyFee !== undefined) pelada.set('monthlyFee', Math.max(0, payload.monthlyFee));
    if (payload.foundedAt) pelada.set('foundedAt', payload.foundedAt);

    if (payload.adminPhotoFile) {
      const file = await this.parseFileService.uploadImage(
        payload.adminPhotoFile,
        `pelada-admin-${peladaId}`
      );
      pelada.set('adminPhoto', file);
    }

    if (payload.locationPhotoFile) {
      const file = await this.parseFileService.uploadImage(
        payload.locationPhotoFile,
        `pelada-location-${peladaId}`
      );
      pelada.set('locationPhoto', file);
    }

    this.applyAdminDisplayFields(pelada, user);

    try {
      const saved = await pelada.save();
      await saved.fetchWithInclude('admin');
      this.notifyPeladasChanged();
      return this.toPelada(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async updateSettings(peladaId: string, payload: UpdatePeladaSettingsPayload): Promise<Pelada> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para editar configuracoes.');

    const query = new Parse.Query(CLASS);
    query.include('admin');
    const pelada = await query.get(peladaId);
    const admin = pelada.get('admin') as Parse.User | undefined;
    if (admin?.id !== user.id) {
      throw new Error('Apenas o administrador pode editar configuracoes.');
    }

    if (payload.socioGoodStandingPaymentExempt !== undefined) {
      pelada.set('socioGoodStandingPaymentExempt', !!payload.socioGoodStandingPaymentExempt);
    }
    if (payload.expulsionBanEventCount !== undefined) {
      pelada.set('expulsionBanEventCount', Math.max(0, Number(payload.expulsionBanEventCount)));
    }
    if (payload.caixaMembersOnly !== undefined) {
      pelada.set('caixaMembersOnly', !!payload.caixaMembersOnly);
    }
    if (payload.maxSocios !== undefined) {
      pelada.set('maxSocios', Math.max(0, Number(payload.maxSocios)));
    }
    if (payload.maxAthletesPerEvent !== undefined) {
      pelada.set('maxAthletesPerEvent', Math.max(0, Number(payload.maxAthletesPerEvent)));
    }
    if (payload.statsConflictSource !== undefined) {
      pelada.set(
        'statsConflictSource',
        payload.statsConflictSource === 'scout' ? 'scout' : 'referee'
      );
    }
    if (payload.requireProfilePresentationOnFirstEvent !== undefined) {
      pelada.set(
        'requireProfilePresentationOnFirstEvent',
        !!payload.requireProfilePresentationOnFirstEvent
      );
    }
    if (payload.allowTeamSplitAfterEventEnd !== undefined) {
      pelada.set('allowTeamSplitAfterEventEnd', !!payload.allowTeamSplitAfterEventEnd);
    }

    try {
      const saved = await pelada.save();
      await saved.fetchWithInclude('admin');
      this.notifyPeladasChanged();
      return this.toPelada(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  isCurrentUserAdmin(pelada: Pelada): boolean {
    const user = Parse.User.current();
    return !!user && user.id === pelada.adminId;
  }

  formatSport(sport: PeladaSport): string {
    const labels: Record<PeladaSport, string> = {
      campo: 'Campo',
      futsal: 'Futsal',
      society: 'Society',
      beach: 'Beach',
    };
    return labels[sport] ?? sport;
  }

  resetLegacyMigrationCache(): void {
    this.legacyMigrationCheckedForUserId = null;
  }

  async migrateLegacyEventsForCurrentUser(): Promise<void> {
    const user = Parse.User.current();
    if (!user?.id) return;
    if (this.legacyMigrationCheckedForUserId === user.id) return;

    const eventQuery = new Parse.Query(EVENT_CLASS);
    eventQuery.equalTo('admin', user);
    eventQuery.doesNotExist('pelada');
    eventQuery.limit(1);
    const hasLegacy = await eventQuery.first();
    if (!hasLegacy) {
      this.legacyMigrationCheckedForUserId = user.id;
      return;
    }

    const allLegacyQuery = new Parse.Query(EVENT_CLASS);
    allLegacyQuery.equalTo('admin', user);
    allLegacyQuery.doesNotExist('pelada');
    allLegacyQuery.limit(200);
    const legacyEvents = await allLegacyQuery.find();
    if (legacyEvents.length === 0) return;

    const existingQuery = new Parse.Query(CLASS);
    existingQuery.equalTo('admin', user);
    existingQuery.equalTo('name', 'Pelada Legada');
    let peladaObj = await existingQuery.first();

    if (!peladaObj) {
      const address = (legacyEvents[0].get('address') as Address) ?? {
        state: '',
        city: '',
        neighborhood: '',
        zipCode: '',
        street: '',
      };
      peladaObj = new Parse.Object(CLASS);
      peladaObj.set('name', 'Pelada Legada');
      peladaObj.set('sport', 'campo');
      peladaObj.set('admin', user);
      peladaObj.set('address', normalizeAddress(address));
      peladaObj.set('memberCount', 0);
      peladaObj.set('monthlyFee', 0);
      peladaObj.set('foundedAt', legacyEvents[0].get('startTime') as Date);
      await peladaObj.save();

      const membership = new Parse.Object('PeladaMembership');
      membership.set('pelada', peladaObj);
      membership.set('user', user);
      membership.set('status', 'active');
      membership.set('role', 'admin');
      membership.set('joinedAt', new Date());
      await membership.save();
    }

    for (const event of legacyEvents) {
      event.set('pelada', peladaObj);
      await event.save();
    }

    this.legacyMigrationCheckedForUserId = user.id;
  }

  private sortPeladaFeed(
    peladas: Pelada[],
    city: string | undefined,
    currentUserId: string | undefined
  ): PeladaListItem[] {
    const sorted = [...peladas].sort((a, b) => {
      const aNear = city && a.address.city?.toLowerCase().trim() === city ? 1 : 0;
      const bNear = city && b.address.city?.toLowerCase().trim() === city ? 1 : 0;
      if (aNear !== bNear) return bNear - aNear;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted.map((p) => ({
      ...p,
      nearby: !!city && p.address.city?.toLowerCase().trim() === city,
      isCurrentUserAdmin: this.resolveIsCurrentUserAdmin(p, currentUserId),
    }));
  }

  private cloudRowToPeladaListItem(row: Record<string, unknown>): PeladaListItem {
    const address = (row['address'] as Address) ?? {
      state: '',
      city: '',
      neighborhood: '',
      zipCode: '',
      street: '',
    };
    const foundedAtRaw = row['foundedAt'];
    const rawHeld = row['heldEventCount'] ?? row['eventCount'];
    const heldEventCount =
      rawHeld == null || rawHeld === ''
        ? undefined
        : Number(rawHeld);
    return {
      objectId: String(row['objectId'] || ''),
      name: String(row['name'] || ''),
      sport: (row['sport'] as PeladaSport) ?? 'campo',
      adminId: String(row['adminId'] || ''),
      adminName: String(row['adminName'] || row['adminApelido'] || 'Administrador'),
      adminApelido: (row['adminApelido'] as string | undefined) || undefined,
      adminAvatarUrl: (row['adminAvatarUrl'] as string | undefined) || undefined,
      adminPhotoUrl: (row['adminPhotoUrl'] as string | undefined) || undefined,
      address,
      locationPhotoUrl: (row['locationPhotoUrl'] as string | undefined) || undefined,
      memberCount: Number(row['memberCount'] ?? 0),
      foundedAt: foundedAtRaw ? new Date(foundedAtRaw as string | Date) : undefined,
      monthlyFee: Number(row['monthlyFee'] ?? 0),
      socioGoodStandingPaymentExempt: !!row['socioGoodStandingPaymentExempt'],
      expulsionBanEventCount: Number(row['expulsionBanEventCount'] ?? 0),
      caixaMembersOnly: row['caixaMembersOnly'] !== false,
      maxSocios: Number(row['maxSocios'] ?? 0),
      maxAthletesPerEvent: Number(row['maxAthletesPerEvent'] ?? 0),
      statsConflictSource: row['statsConflictSource'] === 'scout' ? 'scout' : 'referee',
      requireProfilePresentationOnFirstEvent: !!row['requireProfilePresentationOnFirstEvent'],
      allowTeamSplitAfterEventEnd: !!row['allowTeamSplitAfterEventEnd'],
      heldEventCount:
        heldEventCount != null && Number.isFinite(heldEventCount) ? heldEventCount : undefined,
      isCurrentUserAdmin: !!row['isCurrentUserAdmin'],
    };
  }

  private toPeladaListItem(obj: Parse.Object): PeladaListItem {
    return {
      ...this.toPelada(obj),
      heldEventCount: undefined,
    };
  }

  /** Espelha Cloud `hasSavedTeamSplit`: separacao salva com ao menos um time preenchido. */
  private hasSavedTeamSplit(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false;
    const teams = (raw as { teams?: unknown }).teams;
    if (!Array.isArray(teams)) return false;
    return teams.some((team) => Array.isArray(team) && team.length > 0);
  }

  /**
   * Conta eventos realizados por pelada quando a Cloud ainda nao envia heldEventCount
   * (fallback) ou quando o valor veio ausente.
   */
  private async ensureHeldEventCounts(peladas: PeladaListItem[]): Promise<PeladaListItem[]> {
    if (!peladas.length) return peladas;
    const needsCount = peladas.some((pelada) => pelada.heldEventCount == null);
    if (!needsCount) return peladas;

    const pointers = peladas.map((pelada) =>
      Parse.Object.extend(CLASS).createWithoutData(pelada.objectId)
    );
    const query = new Parse.Query(EVENT_CLASS);
    query.containedIn('pelada', pointers);
    query.select('pelada', 'teamSplit');
    query.limit(10000);
    const events = await query.find();
    const counts = new Map<string, number>();
    for (const event of events) {
      const peladaPtr = event.get('pelada') as Parse.Object | undefined;
      const peladaId = peladaPtr?.id;
      if (!peladaId) continue;
      if (!this.hasSavedTeamSplit(event.get('teamSplit'))) continue;
      counts.set(peladaId, (counts.get(peladaId) ?? 0) + 1);
    }

    return peladas.map((pelada) => ({
      ...pelada,
      heldEventCount: counts.get(pelada.objectId) ?? pelada.heldEventCount ?? 0,
    }));
  }

  private toPelada(obj: Parse.Object): Pelada {
    const admin = obj.get('admin') as Parse.User | undefined;
    const address = normalizeAddress(
      (obj.get('address') as Address) ?? {
        state: '',
        city: '',
        neighborhood: '',
        zipCode: '',
        street: '',
      }
    );
    const adminPhoto = obj.get('adminPhoto') as Parse.File | undefined;
    const locationPhoto = obj.get('locationPhoto') as Parse.File | undefined;

    // Preferir identidade do ponteiro admin (fonte da verdade) sobre campos desnormalizados.
    const liveApelido = ((admin?.get('apelido') as string) || '').trim();
    const liveName = ((admin?.get('name') as string) || '').trim();
    const liveUsername = (admin?.getUsername() || '').trim();
    const hasLiveAdminIdentity = !!(liveApelido || liveName || liveUsername);

    const storedApelido = (obj.get('adminApelido') as string | undefined)?.trim() || '';
    const storedName = (obj.get('adminName') as string | undefined)?.trim() || '';

    const adminApelido = hasLiveAdminIdentity ? liveApelido : storedApelido || liveApelido;
    const adminName = hasLiveAdminIdentity
      ? liveApelido || liveName || liveUsername || 'Administrador'
      : storedName || storedApelido || liveApelido || liveName || liveUsername || 'Administrador';
    const adminAvatarUrl =
      getUserAvatarUrl(admin, this.parseFileService) ||
      (obj.get('adminAvatarUrl') as string | undefined)?.trim() ||
      undefined;

    const storedAdminUserId = (obj.get('adminUserId') as string | undefined)?.trim() || '';

    return {
      objectId: obj.id!,
      name: obj.get('name') as string,
      sport: (obj.get('sport') as PeladaSport) ?? 'campo',
      adminId: admin?.id || storedAdminUserId || '',
      adminName,
      adminApelido: adminApelido || undefined,
      adminAvatarUrl,
      adminPhotoUrl: this.parseFileService.getFileUrl(adminPhoto) ?? undefined,
      address,
      locationPhotoUrl: this.parseFileService.getFileUrl(locationPhoto) ?? undefined,
      memberCount: Number(obj.get('memberCount') ?? 0),
      foundedAt: obj.get('foundedAt') as Date | undefined,
      monthlyFee: Number(obj.get('monthlyFee') ?? 0),
      socioGoodStandingPaymentExempt: !!obj.get('socioGoodStandingPaymentExempt'),
      expulsionBanEventCount: Number(obj.get('expulsionBanEventCount') ?? 0),
      caixaMembersOnly: obj.get('caixaMembersOnly') !== false,
      maxSocios: Number(obj.get('maxSocios') ?? 0),
      maxAthletesPerEvent: Number(obj.get('maxAthletesPerEvent') ?? 0),
      statsConflictSource:
        obj.get('statsConflictSource') === 'scout' ? 'scout' : 'referee',
      requireProfilePresentationOnFirstEvent: !!obj.get('requireProfilePresentationOnFirstEvent'),
      allowTeamSplitAfterEventEnd: !!obj.get('allowTeamSplitAfterEventEnd'),
    };
  }

  private async fetchPeladaDisplayFromCloud(
    peladaId: string
  ): Promise<Partial<Pick<Pelada, 'adminId' | 'adminName' | 'adminApelido' | 'adminAvatarUrl'>> | null> {
    try {
      const result = await Parse.Cloud.run('getPeladaDisplayInfo', { peladaId });
      if (!result || typeof result !== 'object') {
        return null;
      }
      const row = result as {
        adminId?: string;
        adminName?: string;
        adminApelido?: string;
        adminAvatarUrl?: string;
      };
      if (!row.adminName && !row.adminApelido && !row.adminId) {
        return null;
      }
      const patch: Partial<Pick<Pelada, 'adminId' | 'adminName' | 'adminApelido' | 'adminAvatarUrl'>> =
        {};
      if (row.adminId) patch.adminId = row.adminId;
      if (row.adminName || row.adminApelido) {
        patch.adminName = row.adminName || row.adminApelido || 'Administrador';
      }
      if (row.adminApelido) patch.adminApelido = row.adminApelido;
      if (row.adminAvatarUrl) patch.adminAvatarUrl = row.adminAvatarUrl;
      return patch;
    } catch {
      return null;
    }
  }

  private applyAdminDisplayFields(pelada: Parse.Object, admin: Parse.User): void {
    const apelido = ((admin.get('apelido') as string) || '').trim();
    const fullName = ((admin.get('name') as string) || '').trim();
    const displayName = apelido || fullName || admin.getUsername() || 'Administrador';
    if (admin.id) {
      pelada.set('adminUserId', admin.id);
    }
    pelada.set('adminApelido', apelido);
    pelada.set('adminName', displayName);
    const avatarUrl = getUserAvatarUrl(admin, this.parseFileService);
    if (avatarUrl) {
      pelada.set('adminAvatarUrl', avatarUrl);
    }
  }
}
