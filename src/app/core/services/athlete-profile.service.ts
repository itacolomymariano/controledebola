import { Injectable } from '@angular/core';
import Parse from 'parse';
import { Address } from '../models/address.model';
import {
  AthleteFootPreference,
  AthleteMaritalStatus,
  AthletePersonalStatsConflictSource,
  AthleteProfile,
  CreateAthleteProfilePayload,
} from '../models/athlete-profile.model';
import { getUserAvatarUrl } from '../utils/user-avatar.util';
import { parseErrorMessage } from '../utils/parse-error.util';
import { ParseFileService } from './parse-file.service';
import { ParseService } from './parse.service';

const CLASS = 'AthleteProfile';

export type UpdateAthleteProfilePayload = Partial<
  Pick<
    CreateAthleteProfilePayload,
    | 'primaryPosition'
    | 'secondaryPosition'
    | 'thirdPosition'
    | 'shoeSize'
    | 'height'
    | 'weight'
    | 'maritalStatus'
    | 'footPreference'
    | 'personalTrainerUserId'
    | 'personalScoutUserId'
    | 'personalStatsConflictSource'
    | 'peladaRate'
    | 'teamMatchRate'
  >
>;

@Injectable({ providedIn: 'root' })
export class AthleteProfileService {
  constructor(
    private readonly parseService: ParseService,
    private readonly parseFileService: ParseFileService
  ) {
    this.parseService.init();
  }

  async getForCurrentUser(): Promise<AthleteProfile | null> {
    const user = Parse.User.current();
    if (!user) return null;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    const result = await query.first();
    return result ? this.toProfile(result) : null;
  }

  async create(payload: CreateAthleteProfilePayload): Promise<AthleteProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para criar o perfil de atleta.');

    const existing = await this.getForCurrentUser();
    if (existing) return existing;

    const profile = new Parse.Object(CLASS);
    profile.set('user', user);
    profile.set('primaryPosition', payload.primaryPosition);
    if (payload.secondaryPosition) profile.set('secondaryPosition', payload.secondaryPosition);
    if (payload.thirdPosition) profile.set('thirdPosition', payload.thirdPosition);
    profile.set('shoeSize', payload.shoeSize);
    profile.set('height', payload.height);
    profile.set('weight', payload.weight);
    if (payload.maritalStatus) profile.set('maritalStatus', payload.maritalStatus);
    else profile.unset('maritalStatus');
    if (payload.footPreference) profile.set('footPreference', payload.footPreference);
    else profile.unset('footPreference');
    if (payload.personalTrainerUserId) {
      profile.set('personalTrainerUserId', payload.personalTrainerUserId);
    } else profile.unset('personalTrainerUserId');
    if (payload.personalScoutUserId) profile.set('personalScoutUserId', payload.personalScoutUserId);
    else profile.unset('personalScoutUserId');
    if (payload.personalStatsConflictSource) {
      profile.set('personalStatsConflictSource', payload.personalStatsConflictSource);
    } else profile.unset('personalStatsConflictSource');
    if (payload.peladaRate != null) profile.set('peladaRate', payload.peladaRate);
    if (payload.teamMatchRate != null) profile.set('teamMatchRate', payload.teamMatchRate);
    profile.set('attendanceScore', 100);
    profile.set('totalPresent', 0);
    profile.set('totalAbsent', 0);
    profile.set('totalRegistered', 0);
    this.applyUserDisplayFields(profile, user);

    const saved = await profile.save();
    return this.toProfile(saved);
  }

  async update(payload: UpdateAthleteProfilePayload): Promise<AthleteProfile> {
    const user = Parse.User.current();
    if (!user) throw new Error('Faca login para atualizar o perfil de atleta.');

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    const profile = await query.first();
    if (!profile) throw new Error('Perfil de atleta nao encontrado.');

    if (payload.primaryPosition !== undefined) profile.set('primaryPosition', payload.primaryPosition);
    if (payload.secondaryPosition !== undefined) {
      payload.secondaryPosition
        ? profile.set('secondaryPosition', payload.secondaryPosition)
        : profile.unset('secondaryPosition');
    }
    if (payload.thirdPosition !== undefined) {
      payload.thirdPosition
        ? profile.set('thirdPosition', payload.thirdPosition)
        : profile.unset('thirdPosition');
    }
    if (payload.shoeSize !== undefined) profile.set('shoeSize', payload.shoeSize);
    if (payload.height !== undefined) profile.set('height', payload.height);
    if (payload.weight !== undefined) profile.set('weight', payload.weight);
    if (payload.maritalStatus !== undefined) {
      if (payload.maritalStatus) profile.set('maritalStatus', payload.maritalStatus);
      else profile.unset('maritalStatus');
    }
    if (payload.footPreference !== undefined) {
      if (payload.footPreference) profile.set('footPreference', payload.footPreference);
      else profile.unset('footPreference');
    }
    if (payload.personalTrainerUserId !== undefined) {
      if (payload.personalTrainerUserId) {
        profile.set('personalTrainerUserId', payload.personalTrainerUserId);
      } else profile.unset('personalTrainerUserId');
    }
    if (payload.personalScoutUserId !== undefined) {
      if (payload.personalScoutUserId) {
        profile.set('personalScoutUserId', payload.personalScoutUserId);
      } else profile.unset('personalScoutUserId');
    }
    if (payload.personalStatsConflictSource !== undefined) {
      if (payload.personalStatsConflictSource) {
        profile.set('personalStatsConflictSource', payload.personalStatsConflictSource);
      } else profile.unset('personalStatsConflictSource');
    }
    if (payload.peladaRate !== undefined) profile.set('peladaRate', payload.peladaRate);
    if (payload.teamMatchRate !== undefined) profile.set('teamMatchRate', payload.teamMatchRate);
    this.applyUserDisplayFields(profile, user);

    try {
      const saved = await profile.save();
      return this.toProfile(saved);
    } catch (error: unknown) {
      throw new Error(parseErrorMessage(error));
    }
  }

  async syncDisplayFieldsForCurrentUser(): Promise<void> {
    const user = Parse.User.current();
    if (!user) return;

    const query = new Parse.Query(CLASS);
    query.equalTo('user', user);
    const profile = await query.first();
    if (!profile) return;

    this.applyUserDisplayFields(profile, user);
    await profile.save();
  }

  private applyUserDisplayFields(profile: Parse.Object, user: Parse.User): void {
    const apelido = (user.get('apelido') as string) || '';
    const name = (user.get('name') as string) || '';
    profile.set('userApelido', apelido);
    profile.set('userName', apelido || name || user.getUsername() || 'Atleta');
    if (user.id) profile.set('userId', user.id);

    const address = (user.get('address') as Address | undefined) ?? undefined;
    if (address?.city?.trim()) profile.set('userCity', address.city.trim());
    else profile.unset('userCity');
    if (address?.state?.trim()) profile.set('userState', address.state.trim());
    else profile.unset('userState');
    if (address?.neighborhood?.trim()) {
      profile.set('userNeighborhood', address.neighborhood.trim());
    } else {
      profile.unset('userNeighborhood');
    }

    const avatarUrl = getUserAvatarUrl(user, this.parseFileService);
    if (avatarUrl) profile.set('userAvatarUrl', avatarUrl);
    else profile.unset('userAvatarUrl');
  }

  private toProfile(obj: Parse.Object): AthleteProfile {
    return {
      objectId: obj.id!,
      primaryPosition: obj.get('primaryPosition') as string,
      secondaryPosition: obj.get('secondaryPosition') as string | undefined,
      thirdPosition: obj.get('thirdPosition') as string | undefined,
      shoeSize: obj.get('shoeSize') as number,
      height: obj.get('height') as number,
      weight: obj.get('weight') as number,
      maritalStatus: obj.get('maritalStatus') as AthleteMaritalStatus | undefined,
      footPreference: obj.get('footPreference') as AthleteFootPreference | undefined,
      personalTrainerUserId: obj.get('personalTrainerUserId') as string | undefined,
      personalScoutUserId: obj.get('personalScoutUserId') as string | undefined,
      personalStatsConflictSource: obj.get('personalStatsConflictSource') as
        | AthletePersonalStatsConflictSource
        | undefined,
      peladaRate: obj.get('peladaRate') as number | undefined,
      teamMatchRate: obj.get('teamMatchRate') as number | undefined,
      attendanceScore: (obj.get('attendanceScore') as number) ?? 100,
    };
  }
}
