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
  const normalizedPhone = normalizePhoneForStorage(phone);
  if (normalizedPhone.length >= 10) {
    return normalizedPhone;
  }
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail && isEmailValue(normalizedEmail)) {
    return normalizedEmail;
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

async function assertContactAvailable({ username, email, phone, excludeUserId }) {
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
  const nextUsername = resolveUsernameFromContact(emailInput, normalizedPhone);
  if (!nextUsername) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe e-mail ou celular valido.');
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
