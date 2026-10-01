/**
 * Cloud Code — conta do usuario e login
 * Modulos: 10-pelada, 11-profiles-search, 07-mural, 08-scout, 09-events, ...
 */

Parse.Cloud.define('resolveLoginUsername', async (request) => {
  const identifier = String(request.params.identifier || '').trim();
  if (!identifier) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'identifier obrigatorio.');
  }

  if (identifier.includes('@')) {
    const byUsername = new Parse.Query(Parse.User);
    byUsername.equalTo('username', identifier.toLowerCase());
    const user = await byUsername.first({ useMasterKey: true });
    if (user && user.getUsername()) {
      return { username: user.getUsername() };
    }
    return { username: null };
  }

  const variants = phoneVariants(identifier);
  for (const variant of variants) {
    const byUsername = new Parse.Query(Parse.User);
    byUsername.equalTo('username', variant);
    let user = await byUsername.first({ useMasterKey: true });
    if (user && digitsMatch(identifier, user.getUsername() || '')) {
      return { username: user.getUsername() };
    }

    const byPhone = new Parse.Query(Parse.User);
    byPhone.equalTo('phone', variant);
    user = await byPhone.first({ useMasterKey: true });
    if (user && digitsMatch(identifier, user.get('phone') || '')) {
      return { username: user.getUsername() };
    }

    if (/^\d+$/.test(variant)) {
      const asNumber = Number(variant);
      if (!Number.isNaN(asNumber)) {
        const byUsernameNum = new Parse.Query(Parse.User);
        byUsernameNum.equalTo('username', asNumber);
        user = await byUsernameNum.first({ useMasterKey: true });
        if (user && digitsMatch(identifier, user.getUsername() || '')) {
          return { username: user.getUsername() };
        }

        const byPhoneNum = new Parse.Query(Parse.User);
        byPhoneNum.equalTo('phone', asNumber);
        user = await byPhoneNum.first({ useMasterKey: true });
        if (user && digitsMatch(identifier, user.get('phone') || '')) {
          return { username: user.getUsername() };
        }
      }
    }
  }

  return { username: null };
});



function isEmailValue(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizePhoneForStorage(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

function resolveUsernameFromContact(email, phone) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail && isEmailValue(normalizedEmail)) {
    return normalizedEmail;
  }
  const normalizedPhone = normalizePhoneForStorage(phone);
  if (normalizedPhone.length >= 10) {
    return normalizedPhone;
  }
  return null;
}

function isAddressCompleteForUpdate(address) {
  if (!address || typeof address !== 'object') return false;
  const zip = String(address.zipCode || '').replace(/\D/g, '');
  const state = String(address.state || '').trim().toUpperCase();
  return (
    !!String(address.street || '').trim() &&
    !!String(address.neighborhood || '').trim() &&
    !!String(address.city || '').trim() &&
    state.length === 2 &&
    zip.length === 8 &&
    typeof address.latitude === 'number' &&
    typeof address.longitude === 'number' &&
    !Number.isNaN(address.latitude) &&
    !Number.isNaN(address.longitude)
  );
}

function isAddressEmptyForUpdate(address) {
  if (!address || typeof address !== 'object') return true;
  const zip = String(address.zipCode || '').replace(/\D/g, '');
  const state = String(address.state || '').trim();
  return (
    !String(address.street || '').trim() &&
    !String(address.neighborhood || '').trim() &&
    !String(address.city || '').trim() &&
    !state &&
    !zip &&
    typeof address.latitude !== 'number' &&
    typeof address.longitude !== 'number'
  );
}

async function verifyCurrentPassword(user, password) {
  const username = user.getUsername();
  if (!username || !password) return false;
  try {
    await Parse.User.logIn(username, String(password));
    return true;
  } catch (error) {
    return false;
  }
}

async function assertContactAvailable({ username, email, phone, cpf, excludeUserId }) {
  if (username) {
    const query = new Parse.Query(Parse.User);
    query.equalTo('username', username);
    const existing = await query.first({ useMasterKey: true });
    if (existing && existing.id !== excludeUserId) {
      throw new Parse.Error(
        Parse.Error.USERNAME_TAKEN,
        'Nome de usuario ja cadastrado. Use outro e-mail ou celular.'
      );
    }
  }

  if (email) {
    const query = new Parse.Query(Parse.User);
    query.equalTo('email', email);
    const existing = await query.first({ useMasterKey: true });
    if (existing && existing.id !== excludeUserId) {
      throw new Parse.Error(Parse.Error.EMAIL_TAKEN, 'E-mail ja cadastrado.');
    }
  }

  if (phone) {
    const variants = phoneVariants(phone);
    for (const variant of variants) {
      const byPhone = new Parse.Query(Parse.User);
      byPhone.equalTo('phone', variant);
      let existing = await byPhone.first({ useMasterKey: true });
      if (existing && existing.id !== excludeUserId) {
        throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Celular ja cadastrado.');
      }

      if (/^\d+$/.test(variant)) {
        const byUsername = new Parse.Query(Parse.User);
        byUsername.equalTo('username', variant);
        existing = await byUsername.first({ useMasterKey: true });
        if (existing && existing.id !== excludeUserId) {
          throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Celular ja cadastrado.');
        }
      }
    }
  }

  if (cpf) {
    const query = new Parse.Query(Parse.User);
    query.equalTo('cpf', cpf);
    const existing = await query.first({ useMasterKey: true });
    if (existing && existing.id !== excludeUserId) {
      throw new Parse.Error(
        Parse.Error.DUPLICATE_VALUE,
        'CPF ja cadastrado. Faca login com a conta existente. Se esqueceu a senha, use Recuperar senha na tela de login.'
      );
    }
  }
}

function normalizeCpfDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpf(value) {
  const cpf = normalizeCpfDigits(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let dig1 = (sum * 10) % 11;
  if (dig1 === 10) dig1 = 0;
  if (dig1 !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  let dig2 = (sum * 10) % 11;
  if (dig2 === 10) dig2 = 0;
  return dig2 === Number(cpf[10]);
}

function buildUserDisplayFields(user) {
  const apelido = String(user.get('apelido') || '').trim();
  const fullName = String(user.get('name') || '').trim();
  const displayName = apelido || fullName || user.getUsername() || 'Usuario';
  return { apelido, fullName, displayName };
}

function applyAthleteProfileDisplayFields(profile, user) {
  const { apelido, fullName, displayName } = buildUserDisplayFields(user);
  profile.set('userApelido', apelido);
  profile.set('userName', displayName);
  if (user.id) profile.set('userId', user.id);

  const address = user.get('address') || {};
  if (address.city) profile.set('userCity', String(address.city).trim());
  else profile.unset('userCity');
  if (address.state) profile.set('userState', String(address.state).trim().toUpperCase());
  else profile.unset('userState');
  if (typeof address.latitude === 'number' && !Number.isNaN(address.latitude)) {
    profile.set('userLatitude', String(address.latitude));
  } else {
    profile.unset('userLatitude');
  }
  if (typeof address.longitude === 'number' && !Number.isNaN(address.longitude)) {
    profile.set('userLongitude', String(address.longitude));
  } else {
    profile.unset('userLongitude');
  }

  const avatarUrl = user.get('avatarUrl');
  if (avatarUrl) profile.set('userAvatarUrl', avatarUrl);
}

function applyRoleProfileDisplayFields(profile, user) {
  applyAthleteProfileDisplayFields(profile, user);
}

function applyRegistrationUserDisplayFields(registration, user) {
  const { apelido, fullName, displayName } = buildUserDisplayFields(user);
  registration.set('userApelido', apelido);
  registration.set('userFullName', fullName);
  registration.set('userDisplayName', displayName);
  if (user.id) registration.set('participantUserId', user.id);
}

function applyMembershipDisplayFields(membership, user) {
  const { apelido, fullName, displayName } = buildUserDisplayFields(user);
  membership.set('memberApelido', apelido);
  membership.set('memberFullName', fullName);
  membership.set('memberDisplayName', displayName);
  if (user.id) membership.set('memberUserId', user.id);
  const avatarUrl = user.get('avatarUrl');
  if (avatarUrl) membership.set('memberAvatarUrl', avatarUrl);
}

function applyAdminDisplayFields(obj, user) {
  const { apelido, displayName } = buildUserDisplayFields(user);
  if (user && user.id) {
    obj.set('adminUserId', user.id);
  }
  obj.set('adminApelido', apelido);
  obj.set('adminName', displayName);
  const avatarUrl = user.get('avatarUrl');
  if (avatarUrl) obj.set('adminAvatarUrl', avatarUrl);
}

async function propagateUserDisplayFields(user) {
  const toSave = [];

  const athleteProfiles = await new Parse.Query('AthleteProfile')
    .equalTo('user', user)
    .limit(20)
    .find({ useMasterKey: true });
  for (const profile of athleteProfiles) {
    applyAthleteProfileDisplayFields(profile, user);
    toSave.push(profile);
  }

  const roleProfiles = await new Parse.Query('RoleProfile')
    .equalTo('user', user)
    .limit(20)
    .find({ useMasterKey: true });
  for (const profile of roleProfiles) {
    applyRoleProfileDisplayFields(profile, user);
    toSave.push(profile);
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', user)
    .limit(2000)
    .find({ useMasterKey: true });
  for (const registration of registrations) {
    applyRegistrationUserDisplayFields(registration, user);
    toSave.push(registration);
  }

  const memberships = await new Parse.Query('PeladaMembership')
    .equalTo('user', user)
    .limit(500)
    .find({ useMasterKey: true });
  for (const membership of memberships) {
    applyMembershipDisplayFields(membership, user);
    toSave.push(membership);
  }

  const peladas = await new Parse.Query('Pelada')
    .equalTo('admin', user)
    .limit(200)
    .find({ useMasterKey: true });
  for (const pelada of peladas) {
    applyAdminDisplayFields(pelada, user);
    toSave.push(pelada);
  }

  const events = await new Parse.Query('Event')
    .equalTo('admin', user)
    .limit(500)
    .find({ useMasterKey: true });
  for (const event of events) {
    applyAdminDisplayFields(event, user);
    toSave.push(event);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
}

function getAgeBandFromAge(age) {
  if (age == null || Number.isNaN(age)) return null;
  if (age < 30) return 'sub30';
  if (age < 60) return 'sub60';
  return 'plus60';
}

Parse.Cloud.define('updateUserAccount', async (request) => {
  const sessionUser = request.user;
  if (!sessionUser) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const user = await new Parse.Query(Parse.User).get(sessionUser.id, { useMasterKey: true });

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const emailInput = String(request.params.email || '').trim().toLowerCase();
  const phoneInput = String(request.params.phone || '').trim();
  const address = request.params.address;

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome completo (minimo 2 caracteres).');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um apelido (minimo 2 caracteres).');
  }
  if (!emailInput || !isEmailValue(emailInput)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }
  if (phoneInput && normalizePhoneForStorage(phoneInput).length < 10) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um celular valido (DDD + numero).');
  }
  if (!isAddressCompleteForUpdate(address)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe seu endereco na lista. Ele e usado para sugerir eventos proximos e rankings por bairro, cidade e estado.'
    );
  }

  const normalizedPhone = phoneInput ? normalizePhoneForStorage(phoneInput) : '';
  const nextUsername = resolveUsernameFromContact(emailInput, normalizedPhone);
  if (!nextUsername) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }

  await assertContactAvailable({
    username: nextUsername,
    email: emailInput || undefined,
    phone: normalizedPhone || undefined,
    excludeUserId: user.id,
  });

  user.set('name', name);
  user.set('apelido', apelido);
  user.set('address', address);

  if (emailInput) {
    user.set('email', emailInput);
  } else {
    user.unset('email');
  }

  if (normalizedPhone) {
    user.set('phone', normalizedPhone);
  } else {
    user.unset('phone');
  }

  if (user.getUsername() !== nextUsername) {
    user.set('username', nextUsername);
  }

  if (request.params.birthDate === null || request.params.birthDate === '') {
    user.unset('birthDate');
  } else if (request.params.birthDate) {
    user.set('birthDate', new Date(request.params.birthDate));
  }

  const proFootballIdol = String(request.params.proFootballIdol || '').trim();
  const amateurFootballIdol = String(request.params.amateurFootballIdol || '').trim();
  if (proFootballIdol) user.set('proFootballIdol', proFootballIdol);
  else user.unset('proFootballIdol');
  if (amateurFootballIdol) user.set('amateurFootballIdol', amateurFootballIdol);
  else user.unset('amateurFootballIdol');

  const favoriteAmateurTeam = String(request.params.favoriteAmateurTeam || '').trim();
  if (favoriteAmateurTeam) user.set('favoriteAmateurTeam', favoriteAmateurTeam);
  else user.unset('favoriteAmateurTeam');

  const favoriteProTeam = String(request.params.favoriteProTeam || '').trim();
  if (favoriteProTeam) user.set('favoriteProTeam', favoriteProTeam);
  else user.unset('favoriteProTeam');

  if (request.params.showPhoneInProfile === true) {
    user.set('showPhoneInProfile', true);
  } else if (request.params.showPhoneInProfile === false) {
    user.set('showPhoneInProfile', false);
  }

  if (request.params.showEmailInProfile === true) {
    user.set('showEmailInProfile', true);
  } else if (request.params.showEmailInProfile === false) {
    user.set('showEmailInProfile', false);
  }

  await user.save(null, { useMasterKey: true });
  await propagateUserDisplayFields(user);

  const { apelido: savedApelido, fullName, displayName } = buildUserDisplayFields(user);
  return {
    userId: user.id,
    displayName,
    apelido: savedApelido || undefined,
    fullName: fullName || undefined,
    username: user.getUsername(),
    email: user.get('email') || undefined,
    phone: user.get('phone') || undefined,
  };
});

Parse.Cloud.define('changeUserPassword', async (request) => {
  const sessionUser = request.user;
  if (!sessionUser) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const currentPassword = String(request.params.currentPassword || '');
  const newPassword = String(request.params.newPassword || '');

  if (!currentPassword) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe sua senha atual.');
  }
  if (newPassword.length < 8) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'A nova senha deve ter no minimo 8 caracteres.');
  }

  const user = await new Parse.Query(Parse.User).get(sessionUser.id, { useMasterKey: true });
  const passwordOk = await verifyCurrentPassword(user, currentPassword);
  if (!passwordOk) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Senha atual incorreta.');
  }

  user.set('password', newPassword);
  await user.save(null, { useMasterKey: true });

  return { ok: true };
});

const PASSWORD_RESET_OTP_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_MIN_INTERVAL_MS = 60 * 1000;
const PASSWORD_RESET_MAX_PER_HOUR = 5;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

async function findUserForPasswordReset(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const byEmail = new Parse.Query(Parse.User);
  byEmail.equalTo('email', normalized);
  const userByEmail = await byEmail.first({ useMasterKey: true });
  if (userByEmail) return userByEmail;

  const byUsername = new Parse.Query(Parse.User);
  byUsername.equalTo('username', normalized);
  return byUsername.first({ useMasterKey: true });
}

function hashPasswordResetOtp(otp, salt) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function createPasswordResetOtp() {
  const crypto = require('crypto');
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  return { otp, stored: `${salt}:${hashPasswordResetOtp(otp, salt)}` };
}

function passwordResetOtpMatches(stored, otp) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, expected] = parts;
  return hashPasswordResetOtp(String(otp || ''), salt) === expected;
}

function clearPasswordResetFields(user) {
  user.unset('passwordResetOtpHash');
  user.unset('passwordResetExpiresAt');
  user.unset('passwordResetFailCount');
}

function assertPasswordResetRateLimit(user) {
  const now = Date.now();
  const lastAt = user.get('passwordResetRequestedAt');
  const lastMs = lastAt instanceof Date ? lastAt.getTime() : 0;
  if (lastMs && now - lastMs < PASSWORD_RESET_MIN_INTERVAL_MS) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Aguarde um minuto antes de pedir outro codigo.'
    );
  }

  const hourStarted = user.get('passwordResetHourStartedAt');
  const hourStartMs = hourStarted instanceof Date ? hourStarted.getTime() : 0;
  const hourCount = Number(user.get('passwordResetHourCount') || 0);
  if (hourStartMs && now - hourStartMs < 60 * 60 * 1000 && hourCount >= PASSWORD_RESET_MAX_PER_HOUR) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Limite de envios atingido. Tente novamente em uma hora.'
    );
  }
}

function markPasswordResetRequest(user) {
  const now = new Date();
  const hourStarted = user.get('passwordResetHourStartedAt');
  const hourStartMs = hourStarted instanceof Date ? hourStarted.getTime() : 0;
  if (!hourStartMs || now.getTime() - hourStartMs >= 60 * 60 * 1000) {
    user.set('passwordResetHourStartedAt', now);
    user.set('passwordResetHourCount', 1);
  } else {
    user.set('passwordResetHourCount', Number(user.get('passwordResetHourCount') || 0) + 1);
  }
  user.set('passwordResetRequestedAt', now);
}

Parse.Cloud.define('requestPasswordResetEmail', async (request) => {
  const email = String(request.params.email || '').trim().toLowerCase();
  if (!email || !isEmailValue(email)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }

  await assertSmtpConfigured();

  const user = await findUserForPasswordReset(email);
  if (!user) {
    return { ok: true };
  }

  assertPasswordResetRateLimit(user);

  const { otp, stored } = createPasswordResetOtp();
  user.set('passwordResetOtpHash', stored);
  user.set('passwordResetExpiresAt', new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS));
  user.set('passwordResetFailCount', 0);
  markPasswordResetRequest(user);
  await user.save(null, { useMasterKey: true });

  const subject = 'Controle de Bola — codigo para redefinir senha';
  const text = [
    'Voce pediu para redefinir a senha do Controle de Bola.',
    '',
    `Codigo: ${otp}`,
    '',
    'Ele vale por 30 minutos. Digite o codigo no app e escolha a nova senha.',
    'Se nao foi voce, ignore este e-mail.',
  ].join('\n');
  const html = `
    <p>Voce pediu para redefinir a senha do <strong>Controle de Bola</strong>.</p>
    <p style="font-size:28px;letter-spacing:6px;font-weight:700">${otp}</p>
    <p>O codigo vale por 30 minutos. Digite-o no app e escolha a nova senha.</p>
    <p>Se nao foi voce, ignore este e-mail.</p>
  `;

  await sendAppMail({ to: email, subject, text, html });
  return { ok: true };
});

Parse.Cloud.define('confirmPasswordReset', async (request) => {
  const email = String(request.params.email || '').trim().toLowerCase();
  const code = String(request.params.code || '').replace(/\D/g, '');
  const newPassword = String(request.params.newPassword || '');

  if (!email || !isEmailValue(email)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o codigo de 6 digitos enviado por e-mail.');
  }
  if (newPassword.length < 8) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'A nova senha deve ter no minimo 8 caracteres.'
    );
  }

  const user = await findUserForPasswordReset(email);
  if (!user) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Codigo invalido ou expirado.');
  }

  const expiresAt = user.get('passwordResetExpiresAt');
  const expired = !(expiresAt instanceof Date) || expiresAt.getTime() < Date.now();
  const stored = user.get('passwordResetOtpHash');
  const failCount = Number(user.get('passwordResetFailCount') || 0);

  if (expired || !stored || failCount >= PASSWORD_RESET_MAX_ATTEMPTS) {
    clearPasswordResetFields(user);
    await user.save(null, { useMasterKey: true });
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Codigo invalido ou expirado.');
  }

  if (!passwordResetOtpMatches(stored, code)) {
    user.set('passwordResetFailCount', failCount + 1);
    await user.save(null, { useMasterKey: true });
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Codigo invalido ou expirado.');
  }

  user.set('password', newPassword);
  clearPasswordResetFields(user);
  await user.save(null, { useMasterKey: true });
  return { ok: true };
});

async function destroyAllByUserField(className, fieldName, user) {
  const query = new Parse.Query(className);
  query.equalTo(fieldName, user);
  query.limit(1000);
  const rows = await query.find({ useMasterKey: true });
  if (rows.length) {
    await Parse.Object.destroyAll(rows, { useMasterKey: true });
  }
}

Parse.Cloud.define('deleteMyAccount', async (request) => {
  const sessionUser = request.user;
  if (!sessionUser) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const password = String(request.params.password || '');
  if (!password) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe sua senha para excluir a conta.');
  }

  const user = await new Parse.Query(Parse.User).get(sessionUser.id, { useMasterKey: true });
  const passwordOk = await verifyCurrentPassword(user, password);
  if (!passwordOk) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Senha atual incorreta.');
  }

  await destroyAllByUserField('AthleteProfile', 'user', user);
  await destroyAllByUserField('RoleProfile', 'user', user);
  await destroyAllByUserField('FanProfile', 'user', user);
  await destroyAllByUserField('AmateurTeam', 'president', user);
  await destroyAllByUserField('FanPrediction', 'user', user);
  await destroyAllByUserField('MuralVote', 'user', user);
  await destroyAllByUserField('EventRegistration', 'user', user);
  await destroyAllByUserField('PeladaMembership', 'user', user);
  await destroyAllByUserField('RefereeInvitation', 'invitedUser', user);
  await destroyAllByUserField('EventPerformance', 'user', user);
  await destroyAllByUserField('_Session', 'user', user);
  await destroyAllByUserField('_Installation', 'user', user);

  await user.destroy({ useMasterKey: true });
  return { ok: true };
});
