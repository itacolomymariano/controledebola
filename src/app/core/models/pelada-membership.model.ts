export type PeladaMembershipStatus = 'active' | 'pending' | 'inactive';
export type PeladaMembershipRole = 'socio' | 'admin';

export const PELADA_MEMBERSHIP_STATUS_LABELS: Record<PeladaMembershipStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  inactive: 'Inativo',
};

export interface PeladaMembership {
  objectId: string;
  peladaId: string;
  userId: string;
  userName: string;
  userApelido?: string;
  userFullName?: string;
  userNickname?: string;
  avatarUrl?: string;
  status: PeladaMembershipStatus;
  role: PeladaMembershipRole;
  joinedAt: Date;
}

export const PELADA_MEMBERSHIP_ROLE_LABELS: Record<PeladaMembershipRole, string> = {
  socio: 'Socio',
  admin: 'Administrador',
};
