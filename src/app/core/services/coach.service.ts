import { Injectable } from '@angular/core';
import { PeladaListItem } from '../models/pelada.model';
import { AthleteProfileService } from './athlete-profile.service';
import { RoleProfileService } from './role-profile.service';

export interface CoachTip {
  id: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
  route: string;
}

@Injectable({ providedIn: 'root' })
export class CoachService {
  constructor(
    private readonly athleteProfile: AthleteProfileService,
    private readonly roleProfile: RoleProfileService
  ) {}

  async suggest(peladas: PeladaListItem[]): Promise<CoachTip> {
    const [athlete, referee, scout] = await Promise.all([
      this.athleteProfile.getForCurrentUser(),
      this.roleProfile.getForRole('referee'),
      this.roleProfile.getForRole('scout'),
    ]);

    if (!athlete) {
      return {
        id: 'athlete',
        titleKey: 'coach.athleteTitle',
        bodyKey: 'coach.athleteBody',
        ctaKey: 'coach.athleteCta',
        route: '/athlete-profile/form',
      };
    }

    if (!peladas.length) {
      return {
        id: 'find-pelada',
        titleKey: 'coach.findPeladaTitle',
        bodyKey: 'coach.findPeladaBody',
        ctaKey: 'coach.findPeladaCta',
        route: '/tabs/search',
      };
    }

    if (referee) {
      return {
        id: 'sumula',
        titleKey: 'coach.sumulaTitle',
        bodyKey: 'coach.sumulaBody',
        ctaKey: 'coach.sumulaCta',
        route: `/pelada/${peladas[0].objectId}`,
      };
    }

    if (scout) {
      return {
        id: 'scout',
        titleKey: 'coach.scoutTitle',
        bodyKey: 'coach.scoutBody',
        ctaKey: 'coach.scoutCta',
        route: `/pelada/${peladas[0].objectId}`,
      };
    }

    return {
      id: 'event-mural',
      titleKey: 'coach.nextEventTitle',
      bodyKey: 'coach.nextEventBody',
      ctaKey: 'coach.nextEventCta',
      route: `/pelada/${peladas[0].objectId}`,
    };
  }
}
