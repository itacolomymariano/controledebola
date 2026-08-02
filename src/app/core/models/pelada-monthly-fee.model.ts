export interface PeladaMembershipFee {
  objectId: string;
  membershipId: string;
  peladaId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  referenceMonth: Date;
  amount: number;
  dueDate: Date;
  paymentConfirmed: boolean;
  confirmedAt?: Date;
  confirmedById?: string;
  cashEntryId?: string;
}

export interface MonthlyFeeGridRow {
  membershipId: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  fees: PeladaMembershipFee[];
}
