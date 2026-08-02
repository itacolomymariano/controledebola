import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import {
  ProfessionalRole,
  ROLE_PROFILE_FIELDS,
  RoleProfileFieldDef,
} from '../../../core/models/role-profile.model';

@Component({
  selector: 'app-role-profile-fields',
  templateUrl: './role-profile-fields.component.html',
  standalone: false,
})
export class RoleProfileFieldsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) role!: ProfessionalRole;

  get fields(): RoleProfileFieldDef[] {
    return ROLE_PROFILE_FIELDS[this.role];
  }

  showField(field: RoleProfileFieldDef): boolean {
    if (field.key === 'federationName' || field.key === 'federationRegistrationNumber') {
      return !!this.form.get('isFederatedReferee')?.value;
    }
    return true;
  }

  pixFieldValue(key: string): string {
    return String(this.form.get(key)?.value ?? '');
  }
}
