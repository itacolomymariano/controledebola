export type PeladaCotinhaStatus = 'open' | 'closed';

export interface PeladaCotinha {
  objectId: string;
  peladaId: string;
  title: string;
  description: string;
  targetAmount: number;
  status: PeladaCotinhaStatus;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  confirmedTotal: number;
}

export interface PeladaCotinhaPayment {
  objectId: string;
  cotinhaId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  amount: number;
  paidAt: Date;
  confirmedByAdmin: boolean;
  confirmedAt?: Date;
  cashEntryId?: string;
}

export interface CreateCotinhaPayload {
  title: string;
  description?: string;
  targetAmount: number;
}

export interface CreateCotinhaPaymentPayload {
  cotinhaId: string;
  userId?: string;
  amount: number;
  paidAt?: Date;
  display?: {
    apelido?: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface UpdateCotinhaPaymentPayload {
  userId?: string;
  amount?: number;
  paidAt?: Date;
}
