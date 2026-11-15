import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ProfessionalRole,
  ROLE_PROFILE_FIELDS,
  RoleProfileFieldDef,
} from '../../../core/models/role-profile.model';
import { I18nService } from '../../../core/services/i18n.service';

export type RoleProfileFieldsSection = 'all' | 'rates' | 'pix' | 'gear';

@Component({
  selector: 'app-role-profile-fields',
  templateUrl: './role-profile-fields.component.html',
  styleUrls: ['./role-profile-fields.component.scss'],
  standalone: false,
})
export class RoleProfileFieldsComponent implements OnInit, OnDestroy {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) role!: ProfessionalRole;
  @Input() section: RoleProfileFieldsSection = 'all';

  private localeSub?: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localeSub = this.i18n.locale$.subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.localeSub?.unsubscribe();
  }

  fieldLabel(field: RoleProfileFieldDef): string {
    return this.i18n.t(field.labelKey);
  }

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
