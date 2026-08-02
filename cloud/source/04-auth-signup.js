/** Cadastro de usuario e anti-bot */

const SIGNUP_MIN_DURATION_MS = 8000;
const SIGNUP_MAX_PER_IP_PER_HOUR = 5;
const LOCAL_SIGNUP_CHALLENGE_ID = 'local';

function parseSignupStartedAt(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'object' && value.iso) {
    const parsed = new Date(value.iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

Parse.Cloud.define('prepareSignupChallenge', async () => {
  const left = Math.floor(Math.random() * 8) + 1;
  const right = Math.floor(Math.random() * 8) + 1;
  const challenge = new Parse.Object('SignupChallenge');
  challenge.set('expectedAnswer', left + right);
  challenge.set('expiresAt', new Date(Date.now() + 10 * 60 * 1000));
  challenge.set('used', false);
  await challenge.save(null, { useMasterKey: true });
  return {
    challengeId: challenge.id,
    question: `Quanto e ${left} + ${right}?`,
  };
});

async function validateNewUserSignupAntiBot(user, ip) {
  const honeypot = String(user.get('signupHoneypot') || '').trim();
  if (honeypot) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Cadastro invalido.');
  }

  const startedAt = user.get('signupStartedAt');
  if (!startedAt || Date.now() - new Date(startedAt).getTime() < SIGNUP_MIN_DURATION_MS) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Cadastro muito rapido. Revise os dados e tente novamente.'
    );
  }

  const challengeId = String(user.get('signupChallengeId') || '').trim();
  const captchaAnswer = Number(user.get('signupCaptchaAnswer'));
  if (!challengeId || Number.isNaN(captchaAnswer)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Complete a verificacao de cadastro.');
  }

  if (challengeId === LOCAL_SIGNUP_CHALLENGE_ID) {
    // Fallback quando prepareSignupChallenge nao esta disponivel no cliente.
  } else {
    const challenge = await new Parse.Query('SignupChallenge').get(challengeId, { useMasterKey: true });
    if (challenge.get('used')) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Verificacao de cadastro ja utilizada.');
    }
    const expiresAt = challenge.get('expiresAt');
    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Verificacao de cadastro expirada.');
    }
    if (Number(challenge.get('expectedAnswer')) !== captchaAnswer) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Resposta da verificacao incorreta.');
    }

    challenge.set('used', true);
    await challenge.save(null, { useMasterKey: true });
  }

  const normalizedIp = String(ip || '').trim();
  if (normalizedIp) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await new Parse.Query(Parse.User)
      .equalTo('signupIp', normalizedIp)
      .greaterThan('createdAt', since)
      .count({ useMasterKey: true });
    if (recentCount >= SIGNUP_MAX_PER_IP_PER_HOUR) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Muitas tentativas de cadastro. Aguarde e tente mais tarde.'
      );
    }
    user.set('signupIp', normalizedIp);
  }

  user.unset('signupHoneypot');
  user.unset('signupStartedAt');
  user.unset('signupChallengeId');
  user.unset('signupCaptchaAnswer');
}

Parse.Cloud.define('registerUser', async (request) => {
  const params = request.params || {};
  const name = String(params.name || '').trim();
  const apelido = String(params.apelido || '').trim();
  const password = String(params.password || '');
  const emailInput = String(params.email || '').trim().toLowerCase();
  const phoneInput = String(params.phone || '').trim();
  const address = params.address;

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome completo (minimo 2 caracteres).');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um apelido (minimo 2 caracteres).');
  }
  if (password.length < 8) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'A senha deve ter no minimo 8 caracteres.');
  }
  if (!emailInput && !phoneInput) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe e-mail ou celular.');
  }
  if (emailInput && !isEmailValue(emailInput)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }
  if (phoneInput && normalizePhoneForStorage(phoneInput).length < 10) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um celular valido (DDD + numero).');
  }
  if (!isAddressCompleteForUpdate(address)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Selecione seu endereco na lista para validar a localizacao.'
    );
  }

  const normalizedPhone = phoneInput ? normalizePhoneForStorage(phoneInput) : '';
  const username = resolveUsernameFromContact(emailInput, normalizedPhone);
  if (!username) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe e-mail ou celular valido.');
  }

  await assertContactAvailable({
    username,
    email: emailInput || undefined,
    phone: normalizedPhone || undefined,
  });

  const user = new Parse.User();
  user.set('username', username);
  user.set('password', password);
  user.set('name', name);
  user.set('apelido', apelido);
  user.set('address', address);

  if (emailInput) {
    user.set('email', emailInput);
  }
  if (normalizedPhone) {
    user.set('phone', normalizedPhone);
  }
  if (params.birthDate) {
    user.set('birthDate', new Date(params.birthDate));
  }

  user.set('signupChallengeId', String(params.signupChallengeId || '').trim());
  user.set('signupCaptchaAnswer', Number(params.signupCaptchaAnswer));
  user.set('signupStartedAt', parseSignupStartedAt(params.signupStartedAt));
  user.set('signupHoneypot', String(params.signupHoneypot || '').trim());

  await user.signUp(null, { useMasterKey: true });

  const loggedIn = await Parse.User.logIn(username, password);
  return { sessionToken: loggedIn.getSessionToken(), objectId: loggedIn.id };
});

Parse.Cloud.beforeSave(Parse.User, async (request) => {
  if (!request.object.isNew()) {
    return;
  }

  await validateNewUserSignupAntiBot(request.object, request.ip);
});
