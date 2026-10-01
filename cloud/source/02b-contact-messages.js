const CONTACT_FEEDBACK_TO = 'contato@controledebola.com.br';
const CONTACT_SUPPORT_TO = 'suporte@controledebola.com.br';
const CONTACT_TITLE_MAX = 120;
const CONTACT_BODY_MAX = 4000;
const CONTACT_MIN_INTERVAL_MS = 60 * 1000;
const CONTACT_MAX_PER_HOUR = 5;

function assertContactRateLimit(user) {
  const now = Date.now();
  const lastAt = user.get('contactMessageRequestedAt');
  const lastMs = lastAt instanceof Date ? lastAt.getTime() : 0;
  if (lastMs && now - lastMs < CONTACT_MIN_INTERVAL_MS) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Aguarde um minuto antes de enviar outra mensagem.'
    );
  }

  const hourStarted = user.get('contactMessageHourStartedAt');
  const hourStartMs = hourStarted instanceof Date ? hourStarted.getTime() : 0;
  const hourCount = Number(user.get('contactMessageHourCount') || 0);
  if (hourStartMs && now - hourStartMs < 60 * 60 * 1000 && hourCount >= CONTACT_MAX_PER_HOUR) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Limite de mensagens atingido. Tente novamente em uma hora.'
    );
  }
}

function markContactMessageRequest(user) {
  const now = new Date();
  const hourStarted = user.get('contactMessageHourStartedAt');
  const hourStartMs = hourStarted instanceof Date ? hourStarted.getTime() : 0;
  if (!hourStartMs || now.getTime() - hourStartMs >= 60 * 60 * 1000) {
    user.set('contactMessageHourStartedAt', now);
    user.set('contactMessageHourCount', 1);
  } else {
    user.set('contactMessageHourCount', Number(user.get('contactMessageHourCount') || 0) + 1);
  }
  user.set('contactMessageRequestedAt', now);
}

Parse.Cloud.define('sendContactMessage', async (request) => {
  const sessionUser = request.user;
  if (!sessionUser) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login para enviar a mensagem.');
  }

  const kind = String(request.params.kind || '').trim();
  if (kind !== 'feedback' && kind !== 'support') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Tipo de mensagem invalido.');
  }

  const title = String(request.params.title || '').trim();
  const body = String(request.params.body || '').trim();
  if (title.length < 3 || title.length > CONTACT_TITLE_MAX) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Informe um titulo (3 a ${CONTACT_TITLE_MAX} caracteres).`
    );
  }
  if (body.length < 10 || body.length > CONTACT_BODY_MAX) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Descreva a mensagem (10 a ${CONTACT_BODY_MAX} caracteres).`
    );
  }

  const attachmentUrl = String(request.params.attachmentUrl || '').trim();
  const attachmentName = String(request.params.attachmentName || '').trim();

  const user = await new Parse.Query(Parse.User).get(sessionUser.id, { useMasterKey: true });
  assertContactRateLimit(user);

  const fullName = String(user.get('name') || '').trim() || 'Nao informado';
  const apelido = String(user.get('apelido') || '').trim() || 'Nao informado';
  const email = String(user.get('email') || user.getUsername() || '').trim();
  const to = kind === 'support' ? CONTACT_SUPPORT_TO : CONTACT_FEEDBACK_TO;
  const kindLabel = kind === 'support' ? 'Problema no app' : 'Critica / sugestao / elogio';
  const subject = `[Controle de Bola] ${kindLabel}: ${title}`.slice(0, 180);

  const text = [
    `Tipo: ${kindLabel}`,
    `Nome: ${fullName}`,
    `Apelido: ${apelido}`,
    `Conta: ${email || user.id}`,
    `UserId: ${user.id}`,
    '',
    title,
    '',
    body,
  ].join('\n');

  const html = `
    <p><strong>Tipo:</strong> ${kindLabel}</p>
    <p><strong>Nome:</strong> ${fullName}<br/>
    <strong>Apelido:</strong> ${apelido}<br/>
    <strong>Conta:</strong> ${email || user.id}</p>
    <h3>${title.replace(/</g, '')}</h3>
    <p>${body.replace(/</g, '').replace(/\n/g, '<br/>')}</p>
  `;

  await sendAppMail({
    to,
    subject,
    text,
    html,
    replyTo: isEmailValue(email) ? email : undefined,
    attachmentUrl: attachmentUrl || undefined,
    attachmentName: attachmentName || undefined,
  });

  markContactMessageRequest(user);
  await user.save(null, { useMasterKey: true });
  return { ok: true };
});
