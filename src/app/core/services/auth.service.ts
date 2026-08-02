import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import Parse from 'parse';
import { MIN_PASSWORD_LENGTH } from '../constants/auth.constants';
import { Address, isAddressComplete } from '../models/address.model';
import { ProfileRole } from '../models/profile-role.model';
import {
  isInvalidCloudFunctionError,
  isInvalidSessionError,
  isNetworkError,
  parseErrorMessage,
} from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';
import { RegistrationService } from './registration.service';
import { RoleProfileService } from './role-profile.service';
import { AthleteProfileService } from './athlete-profile.service';
import { PushNotificationService } from './push-notification.service';

export interface RegisterPayload {
  name: string;
  apelido: string;
  email?: string;
  phone?: string;
  password: string;
  address: Address;
  birthDate?: Date;
  signupChallengeId?: string;
  signupCaptchaAnswer?: number;
  signupStartedAt?: Date;
  signupHoneypot?: string;
}

export interface UpdateUserProfilePayload {
  birthDate?: Date | null;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
}

export interface UpdateUserAccountPayload {
  name: string;
  apelido: string;
  email?: string;
  phone?: string;
  address: Address;
  birthDate?: Date | null;
  proFootballIdol?: string;
  amateurFootballIdol?: string;
  favoriteProTeam?: string;
  favoriteAmateurTeam?: string;
  showPhoneInProfile?: boolean;
  showEmailInProfile?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profileChanged$ = new Subject<void>();
  private displaySyncDoneForSession = false;

  readonly onProfileChanged = this.profileChanged$.asObservable();

  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService,
    private readonly registrationService: RegistrationService,
    private readonly roleProfileService: RoleProfileService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly pushNotificationService: PushNotificationService
  ) {
    this.parseService.init();
  }

  isLoggedIn(): boolean {
    return Parse.User.current() !== null;
  }

  /** Valida sessao no servidor; limpa cache local se token invalido ou usuario removido. */
  async validateSession(): Promise<boolean> {
    const user = Parse.User.current();
    if (!user) return false;

    try {
      await user.fetch();
      this.profileChanged$.next();
      return true;
    } catch (error: unknown) {
      if (isInvalidSessionError(error)) {
        await this.clearLocalSession();
        return false;
      }
      if (isNetworkError(error)) {
        return false;
      }
      throw error;
    }
  }

  async clearLocalSession(): Promise<void> {
    this.displaySyncDoneForSession = false;
    try {
      await this.pushNotificationService.clearCurrentUser();
    } catch {
      // Nao impede logout se push falhar.
    }
    try {
      await Parse.User.logOut();
    } catch {
      Parse.User._clearCache();
    }
  }

  getCurrentUser(): Parse.User | null {
    return Parse.User.current();
  }

  getDisplayName(): string {
    const user = this.getCurrentUser();
    return (
      (user?.get('apelido') as string) ||
      (user?.get('name') as string) ||
      user?.getUsername() ||
      'Usuario'
    );
  }

  getApelido(): string {
    const user = this.getCurrentUser();
    return (user?.get('apelido') as string) || '';
  }

  async fetchCurrentUser(): Promise<Parse.User | null> {
    const user = this.getCurrentUser();
    if (!user) return null;

    try {
      await user.fetch();
      await this.ensureUserAvatarUrlPublished(user);
      return user;
    } catch (error: unknown) {
      if (isInvalidSessionError(error)) {
        await this.clearLocalSession();
        return null;
      }
      throw error;
    }
  }

  getAvatarUrl(): string | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    const directUrl = user.get('avatarUrl') as string | undefined;
    if (directUrl?.trim()) return directUrl.trim();

    const avatar = user.get('avatar') as Parse.File | { url?: string } | string | undefined;
    return this.parseFileService.getFileUrl(avatar);
  }

  async updateAvatar(file: File): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Faca login para alterar a foto de perfil.');

    const avatar = await this.parseFileService.uploadImage(file, `avatar-${user.id}`);
    user.set('avatar', avatar);
    const avatarUrl = this.parseFileService.getFileUrl(avatar);
    if (avatarUrl) {
      user.set('avatarUrl', avatarUrl);
    }

    try {
      await user.save();
      this.profileChanged$.next();
      if (avatarUrl) {
        void this.syncAvatarDisplayInBackground(avatarUrl);
      }
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  private syncAvatarDisplayInBackground(avatarUrl: string): void {
    void Parse.Cloud.run('syncUserAvatarForDisplay', { avatarUrl })
      .catch(() => {
        void this.registrationService.syncAvatarUrlForCurrentUser(avatarUrl);
        void this.roleProfileService.syncDisplayFieldsForCurrentUser();
        void this.athleteProfileService.syncDisplayFieldsForCurrentUser();
      });
  }

  private async ensureUserAvatarUrlPublished(user: Parse.User): Promise<void> {
    if (this.displaySyncDoneForSession) return;

    const fromFile = this.parseFileService.getFileUrl(
      user.get('avatar') as Parse.File | { url?: string } | string | undefined
    );
    const stored = (user.get('avatarUrl') as string | undefined)?.trim();

    if (fromFile && fromFile !== stored) {
      user.set('avatarUrl', fromFile);
      await user.save();
      await this.registrationService.syncAvatarUrlForCurrentUser(fromFile);
      return;
    }

    if (stored) {
      await this.registrationService.syncAvatarUrlForCurrentUser(stored);
    }

    await this.roleProfileService.syncDisplayFieldsForCurrentUser();
    await this.athleteProfileService.syncDisplayFieldsForCurrentUser();
    this.displaySyncDoneForSession = true;
  }

  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  phoneVariants(phone: string): string[] {
    const digits = this.normalizePhone(phone);
    const variants = new Set<string>();
    if (!digits) return [];

    variants.add(digits);
    const stored = this.normalizePhoneForStorage(phone);
    if (stored) variants.add(stored);

    if (digits.length === 11) {
      variants.add(`55${digits}`);
      if (digits[2] === '9') {
        variants.add(`${digits.slice(0, 2)}${digits.slice(3)}`);
      }
    }
    if (digits.startsWith('55') && digits.length >= 12) {
      variants.add(digits.slice(2));
      variants.add(`+${digits}`);
    }
    if (digits.length === 10) {
      variants.add(`55${digits}`);
      variants.add(`${digits.slice(0, 2)}9${digits.slice(2)}`);
    }
    return Array.from(variants);
  }

  private loginPhoneCandidates(identifier: string): string[] {
    const candidates = new Set<string>();
    for (const variant of this.phoneVariants(identifier)) {
      if (variant) candidates.add(variant);
    }
    return Array.from(candidates);
  }

  normalizePhoneForStorage(phone: string): string {
    const digits = this.normalizePhone(phone);
    if (digits.length === 13 && digits.startsWith('55')) {
      return digits.slice(2);
    }
    return digits;
  }

  isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  resolveUsername(email?: string, phone?: string): string {
    if (phone?.trim()) {
      const stored = this.normalizePhoneForStorage(phone);
      if (stored.length >= 10) return stored;
    }
    if (email?.trim()) return email.trim().toLowerCase();
    throw new Error('Informe e-mail ou celular.');
  }

  async register(payload: RegisterPayload): Promise<Parse.User> {
    const name = payload.name.trim();
    const apelido = payload.apelido.trim();

    if (name.length < 2) {
      throw new Error('Informe o nome completo (minimo 2 caracteres).');
    }

    if (apelido.length < 2) {
      throw new Error('Informe um apelido (minimo 2 caracteres).');
    }

    if (!isAddressComplete(payload.address)) {
      throw new Error('Selecione seu endereco na lista para validar a localizacao.');
    }

    if (payload.email?.trim() && !this.isEmail(payload.email)) {
      throw new Error('E-mail invalido.');
    }

    if (payload.phone?.trim() && this.normalizePhoneForStorage(payload.phone).length < 10) {
      throw new Error('Celular invalido. Informe DDD + numero (minimo 10 digitos).');
    }

    try {
      await Parse.Cloud.run('registerUser', {
        name,
        apelido,
        email: payload.email?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        password: payload.password,
        address: payload.address,
        birthDate: payload.birthDate ?? undefined,
        signupChallengeId: payload.signupChallengeId,
        signupCaptchaAnswer: payload.signupCaptchaAnswer,
        signupStartedAt: payload.signupStartedAt,
        signupHoneypot: payload.signupHoneypot || '',
      });

      const username = this.resolveUsername(payload.email, payload.phone);
      const savedUser = await Parse.User.logIn(username, payload.password);
      void this.pushNotificationService.syncCurrentUser();
      return savedUser;
    } catch (error: unknown) {
      if (isInvalidCloudFunctionError(error)) {
        return this.registerViaClient(payload);
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private async registerViaClient(payload: RegisterPayload): Promise<Parse.User> {
    const name = payload.name.trim();
    const apelido = payload.apelido.trim();
    const email = payload.email?.trim().toLowerCase();
    const normalizedPhone = payload.phone?.trim()
      ? this.normalizePhoneForStorage(payload.phone)
      : '';
    const username = this.resolveUsername(email, payload.phone);

    const user = new Parse.User();
    user.set('username', username);
    user.set('password', payload.password);
    user.set('name', name);
    user.set('apelido', apelido);
    user.set('address', payload.address);

    if (email) {
      user.set('email', email);
    }
    if (normalizedPhone) {
      user.set('phone', normalizedPhone);
    }
    if (payload.birthDate) {
      user.set('birthDate', payload.birthDate);
    }
    if (payload.signupChallengeId) {
      user.set('signupChallengeId', payload.signupChallengeId);
    }
    if (payload.signupCaptchaAnswer != null) {
      user.set('signupCaptchaAnswer', payload.signupCaptchaAnswer);
    }
    if (payload.signupStartedAt) {
      user.set('signupStartedAt', payload.signupStartedAt);
    }
    if (payload.signupHoneypot) {
      user.set('signupHoneypot', payload.signupHoneypot);
    }

    try {
      const savedUser = await user.signUp();
      void this.pushNotificationService.syncCurrentUser();
      return savedUser;
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  needsPasswordUpgrade(password: string): boolean {
    return password.length < MIN_PASSWORD_LENGTH;
  }

  async login(identifier: string, password: string): Promise<Parse.User> {
    const trimmed = identifier.trim();
    if (!trimmed) {
      throw new Error('Informe e-mail ou celular.');
    }
    if (!password) {
      throw new Error('Informe sua senha.');
    }

    if (this.isEmail(trimmed)) {
      const candidates = this.buildLoginUsernameCandidates(trimmed);
      const directLogin = await this.tryLoginCandidates(candidates, password);
      if (directLogin) {
        return directLogin;
      }

      const resolvedUsername = await this.resolveLoginUsernameViaCloud(trimmed);
      if (resolvedUsername) {
        const cloudLogin = await this.tryLoginCandidates([resolvedUsername], password);
        if (cloudLogin) {
          return cloudLogin;
        }
      }
    } else {
      const candidates = this.buildLoginUsernameCandidates(trimmed);
      const directLogin = await this.tryLoginCandidates(candidates, password);
      if (directLogin) {
        return directLogin;
      }

      const resolvedUsername = await this.resolveLoginUsernameViaCloud(trimmed);
      if (resolvedUsername) {
        const cloudLogin = await this.tryLoginCandidates([resolvedUsername], password);
        if (cloudLogin) {
          return cloudLogin;
        }
      }
    }

    throw new Error('E-mail/celular ou senha incorretos.');
  }

  private buildLoginUsernameCandidates(identifier: string): string[] {
    const trimmed = identifier.trim();
    const candidates = new Set<string>();

    if (this.isEmail(trimmed)) {
      candidates.add(trimmed.toLowerCase());
      return Array.from(candidates);
    }

    const digits = this.normalizePhone(trimmed);
    if (digits.length < 10) {
      return [];
    }

    candidates.add(this.normalizePhoneForStorage(trimmed));
    for (const variant of this.loginPhoneCandidates(trimmed)) {
      candidates.add(variant);
    }

    return Array.from(candidates).filter((value) => value.length > 0);
  }

  private async resolveLoginUsernameViaCloud(identifier: string): Promise<string | null> {
    try {
      const result = await Parse.Cloud.run('resolveLoginUsername', { identifier: identifier.trim() });
      if (typeof result === 'string' && result.trim()) {
        return result.trim();
      }
      if (result && typeof result === 'object' && typeof (result as { username?: string }).username === 'string') {
        const username = (result as { username: string }).username.trim();
        return username || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async tryLoginCandidates(
    candidates: string[],
    password: string
  ): Promise<Parse.User | null> {
    for (const candidate of candidates) {
      if (!candidate.trim()) continue;
      try {
        return await this.loginAndSync(candidate, password);
      } catch (error: unknown) {
        if (this.isInvalidCredentialsError(error)) {
          continue;
        }
        throw new Error(parseErrorMessage(error));
      }
    }
    return null;
  }

  async updateUserAccount(payload: UpdateUserAccountPayload): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Faca login para atualizar seus dados.');

    const name = payload.name.trim();
    const apelido = payload.apelido.trim();
    if (name.length < 2) {
      throw new Error('Informe o nome completo (minimo 2 caracteres).');
    }
    if (apelido.length < 2) {
      throw new Error('Informe um apelido (minimo 2 caracteres).');
    }
    if (!payload.email?.trim() && !payload.phone?.trim()) {
      throw new Error('Informe e-mail ou celular.');
    }
    if (!isAddressComplete(payload.address)) {
      throw new Error('Selecione seu endereco na lista para validar a localizacao.');
    }

    try {
      await Parse.Cloud.run('updateUserAccount', {
        name,
        apelido,
        email: payload.email?.trim() || undefined,
        phone: payload.phone?.trim() || undefined,
        address: payload.address,
        birthDate: payload.birthDate ? payload.birthDate.toISOString() : null,
        proFootballIdol: payload.proFootballIdol?.trim() ?? '',
        amateurFootballIdol: payload.amateurFootballIdol?.trim() ?? '',
        favoriteProTeam: payload.favoriteProTeam?.trim() ?? '',
        favoriteAmateurTeam: payload.favoriteAmateurTeam?.trim() ?? '',
        showPhoneInProfile: !!payload.showPhoneInProfile,
        showEmailInProfile: !!payload.showEmailInProfile,
      });
      await user.fetch();
      await this.ensureUserAvatarUrlPublished(user);
      this.profileChanged$.next();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Faca login para alterar sua senha.');

    const current = currentPassword.trim();
    const next = newPassword.trim();
    if (!current) {
      throw new Error('Informe sua senha atual.');
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`A nova senha deve ter no minimo ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    try {
      await Parse.Cloud.run('changeUserPassword', {
        currentPassword: current,
        newPassword: next,
      });
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async updatePersonalProfile(payload: UpdateUserProfilePayload): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Faca login para atualizar seu perfil.');

    if (payload.birthDate !== undefined) {
      if (payload.birthDate) {
        user.set('birthDate', payload.birthDate);
      } else {
        user.unset('birthDate');
      }
    }
    if (payload.proFootballIdol !== undefined) {
      const value = payload.proFootballIdol.trim();
      if (value) user.set('proFootballIdol', value);
      else user.unset('proFootballIdol');
    }
    if (payload.amateurFootballIdol !== undefined) {
      const value = payload.amateurFootballIdol.trim();
      if (value) user.set('amateurFootballIdol', value);
      else user.unset('amateurFootballIdol');
    }

    try {
      await user.save();
      this.profileChanged$.next();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  getBirthDate(): Date | null {
    const value = this.getCurrentUser()?.get('birthDate') as Date | undefined;
    return value ?? null;
  }

  getProFootballIdol(): string {
    return (this.getCurrentUser()?.get('proFootballIdol') as string) || '';
  }

  getAmateurFootballIdol(): string {
    return (this.getCurrentUser()?.get('amateurFootballIdol') as string) || '';
  }

  getFavoriteProTeam(): string {
    return (this.getCurrentUser()?.get('favoriteProTeam') as string) || '';
  }

  getFavoriteAmateurTeam(): string {
    return (this.getCurrentUser()?.get('favoriteAmateurTeam') as string) || '';
  }

  private async loginAndSync(username: string, password: string): Promise<Parse.User> {
    const user = await this.attemptLogin(username, password);
    this.profileChanged$.next();
    void this.runDeferredLoginSync(user);
    return user;
  }

  private async runDeferredLoginSync(user: Parse.User): Promise<void> {
    try {
      await user.fetch();
    } catch {
      // Sessao valida apos logIn; fetch pode falhar por rede sem impedir o acesso.
    }

    try {
      await this.ensureUserAvatarUrlPublished(user);
      await this.pushNotificationService.syncCurrentUser();
      this.profileChanged$.next();
    } catch {
      // Sync de avatar/perfis em background; nao bloqueia entrada no app.
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !this.isEmail(normalized)) {
      throw new Error('Informe um e-mail valido.');
    }

    try {
      await Parse.User.requestPasswordReset(normalized);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async logout(): Promise<void> {
    await this.clearLocalSession();
  }

  getPrimaryRole(): ProfileRole | null {
    const user = this.getCurrentUser();
    const role = user?.get('primaryRole') as ProfileRole | undefined;
    return role ?? null;
  }

  async setPrimaryRole(role: ProfileRole): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Faca login para salvar seu perfil.');

    user.set('primaryRole', role);
    try {
      await user.save();
      this.profileChanged$.next();
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  /** Se a API retornar sessao invalida, limpa local e redireciona para login. */
  async handleApiError(error: unknown): Promise<boolean> {
    if (!isInvalidSessionError(error)) return false;
    await this.clearLocalSession();
    return true;
  }

  private async attemptLogin(username: string, password: string): Promise<Parse.User> {
    try {
      return await Parse.User.logIn(username, password);
    } catch (error: unknown) {
      if (this.isInvalidCredentialsError(error)) {
        throw error;
      }
      throw new Error(parseErrorMessage(error));
    }
  }

  private isInvalidCredentialsError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as { code?: number; message?: string };
    return err.code === 101 || /invalid username|username\/password/i.test(err.message ?? '');
  }
}
