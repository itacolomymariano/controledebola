/**
 * One-off keys for i18n onda 7 (serviceError em core/services).
 * Run: node scripts/i18n-wave7-services-extra.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../src/assets/i18n');

const packs = {
  'pt-BR': {
    'error.service.loginRequired': 'Faça login para continuar.',
    'error.service.loginToCreateProfile': 'Faça login para criar o perfil.',
    'error.service.loginToUpdateProfile': 'Faça login para atualizar o perfil.',
    'error.service.profileNotFound': 'Perfil não encontrado.',
    'error.refereeInvitation.loginToSend': 'Faça login para enviar convites.',
    'error.refereeInvitation.hiringAmountInvalid': 'Informe um valor de contratação válido.',
    'error.refereeInvitation.responseDeadlineRequired':
      'Informe data e hora limite para a resposta do convite.',
    'error.refereeInvitation.createdWithoutId': 'Convite criado sem identificador.',
    'error.refereeInvitation.eventNotFound': 'Evento não encontrado.',
    'error.refereeInvitation.teamMatchRefereeApproval':
      'Em confrontos, a contratação de árbitro exige aprovação do presidente adversário. Use o fluxo de arbitragem do confronto.',
    'error.refereeInvitation.adminOnlyHiringInvites':
      'Apenas o administrador do evento pode enviar convites de contratação.',
    'error.refereeInvitation.eventWithoutPelada': 'Evento sem pelada vinculada.',
    'error.refereeInvitation.roleActiveInvite':
      'Este {{role}} já possui convite ativo para este evento.',
    'error.refereeInvitation.userAlreadyRegistered': 'Este usuário já está inscrito neste evento.',
    'error.refereeInvitation.loginToAccept': 'Faça login para aceitar convites.',
    'error.refereeInvitation.inviteNotYours': 'Este convite não pertence a você.',
    'error.refereeInvitation.inviteAlreadyAnswered': 'Este convite já foi respondido.',
    'error.refereeInvitation.refereeAwaitingOpponentApproval':
      'Este convite de árbitro ainda aguarda aprovação do presidente adversário.',
    'error.refereeInvitation.inviteDeadlineExpired':
      'O prazo para responder a este convite expirou.',
    'error.refereeInvitation.acceptedOtherTeamInMatch':
      'Você já aceitou convocação do outro time neste confronto. Cancele a inscrição antes de aceitar este convite.',
    'error.refereeInvitation.scheduleConflictPrefix': 'Conflito de agenda',
    'error.refereeInvitation.scheduleConflict':
      'Conflito de agenda com "{{eventName}}". Cancele o outro compromisso antes de aceitar este convite.',
    'error.refereeInvitation.otherEvent': 'outro evento',
    'error.refereeInvitation.presenceAfterAccept':
      'Presença só pode ser confirmada após o {{role}} aceitar o convite.',
    'error.refereeInvitation.arrivalDateTimeForRole':
      'Informe data e hora da chegada do {{role}}.',
    'error.refereeInvitation.paymentAfterAccept':
      'Pagamento só pode ser confirmado após aceitar o convite.',
    'error.refereeInvitation.presenceBeforePayment':
      'Confirme a presença ou registre falta justificada antes do pagamento.',
    'error.refereeInvitation.arrivalBeforePayment':
      'Informe a data e hora de chegada antes de confirmar o pagamento.',
    'error.refereeInvitation.paymentAlreadyInCashbox':
      'Pagamento já registrado no caixa. Não é possível desmarcar.',
    'error.refereeInvitation.excusedFaultAfterAccept':
      'Falta justificada só pode ser registrada após aceitar o convite.',
    'error.refereeInvitation.remotePresenceAfterAccept':
      'Presença remota só pode ser confirmada após aceitar o convite.',
    'error.refereeInvitation.notRemoteInvite': 'Este convite não é de assistência remota.',
    'error.refereeInvitation.remotePresenceAdminsOnly':
      'Apenas administrador, cinegrafista ou narrador do evento podem confirmar assistência remota.',
    'error.refereeInvitation.adminPaymentNotConfirmed':
      'O administrador ainda não confirmou o pagamento.',
    'error.refereeInvitation.paymentAlreadyConfirmed': 'Pagamento já foi confirmado.',
    'error.refereeInvitation.adminOnlyAction':
      'Apenas o administrador do evento pode executar esta ação.',
  },
  'en-GB': {
    'error.service.loginRequired': 'Please log in to continue.',
    'error.service.loginToCreateProfile': 'Please log in to create the profile.',
    'error.service.loginToUpdateProfile': 'Please log in to update the profile.',
    'error.service.profileNotFound': 'Profile not found.',
    'error.refereeInvitation.loginToSend': 'Please log in to send invitations.',
    'error.refereeInvitation.hiringAmountInvalid': 'Enter a valid hiring fee.',
    'error.refereeInvitation.responseDeadlineRequired':
      'Enter the date and time deadline for responding to the invitation.',
    'error.refereeInvitation.createdWithoutId': 'Invitation was created without an identifier.',
    'error.refereeInvitation.eventNotFound': 'Event not found.',
    'error.refereeInvitation.teamMatchRefereeApproval':
      'In team matches, hiring a referee requires the opponent president’s approval. Use the match arbitration flow.',
    'error.refereeInvitation.adminOnlyHiringInvites':
      'Only the event administrator can send hiring invitations.',
    'error.refereeInvitation.eventWithoutPelada': 'Event has no linked pickup group.',
    'error.refereeInvitation.roleActiveInvite':
      'This {{role}} already has an active invitation for this event.',
    'error.refereeInvitation.userAlreadyRegistered': 'This user is already registered for this event.',
    'error.refereeInvitation.loginToAccept': 'Please log in to accept invitations.',
    'error.refereeInvitation.inviteNotYours': 'This invitation is not yours.',
    'error.refereeInvitation.inviteAlreadyAnswered': 'This invitation has already been answered.',
    'error.refereeInvitation.refereeAwaitingOpponentApproval':
      'This referee invitation is still waiting for the opponent president’s approval.',
    'error.refereeInvitation.inviteDeadlineExpired': 'The deadline to respond to this invitation has passed.',
    'error.refereeInvitation.acceptedOtherTeamInMatch':
      'You already accepted a call-up for the other team in this match. Cancel that registration before accepting this invitation.',
    'error.refereeInvitation.scheduleConflictPrefix': 'Schedule conflict',
    'error.refereeInvitation.scheduleConflict':
      'Schedule conflict with "{{eventName}}". Cancel the other commitment before accepting this invitation.',
    'error.refereeInvitation.otherEvent': 'another event',
    'error.refereeInvitation.presenceAfterAccept':
      'Attendance can only be confirmed after the {{role}} accepts the invitation.',
    'error.refereeInvitation.arrivalDateTimeForRole':
      'Enter the arrival date and time for the {{role}}.',
    'error.refereeInvitation.paymentAfterAccept':
      'Payment can only be confirmed after accepting the invitation.',
    'error.refereeInvitation.presenceBeforePayment':
      'Confirm attendance or record an excused absence before payment.',
    'error.refereeInvitation.arrivalBeforePayment':
      'Enter the arrival date and time before confirming payment.',
    'error.refereeInvitation.paymentAlreadyInCashbox':
      'Payment is already recorded in the cashbox. It cannot be unchecked.',
    'error.refereeInvitation.excusedFaultAfterAccept':
      'Excused absence can only be recorded after accepting the invitation.',
    'error.refereeInvitation.remotePresenceAfterAccept':
      'Remote attendance can only be confirmed after accepting the invitation.',
    'error.refereeInvitation.notRemoteInvite': 'This invitation is not for remote attendance.',
    'error.refereeInvitation.remotePresenceAdminsOnly':
      'Only the administrator, videographer or narrator of the event can confirm remote attendance.',
    'error.refereeInvitation.adminPaymentNotConfirmed':
      'The administrator has not confirmed payment yet.',
    'error.refereeInvitation.paymentAlreadyConfirmed': 'Payment has already been confirmed.',
    'error.refereeInvitation.adminOnlyAction':
      'Only the event administrator can perform this action.',
  },
  'es-ES': {
    'error.service.loginRequired': 'Inicia sesión para continuar.',
    'error.service.loginToCreateProfile': 'Inicia sesión para crear el perfil.',
    'error.service.loginToUpdateProfile': 'Inicia sesión para actualizar el perfil.',
    'error.service.profileNotFound': 'Perfil no encontrado.',
    'error.refereeInvitation.loginToSend': 'Inicia sesión para enviar invitaciones.',
    'error.refereeInvitation.hiringAmountInvalid': 'Indica un valor de contratación válido.',
    'error.refereeInvitation.responseDeadlineRequired':
      'Indica fecha y hora límite para responder a la invitación.',
    'error.refereeInvitation.createdWithoutId': 'Invitación creada sin identificador.',
    'error.refereeInvitation.eventNotFound': 'Evento no encontrado.',
    'error.refereeInvitation.teamMatchRefereeApproval':
      'En enfrentamientos, contratar árbitro exige aprobación del presidente rival. Usa el flujo de arbitraje del enfrentamiento.',
    'error.refereeInvitation.adminOnlyHiringInvites':
      'Solo el administrador del evento puede enviar invitaciones de contratación.',
    'error.refereeInvitation.eventWithoutPelada': 'Evento sin pelada vinculada.',
    'error.refereeInvitation.roleActiveInvite':
      'Este {{role}} ya tiene una invitación activa para este evento.',
    'error.refereeInvitation.userAlreadyRegistered': 'Este usuario ya está inscrito en este evento.',
    'error.refereeInvitation.loginToAccept': 'Inicia sesión para aceptar invitaciones.',
    'error.refereeInvitation.inviteNotYours': 'Esta invitación no es tuya.',
    'error.refereeInvitation.inviteAlreadyAnswered': 'Esta invitación ya fue respondida.',
    'error.refereeInvitation.refereeAwaitingOpponentApproval':
      'Esta invitación de árbitro aún espera la aprobación del presidente rival.',
    'error.refereeInvitation.inviteDeadlineExpired':
      'El plazo para responder a esta invitación ha expirado.',
    'error.refereeInvitation.acceptedOtherTeamInMatch':
      'Ya aceptaste la convocatoria del otro equipo en este enfrentamiento. Cancela la inscripción antes de aceptar esta invitación.',
    'error.refereeInvitation.scheduleConflictPrefix': 'Conflicto de agenda',
    'error.refereeInvitation.scheduleConflict':
      'Conflicto de agenda con "{{eventName}}". Cancela el otro compromiso antes de aceptar esta invitación.',
    'error.refereeInvitation.otherEvent': 'otro evento',
    'error.refereeInvitation.presenceAfterAccept':
      'La presencia solo puede confirmarse después de que el {{role}} acepte la invitación.',
    'error.refereeInvitation.arrivalDateTimeForRole':
      'Indica fecha y hora de llegada del {{role}}.',
    'error.refereeInvitation.paymentAfterAccept':
      'El pago solo puede confirmarse después de aceptar la invitación.',
    'error.refereeInvitation.presenceBeforePayment':
      'Confirma la presencia o registra falta justificada antes del pago.',
    'error.refereeInvitation.arrivalBeforePayment':
      'Indica fecha y hora de llegada antes de confirmar el pago.',
    'error.refereeInvitation.paymentAlreadyInCashbox':
      'Pago ya registrado en la caja. No se puede desmarcar.',
    'error.refereeInvitation.excusedFaultAfterAccept':
      'La falta justificada solo puede registrarse después de aceptar la invitación.',
    'error.refereeInvitation.remotePresenceAfterAccept':
      'La presencia remota solo puede confirmarse después de aceptar la invitación.',
    'error.refereeInvitation.notRemoteInvite': 'Esta invitación no es de asistencia remota.',
    'error.refereeInvitation.remotePresenceAdminsOnly':
      'Solo el administrador, cinegrafista o narrador del evento pueden confirmar asistencia remota.',
    'error.refereeInvitation.adminPaymentNotConfirmed':
      'El administrador aún no confirmó el pago.',
    'error.refereeInvitation.paymentAlreadyConfirmed': 'El pago ya fue confirmado.',
    'error.refereeInvitation.adminOnlyAction':
      'Solo el administrador del evento puede ejecutar esta acción.',
  },
};

for (const [locale, extra] of Object.entries(packs)) {
  const file = path.join(root, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  Object.assign(data, extra);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Updated ${locale}: +${Object.keys(extra).length} keys`);
}