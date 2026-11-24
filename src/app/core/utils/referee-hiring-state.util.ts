import { PeladaEvent } from '../models/event.model';
import { EventInviteCandidate, RefereeInvitation } from '../models/referee-invitation.model';

export type RefereeHiringPhase =
  | 'none'
  | 'awaiting_opponent_approval'
  | 'awaiting_referee_response'
  | 'confirmed'
  | 'present'
  | 'rejected';

export interface RefereeArbitrationTimelineStep {
  id: 'proposal' | 'opponent' | 'referee';
  done: boolean;
  current: boolean;
}

export interface RefereeArbitrationViewModel {
  phase: RefereeHiringPhase;
  activeInvitation: RefereeInvitation | null;
  acceptedRefereeName: string;
  showConfrontoTimeline: boolean;
  timeline: RefereeArbitrationTimelineStep[];
  hasPendingOpponentApproval: boolean;
}

function invitationDisplayName(invitation: RefereeInvitation): string {
  return invitation.invitedUserApelido?.trim() || invitation.invitedUserName?.trim() || 'Árbitro';
}

function pickActiveInvitation(invitations: RefereeInvitation[]): RefereeInvitation | null {
  if (!invitations.length) return null;

  const accepted = [...invitations].reverse().find((item) => item.status === 'accepted');
  if (accepted) return accepted;

  const pending = [...invitations].reverse().find((item) => item.status === 'pending');
  if (pending) return pending;

  return invitations[invitations.length - 1] ?? null;
}

export function buildRefereeArbitrationViewModel(
  event: PeladaEvent,
  invitations: RefereeInvitation[]
): RefereeArbitrationViewModel {
  const activeInvitation = pickActiveInvitation(invitations);
  const accepted = invitations.find((item) => item.status === 'accepted') ?? null;
  const showConfrontoTimeline = event.type === 'team_match';

  let phase: RefereeHiringPhase = 'none';

  if (accepted) {
    phase = accepted.presenceConfirmed ? 'present' : 'confirmed';
  } else if (activeInvitation?.status === 'pending') {
    const approval = activeInvitation.refereeHiringApprovalStatus;
    if (event.type === 'team_match' && approval === 'pending') {
      phase = 'awaiting_opponent_approval';
    } else if (event.type === 'team_match' && approval === 'rejected') {
      phase = 'rejected';
    } else {
      phase = 'awaiting_referee_response';
    }
  } else if (
    activeInvitation?.status === 'declined' ||
    activeInvitation?.status === 'cancelled' ||
    activeInvitation?.refereeHiringApprovalStatus === 'rejected'
  ) {
    phase = 'rejected';
  }

  const timeline: RefereeArbitrationTimelineStep[] = showConfrontoTimeline
    ? buildConfrontoTimeline(activeInvitation, phase)
    : [];

  return {
    phase,
    activeInvitation,
    acceptedRefereeName: accepted ? invitationDisplayName(accepted) : '',
    showConfrontoTimeline,
    timeline,
    hasPendingOpponentApproval: phase === 'awaiting_opponent_approval',
  };
}

function buildConfrontoTimeline(
  invitation: RefereeInvitation | null,
  phase: RefereeHiringPhase
): RefereeArbitrationTimelineStep[] {
  const hasProposal = !!invitation;
  const approval = invitation?.refereeHiringApprovalStatus;
  const opponentDone = approval === 'approved' || phase === 'confirmed' || phase === 'present';
  const opponentCurrent = phase === 'awaiting_opponent_approval';
  const opponentRejected = approval === 'rejected' || phase === 'rejected';

  const refereeDone = phase === 'confirmed' || phase === 'present';
  const refereeCurrent =
    phase === 'awaiting_referee_response' ||
    (hasProposal && approval === 'approved' && invitation?.status === 'pending');

  return [
    { id: 'proposal', done: hasProposal, current: !hasProposal },
    {
      id: 'opponent',
      done: opponentDone && !opponentRejected,
      current: opponentCurrent || (opponentRejected && hasProposal),
    },
    {
      id: 'referee',
      done: refereeDone,
      current: refereeCurrent,
    },
  ];
}

export function peladaShortcutLabel(candidate: EventInviteCandidate): string {
  return candidate.apelido?.trim() || candidate.userName?.trim() || 'Árbitro';
}