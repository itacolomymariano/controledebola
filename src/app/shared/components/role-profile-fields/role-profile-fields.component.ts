import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  ProfessionalRole,
  ROLE_PROFILE_FIELDS,
  RoleProfileFieldDef,
} from '../../../core/models/role-profile.model';

export type RoleProfileFieldsSection = 'all' | 'rates' | 'pix' | 'gear';

@Component({
  selector: 'app-role-profile-fields',
  templateUrl: './role-profile-fields.component.html',
  styleUrls: ['./role-profile-fields.component.scss'],
  standalone: false,
})
export class RoleProfileFieldsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) role!: ProfessionalRole;
  @Input() section: RoleProfileFieldsSection = 'all';

  get fields(): RoleProfileFieldDef[] {
    return ROLE_PROFILE_FIELDS[this.role].filter((field) => this.matchesSection(field));
  }

  showField(field: RoleProfileFieldDef): boolean {
    if (field.key === 'federationName' || field.key === 'federationRegistrationNumber') {
      return !!this.form.get('isFederatedReferee')?.value;
    }
    return true;
  }

  private matchesSection(field: RoleProfileFieldDef): boolean {
    if (this.section === 'all') return true;
    if (this.section === 'rates') return field.type === 'money';
    if (this.section === 'pix') return field.type === 'pix';
    if (field.type === 'money' || field.type === 'pix') return false;
    return true;
  }

  pixFieldValue(key: string): string {
    return String(this.form.get(key)?.value ?? '');
  }
}
