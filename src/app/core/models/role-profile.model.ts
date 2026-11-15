import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileRole } from './profile-role.model';

export type ProfessionalRole = Exclude<ProfileRole, 'athlete' | 'fan'>;

export type RoleProfileFieldType = 'money' | 'boolean' | 'pix' | 'text' | 'textarea';

export interface RoleProfileFieldDef {
  key: keyof CreateRoleProfilePayload;
  labelKey: string;
  type: RoleProfileFieldType;
  required?: boolean;
}

export interface RoleProfile {
  objectId: string;
  role: ProfessionalRole;
  peladaRate?: number;
  matchRate?: number;
  athleteRate?: number;
  peladaLiveRate?: number;
  matchLiveRate?: number;
  peladaHighlightEditRate?: number;
  matchHighlightEditRate?: number;
  peladaGoalNarrationEditRate?: number;
  matchGoalNarrationEditRate?: number;
  teamTrainingRate?: number;
  teamRate?: number;
  hasOwnEquipment?: boolean;
  hasUniform?: boolean;
  hasFlags?: boolean;
  flagAssistantUserIds?: string[];
  hasMarkingAssistants?: boolean;
  markingAssistantUserIds?: string[];
  isFederatedReferee?: boolean;
  federationName?: string;
  federationRegistrationNumber?: string;
  equipmentDescription?: string;
  pixKey1?: string;
  pixKey2?: string;
  pixKey3?: string;
}

export type CreateRoleProfilePayload = Omit<RoleProfile, 'objectId'>;

export type UpdateRoleProfilePayload = Partial<Omit<CreateRoleProfilePayload, 'role'>>;

export const PROFESSIONAL_ROLES: ProfessionalRole[] = [
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'gatekeeper',
];

export type RoleHistoryMode = 'pelada_match' | 'teams_only' | 'pelada_teams' | 'none';

export const ROLE_HISTORY_MODE: Record<ProfessionalRole, RoleHistoryMode> = {
  referee: 'pelada_match',
  scout: 'pelada_match',
  journalist: 'pelada_match',
  cameraman: 'pelada_match',
  narrator: 'pelada_match',
  coach: 'teams_only',
  physical_trainer: 'teams_only',
  masseur: 'pelada_teams',
  kitman: 'pelada_teams',
  gandula: 'pelada_match',
  gatekeeper: 'pelada_match',
};

export const ROLE_PROFILE_FIELDS: Record<ProfessionalRole, RoleProfileFieldDef[]> = {
  referee: [
    { key: 'peladaRate', labelKey: 'roleProfileField.referee.peladaRate', type: 'money', required: true },
    { key: 'matchRate', labelKey: 'roleProfileField.referee.matchRate', type: 'money', required: true },
    {
      key: 'hasUniform',
      labelKey: 'roleProfileField.referee.hasUniform',
      type: 'boolean',
    },
    {
      key: 'hasFlags',
      labelKey: 'roleProfileField.referee.hasFlags',
      type: 'boolean',
    },
    {
      key: 'hasOwnEquipment',
      labelKey: 'roleProfileField.referee.hasOwnEquipment',
      type: 'boolean',
    },
    {
      key: 'isFederatedReferee',
      labelKey: 'roleProfileField.referee.isFederatedReferee',
      type: 'boolean',
    },
    { key: 'federationName', labelKey: 'roleProfileField.referee.federationName', type: 'text' },
    { key: 'federationRegistrationNumber', labelKey: 'roleProfileField.referee.federationRegistrationNumber', type: 'text' },
    { key: 'pixKey1', labelKey: 'roleProfileField.referee.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.referee.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.referee.pixKey3', type: 'pix' },
  ],
  scout: [
    { key: 'peladaRate', labelKey: 'roleProfileField.scout.peladaRate', type: 'money', required: true },
    { key: 'matchRate', labelKey: 'roleProfileField.scout.matchRate', type: 'money', required: true },
    { key: 'athleteRate', labelKey: 'roleProfileField.scout.athleteRate', type: 'money', required: true },
    {
      key: 'hasMarkingAssistants',
      labelKey: 'roleProfileField.scout.hasMarkingAssistants',
      type: 'boolean',
    },
    {
      key: 'equipmentDescription',
      labelKey: 'roleProfileField.scout.equipmentDescription',
      type: 'textarea',
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.scout.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.scout.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.scout.pixKey3', type: 'pix' },
  ],
  journalist: [
    { key: 'peladaRate', labelKey: 'roleProfileField.journalist.peladaRate', type: 'money', required: true },
    { key: 'matchRate', labelKey: 'roleProfileField.journalist.matchRate', type: 'money', required: true },
    {
      key: 'equipmentDescription',
      labelKey: 'roleProfileField.journalist.equipmentDescription',
      type: 'textarea',
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.journalist.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.journalist.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.journalist.pixKey3', type: 'pix' },
  ],
  cameraman: [
    {
      key: 'peladaLiveRate',
      labelKey: 'roleProfileField.cameraman.peladaLiveRate',
      type: 'money',
      required: true,
    },
    {
      key: 'matchLiveRate',
      labelKey: 'roleProfileField.cameraman.matchLiveRate',
      type: 'money',
      required: true,
    },
    {
      key: 'peladaHighlightEditRate',
      labelKey: 'roleProfileField.cameraman.peladaHighlightEditRate',
      type: 'money',
      required: true,
    },
    {
      key: 'matchHighlightEditRate',
      labelKey: 'roleProfileField.cameraman.matchHighlightEditRate',
      type: 'money',
      required: true,
    },
    {
      key: 'equipmentDescription',
      labelKey: 'roleProfileField.cameraman.equipmentDescription',
      type: 'textarea',
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.cameraman.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.cameraman.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.cameraman.pixKey3', type: 'pix' },
  ],
  narrator: [
    {
      key: 'peladaLiveRate',
      labelKey: 'roleProfileField.narrator.peladaLiveRate',
      type: 'money',
      required: true,
    },
    {
      key: 'matchLiveRate',
      labelKey: 'roleProfileField.narrator.matchLiveRate',
      type: 'money',
      required: true,
    },
    {
      key: 'peladaGoalNarrationEditRate',
      labelKey: 'roleProfileField.narrator.peladaGoalNarrationEditRate',
      type: 'money',
      required: true,
    },
    {
      key: 'matchGoalNarrationEditRate',
      labelKey: 'roleProfileField.narrator.matchGoalNarrationEditRate',
      type: 'money',
      required: true,
    },
    {
      key: 'equipmentDescription',
      labelKey: 'roleProfileField.narrator.equipmentDescription',
      type: 'textarea',
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.narrator.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.narrator.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.narrator.pixKey3', type: 'pix' },
  ],
  coach: [
    {
      key: 'teamTrainingRate',
      labelKey: 'roleProfileField.coach.teamTrainingRate',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.coach.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.coach.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.coach.pixKey3', type: 'pix' },
  ],
  physical_trainer: [
    {
      key: 'teamTrainingRate',
      labelKey: 'roleProfileField.physical_trainer.teamTrainingRate',
      type: 'money',
      required: true,
    },
    {
      key: 'athleteRate',
      labelKey: 'roleProfileField.physical_trainer.athleteRate',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.physical_trainer.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.physical_trainer.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.physical_trainer.pixKey3', type: 'pix' },
  ],
  masseur: [
    { key: 'peladaRate', labelKey: 'roleProfileField.masseur.peladaRate', type: 'money', required: true },
    { key: 'teamRate', labelKey: 'roleProfileField.masseur.teamRate', type: 'money', required: true },
    { key: 'pixKey1', labelKey: 'roleProfileField.masseur.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.masseur.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.masseur.pixKey3', type: 'pix' },
  ],
  kitman: [
    { key: 'peladaRate', labelKey: 'roleProfileField.kitman.peladaRate', type: 'money', required: true },
    { key: 'teamRate', labelKey: 'roleProfileField.kitman.teamRate', type: 'money', required: true },
    { key: 'pixKey1', labelKey: 'roleProfileField.kitman.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.kitman.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.kitman.pixKey3', type: 'pix' },
  ],
  gandula: [
    { key: 'peladaRate', labelKey: 'roleProfileField.gandula.peladaRate', type: 'money', required: true },
    {
      key: 'matchRate',
      labelKey: 'roleProfileField.gandula.matchRate',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.gandula.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.gandula.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.gandula.pixKey3', type: 'pix' },
  ],
  gatekeeper: [
    { key: 'peladaRate', labelKey: 'roleProfileField.gatekeeper.peladaRate', type: 'money', required: true },
    {
      key: 'matchRate',
      labelKey: 'roleProfileField.gatekeeper.matchRate',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', labelKey: 'roleProfileField.gatekeeper.pixKey1', type: 'pix' },
    { key: 'pixKey2', labelKey: 'roleProfileField.gatekeeper.pixKey2', type: 'pix' },
    { key: 'pixKey3', labelKey: 'roleProfileField.gatekeeper.pixKey3', type: 'pix' },
  ],
};


export function isProfessionalRole(role: ProfileRole): role is ProfessionalRole {
  return PROFESSIONAL_ROLES.includes(role as ProfessionalRole);
}

export type RoleProfileWizardStepId = 'intro' | 'rates' | 'gear' | 'pix' | 'history';

export function roleProfileHasGearSection(role: ProfessionalRole): boolean {
  return ROLE_PROFILE_FIELDS[role].some(
    (field) =>
      field.type === 'boolean' ||
      field.type === 'textarea' ||
      (field.type === 'text' && field.key !== 'pixKey1')
  );
}

export function roleProfileWizardSteps(
  role: ProfessionalRole,
  includeHistory: boolean
): RoleProfileWizardStepId[] {
  const steps: RoleProfileWizardStepId[] = ['intro', 'rates'];
  if (roleProfileHasGearSection(role)) {
    steps.push('gear');
  }
  steps.push('pix');
  if (includeHistory) {
    steps.push('history');
  }
  return steps;
}

export function buildRoleProfileForm(fb: FormBuilder, role: ProfessionalRole): FormGroup {
  const controls: Record<string, unknown> = {};

  for (const field of ROLE_PROFILE_FIELDS[role]) {
    if (field.type === 'boolean') {
      controls[field.key] = [false];
      continue;
    }
    if (field.type === 'money') {
      controls[field.key] = [
        null as number | null,
        field.required ? [Validators.required, Validators.min(0)] : [Validators.min(0)],
      ];
      continue;
    }
    controls[field.key] = [''];
  }

  return fb.group(controls);
}

export function roleProfileFieldLabels(role: ProfessionalRole, t: (key: string) => string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const field of ROLE_PROFILE_FIELDS[role]) {
    labels[field.key] = t(field.labelKey);
  }
  return labels;
}

export function payloadFromRoleProfileForm(
  role: ProfessionalRole,
  raw: Record<string, unknown>
): CreateRoleProfilePayload {
  const payload: CreateRoleProfilePayload = { role };

  for (const field of ROLE_PROFILE_FIELDS[role]) {
    const value = raw[field.key];
    if (field.type === 'boolean') {
      payload[field.key] = !!value as never;
      continue;
    }
    if (field.type === 'money') {
      const num = value === null || value === '' ? undefined : Number(value);
      if (num !== undefined && !Number.isNaN(num)) {
        payload[field.key] = num as never;
      }
      continue;
    }
    const text = (value as string)?.trim();
    if (text) payload[field.key] = text as never;
  }

  if (role === 'referee' && !payload.isFederatedReferee) {
    delete payload.federationName;
    delete payload.federationRegistrationNumber;
  }

  return payload;
}

export function patchRoleProfileForm(form: FormGroup, profile: RoleProfile): void {
  const patch: Record<string, unknown> = {};
  for (const field of ROLE_PROFILE_FIELDS[profile.role]) {
    patch[field.key] =
      profile[field.key] ?? (field.type === 'boolean' ? false : field.type === 'money' ? null : '');
  }

  form.patchValue(patch);
}
