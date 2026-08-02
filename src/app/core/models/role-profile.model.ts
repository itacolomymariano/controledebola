import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProfileRole } from './profile-role.model';

export type ProfessionalRole = Exclude<ProfileRole, 'athlete' | 'fan'>;

export type RoleProfileFieldType = 'money' | 'boolean' | 'pix' | 'text' | 'textarea';

export interface RoleProfileFieldDef {
  key: keyof CreateRoleProfilePayload;
  label: string;
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
    { key: 'peladaRate', label: 'Por quanto apita uma pelada?', type: 'money', required: true },
    { key: 'matchRate', label: 'Por quanto apita uma partida?', type: 'money', required: true },
    {
      key: 'hasUniform',
      label: 'Possui uniforme de arbitro?',
      type: 'boolean',
    },
    {
      key: 'hasFlags',
      label: 'Possui bandeiras de linha?',
      type: 'boolean',
    },
    {
      key: 'hasOwnEquipment',
      label: 'Possui demais equipamentos (cartoes, apito, etc)?',
      type: 'boolean',
    },
    {
      key: 'isFederatedReferee',
      label: 'E Juiz/Arbitro federado?',
      type: 'boolean',
    },
    { key: 'federationName', label: 'Qual a Federacao', type: 'text' },
    { key: 'federationRegistrationNumber', label: 'Numero de registro na federacao', type: 'text' },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  scout: [
    { key: 'peladaRate', label: 'Por quanto faz o scout de uma pelada?', type: 'money', required: true },
    { key: 'matchRate', label: 'Por quanto faz o scout de uma partida?', type: 'money', required: true },
    { key: 'athleteRate', label: 'Por quanto faz o scout de um atleta?', type: 'money', required: true },
    {
      key: 'hasMarkingAssistants',
      label: 'Tem auxiliares para marcacao?',
      type: 'boolean',
    },
    {
      key: 'equipmentDescription',
      label: 'Quais equipamentos utiliza?',
      type: 'textarea',
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  journalist: [
    { key: 'peladaRate', label: 'Por quanto cobre uma pelada?', type: 'money', required: true },
    { key: 'matchRate', label: 'Por quanto cobre uma partida?', type: 'money', required: true },
    {
      key: 'equipmentDescription',
      label: 'Quais equipamentos utiliza?',
      type: 'textarea',
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  cameraman: [
    {
      key: 'peladaLiveRate',
      label: 'Por quanto filma uma pelada (transmissao ao vivo)?',
      type: 'money',
      required: true,
    },
    {
      key: 'matchLiveRate',
      label: 'Por quanto filma uma partida (transmissao ao vivo)?',
      type: 'money',
      required: true,
    },
    {
      key: 'peladaHighlightEditRate',
      label: 'Por quanto edita melhores momentos (ate 5 min) de uma pelada?',
      type: 'money',
      required: true,
    },
    {
      key: 'matchHighlightEditRate',
      label: 'Por quanto edita melhores momentos (ate 5 min) de uma partida?',
      type: 'money',
      required: true,
    },
    {
      key: 'equipmentDescription',
      label: 'Quais equipamentos utiliza?',
      type: 'textarea',
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  narrator: [
    {
      key: 'peladaLiveRate',
      label: 'Por quanto narra uma pelada (transmissao ao vivo)?',
      type: 'money',
      required: true,
    },
    {
      key: 'matchLiveRate',
      label: 'Por quanto narra uma partida (transmissao ao vivo)?',
      type: 'money',
      required: true,
    },
    {
      key: 'peladaGoalNarrationEditRate',
      label: 'Por quanto edita narracao dos gols de uma pelada?',
      type: 'money',
      required: true,
    },
    {
      key: 'matchGoalNarrationEditRate',
      label: 'Por quanto edita narracao dos gols de uma partida?',
      type: 'money',
      required: true,
    },
    {
      key: 'equipmentDescription',
      label: 'Quais equipamentos utiliza?',
      type: 'textarea',
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  coach: [
    {
      key: 'teamTrainingRate',
      label: 'Por quanto treina uma equipe amadora?',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  physical_trainer: [
    {
      key: 'teamTrainingRate',
      label: 'Por quanto atua numa equipe amadora?',
      type: 'money',
      required: true,
    },
    {
      key: 'athleteRate',
      label: 'Por quanto atua como Personal Trainer?',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  masseur: [
    { key: 'peladaRate', label: 'Por quanto atua numa pelada?', type: 'money', required: true },
    { key: 'teamRate', label: 'Por quanto atua numa equipe amadora?', type: 'money', required: true },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  kitman: [
    { key: 'peladaRate', label: 'Por quanto atua numa pelada?', type: 'money', required: true },
    { key: 'teamRate', label: 'Por quanto atua numa equipe amadora?', type: 'money', required: true },
    { key: 'pixKey1', label: 'Chave Pix 1 para recebimento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para recebimento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para recebimento', type: 'pix' },
  ],
  gandula: [
    { key: 'peladaRate', label: 'Por quanto trabalha numa pelada?', type: 'money', required: true },
    {
      key: 'matchRate',
      label: 'Por quanto trabalha numa partida entre equipes amadoras?',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para pagamento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para pagamento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para pagamento', type: 'pix' },
  ],
  gatekeeper: [
    { key: 'peladaRate', label: 'Por quanto atua numa pelada?', type: 'money', required: true },
    {
      key: 'matchRate',
      label: 'Por quanto atua numa partida entre equipes amadoras?',
      type: 'money',
      required: true,
    },
    { key: 'pixKey1', label: 'Chave Pix 1 para pagamento', type: 'pix' },
    { key: 'pixKey2', label: 'Chave Pix 2 para pagamento', type: 'pix' },
    { key: 'pixKey3', label: 'Chave Pix 3 para pagamento', type: 'pix' },
  ],
};


export function isProfessionalRole(role: ProfileRole): role is ProfessionalRole {
  return PROFESSIONAL_ROLES.includes(role as ProfessionalRole);
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

export function roleProfileFieldLabels(role: ProfessionalRole): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const field of ROLE_PROFILE_FIELDS[role]) {
    labels[field.key] = field.label;
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
