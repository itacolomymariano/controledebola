import { hasPositiveParticipationFee } from '../models/event.model';

export interface ContractHireFlags {
  invitedByContract?: boolean;
  invitedAsReferee?: boolean;
  isAnonymous?: boolean;
  paymentExempt?: boolean;
}

/** Convidado/contratado pelo evento — nao paga taxa de participacao. */
export function isContractHiredRegistration(registration: ContractHireFlags): boolean {
  return !!registration.invitedByContract || !!registration.invitedAsReferee;
}

/** Exibe cobranca PIX / toggles de pagamento de participacao. */
export function registrationRequiresParticipationPayment(
  registration: ContractHireFlags,
  participationFee: number
): boolean {
  if (!hasPositiveParticipationFee(participationFee)) return false;
  if (registration.paymentExempt) return false;
  if (registration.isAnonymous) return false;
  if (isContractHiredRegistration(registration)) return false;
  return true;
}
