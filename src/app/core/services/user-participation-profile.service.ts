import { Injectable } from '@angular/core';
import {
  EVENT_REGISTRATION_ROLES,
  PROFILE_ROLE_LABELS,
  ProfileRole,
} from '../models/profile-role.model';
import { PROFESSIONAL_ROLES } from '../models/role-profile.model';
import { AthleteProfileService } from './athlete-profile.service';
import { FanProfileService } from './fan-profile.service';
import { RoleProfileService } from './role-profile.service';

export interface RegisteredProfileOption {
  role: ProfileRole;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class UserParticipationProfileService {
  constructor(
    private readonly athleteProfileService: AthleteProfileService,
    private readonly fanProfileService: FanProfileService,
    private readonly roleProfileService: RoleProfileService
  ) {}

  async listRegisteredEventProfiles(): Promise<RegisteredProfileOption[]> {
    const roles: ProfileRole[] = [];

    if (await this.athleteProfileService.getForCurrentUser()) {
      roles.push('athlete');
    }
    if (await this.fanProfileService.getForCurrentUser()) {
      roles.push('fan');
    }
    for (const role of PROFESSIONAL_ROLES) {
      if (await this.roleProfileService.getForRole(role)) {
        roles.push(role);
      }
    }

    return roles
      .filter((role) => EVENT_REGISTRATION_ROLES.includes(role) && role !== 'referee')
      .map((role) => ({
        role,
        label: PROFILE_ROLE_LABELS[role],
      }));
  }
}
