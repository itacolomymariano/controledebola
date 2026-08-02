export type PeladaCashEntryType = 'in' | 'out';

export interface PeladaCashEntry {
  objectId: string;
  peladaId: string;
  date: Date;
  type: PeladaCashEntryType;
  amount: number;
  description: string;
  createdById: string;
  createdByName: string;
  cotinhaId?: string;
  refereeInvitationId?: string;
  membershipFeeId?: string;
}

export interface CreateCashEntryPayload {
  date: Date;
  type: PeladaCashEntryType;
  amount: number;
  description: string;
  cotinhaId?: string;
  refereeInvitationId?: string;
  membershipFeeId?: string;
}

export interface CashFlowSummary {
  initialBalance: number;
  totalIn: number;
  totalOut: number;
  finalBalance: number;
  entries: PeladaCashEntry[];
}
