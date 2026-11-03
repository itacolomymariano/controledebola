import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  ATHLETE_FOOT_OPTIONS,
  ATHLETE_MARITAL_STATUS_OPTIONS,
  FOOTBALL_POSITIONS,
  HEIGHT_CENTIMETERS,
  HEIGHT_METERS,
  SHOE_SIZES,
  WEIGHTS_KG,
} from '../../../core/models/athlete-profile.model';

export type AthleteProfileFieldsSection = 'all' | 'positions' | 'measures' | 'extras';

@Component({
  selector: 'app-athlete-profile-fields',
  templateUrl: './athlete-profile-fields.component.html',
  standalone: false,
})
export class AthleteProfileFieldsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() section: AthleteProfileFieldsSection = 'all';

  maritalOptions = ATHLETE_MARITAL_STATUS_OPTIONS;
  footOptions = ATHLETE_FOOT_OPTIONS;
  positions = FOOTBALL_POSITIONS;
  shoeSizes = SHOE_SIZES;
  weights = WEIGHTS_KG;
  heightMeters = HEIGHT_METERS;
  heightCentimeters = HEIGHT_CENTIMETERS;

  formatCm(value: number): string {
    return value.toString().padStart(2, '0');
  }

  showSection(part: Exclude<AthleteProfileFieldsSection, 'all'>): boolean {
    return this.section === 'all' || this.section === part;
  }
}
