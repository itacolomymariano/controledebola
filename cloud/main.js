/**
 * Cloud Code — gerado por npm run build:cloud
 * Gerado em: 2026-10-06T10:46:09.034Z
 * Copie o conteudo deste arquivo no Back4App (Server Settings > Cloud Code).
 * Fontes modulares em cloud/source/
 * NAO edite este arquivo direto — edite cloud/source/ e rode npm run build:cloud
 */

// --- 01-phone-helpers.js ---

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneVariants(phone) {
  const digits = digitsOnly(phone);
  const variants = new Set();
  if (!digits) return [];

  variants.add(digits);
  if (digits.length === 13 && digits.startsWith('55')) {
    variants.add(digits.slice(2));
  }
  if (digits.length === 11) {
    variants.add('55' + digits);
    if (digits[2] === '9') {
      variants.add(digits.slice(0, 2) + digits.slice(3));
    }
  }
  if (digits.startsWith('55') && digits.length >= 12) {
    variants.add(digits.slice(2));
  }
  if (digits.length === 10) {
    variants.add('55' + digits);
    variants.add(digits.slice(0, 2) + '9' + digits.slice(2));
  }
  return Array.from(variants);
}

function digitsMatch(input, stored) {
  const inputVariants = new Set(phoneVariants(input));
  for (const variant of phoneVariants(stored)) {
    if (inputVariants.has(variant)) {
      return true;
    }
  }
  return false;
}

// --- 01b-comment-discipline.js ---

/** Disciplina de comentarios — bloqueia palavroes / baixo calao (PT-BR). */

const COMMENT_DISCIPLINE_BLOCKED_TERMS = [
  'porra',
  'caralho',
  'merda',
  'bosta',
  'puta',
  'puto',
  'putinha',
  'putaria',
  'foda',
  'foder',
  'fodase',
  'foda-se',
  'fudido',
  'fudeu',
  'cuzao',
  'cusao',
  'buceta',
  'boceta',
  'xoxota',
  'piroca',
  'pica',
  'rola',
  'punheta',
  'siririca',
  'viado',
  'viadinho',
  'bicha',
  'bichinha',
  'arrombado',
  'arrombada',
  'otario',
  'otaria',
  'filho da puta',
  'filha da puta',
  'vai se foder',
  'vai tomar no cu',
  'tomar no cu',
  'vsf',
  'vtnc',
  'pqp',
  'krl',
  'crl',
  'pnc',
  'cacete',
  'desgraca',
  'desgracado',
  'desgracada',
  'corno',
  'cornudo',
  'vagabunda',
  'vagabundo',
  'safado',
  'safada',
  'escroto',
  'escrota',
  'imbecil',
  'idiota',
  'retardado',
  'retardada',
];

function normalizeCommentDisciplineText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assertCommentDiscipline(text) {
  const normalized = normalizeCommentDisciplineText(text);
  if (!normalized) return;

  const compact = normalized.replace(/\s+/g, '');
  for (const term of COMMENT_DISCIPLINE_BLOCKED_TERMS) {
    const normalizedTerm = normalizeCommentDisciplineText(term);
    if (!normalizedTerm) continue;
    if (normalizedTerm.includes(' ')) {
      if (normalized.includes(normalizedTerm)) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.'
        );
      }
      continue;
    }
    const wordRe = new RegExp(`(?:^|\\s)${normalizedTerm}(?:$|\\s)`, 'i');
    if (wordRe.test(normalized) || compact.includes(normalizedTerm)) {
      // Evita falso positivo em palavras curtas embutidas demais (ex.: "pica" em "tropical").
      if (normalizedTerm.length <= 3 && !wordRe.test(normalized)) {
        continue;
      }
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Comentario fora da disciplina do app. Remova palavroes ou palavras de baixo calao.'
      );
    }
  }
}

// --- 01c-integrity-helpers.js ---

/** Integridade / anti-manipulacao — regras transparentes (mural + midia). */

const INTEGRITY_MIN_EVENT_VOTERS = 3;
const INTEGRITY_MIN_MEDIA_TOP_VIEWS = 3;
const INTEGRITY_MIN_LOCATION_ROLE_VOTES = 3;

const MEDIA_AUTHOR_ID_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationAuthorId',
  radio_interview: 'radioInterviewAuthorId',
  journal_reportage: 'journalReportageAuthorId',
  journal_interview: 'journalInterviewAuthorId',
  highlight_video: 'highlightVideoAuthorId',
};

function assertNotSelfMuralVote(voterId, targetUserId) {
  const voter = String(voterId || '').trim();
  const target = String(targetUserId || '').trim();
  if (voter && target && voter === target) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Nao e permitido votar em si mesmo.'
    );
  }
}

function getMediaPublicationAuthorId(publication, category) {
  if (!publication) return '';
  const field = MEDIA_AUTHOR_ID_FIELD_BY_CATEGORY[category];
  if (!field) return '';
  return String(publication.get(field) || '').trim();
}

function assertNotMediaAuthorEngagement(publication, category, userId, actionLabel) {
  const authorId = getMediaPublicationAuthorId(publication, category);
  const uid = String(userId || '').trim();
  if (authorId && uid && authorId === uid) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `O autor nao pode ${actionLabel} na propria publicacao.`
    );
  }
}

async function loadConfirmedEventRegistration(user, event) {
  if (!user || !event) return null;
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (!registration) return null;
  const participationFee = Number(event.get('participationFee') || 0);
  if (typeof computeRegistrationEffectiveConfirmation !== 'function') {
    return registration.get('isEffectivelyConfirmed') ? registration : null;
  }
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    return null;
  }
  return registration;
}

async function isConfirmedEventParticipant(user, event) {
  return !!(await loadConfirmedEventRegistration(user, event));
}

function meetsEventVoterQuorum(voterCount) {
  return Number(voterCount) >= INTEGRITY_MIN_EVENT_VOTERS;
}

function meetsMediaTopViewQuorum(viewCount) {
  return Number(viewCount) >= INTEGRITY_MIN_MEDIA_TOP_VIEWS;
}

function emptyMuralRoleRankings() {
  const roles =
    typeof MURAL_TARGET_ROLES !== 'undefined' && Array.isArray(MURAL_TARGET_ROLES)
      ? MURAL_TARGET_ROLES
      : [
          'athlete',
          'goalkeeper',
          'referee',
          'scout',
          'journalist',
          'cameraman',
          'narrator',
          'coach',
          'physical_trainer',
          'masseur',
          'kitman',
          'gandula',
        ];
  const result = {};
  for (const role of roles) {
    result[role] = [];
  }
  return result;
}

// --- 01d-mail-helpers.js ---

/**
 * Envio de e-mail pelo Cloud Code (nodemailer).
 * Credenciais: 1) App Settings → Environment Variables (process.env)
 * 2) classe MailSettings (Master Key). O emailAdapter nativo do Parse e outro assunto.
 * Nunca gravar senha no Git.
 */

const MAIL_SETTINGS_CLASS = 'MailSettings';
const MAIL_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
let smtpConfigCache = { at: 0, config: null };

function readSmtpFromEnv() {
  const host = String(process.env.SMTP_HOST || process.env.MAIL_HOST || '').trim();
  const user = String(process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || process.env.MAIL_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
  const from = String(
    process.env.SMTP_FROM || process.env.MAIL_FROM || (user ? `Controle de Bola <${user}>` : '')
  ).trim();

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from,
    replyTo: String(process.env.SMTP_REPLY_TO || '').trim(),
  };
}

async function readSmtpFromMailSettings() {
  const query = new Parse.Query(MAIL_SETTINGS_CLASS);
  const row = await query.first({ useMasterKey: true });
  if (!row) return null;

  const host = String(row.get('host') || '').trim();
  const user = String(row.get('user') || '').trim();
  const pass = String(row.get('pass') || '').trim();
  const from = String(row.get('from') || (user ? `Controle de Bola <${user}>` : '')).trim();
  const port = Number(row.get('port') || 587);

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    user,
    pass,
    from,
    replyTo: String(row.get('replyTo') || '').trim(),
  };
}

async function readSmtpConfig() {
  const fromEnv = readSmtpFromEnv();
  if (fromEnv) return fromEnv;

  if (smtpConfigCache.config && Date.now() - smtpConfigCache.at < 60 * 1000) {
    return smtpConfigCache.config;
  }

  const fromClass = await readSmtpFromMailSettings();
  smtpConfigCache = { at: Date.now(), config: fromClass };
  return fromClass;
}

async function assertSmtpConfigured() {
  const config = await readSmtpConfig();
  if (!config) {
    throw new Parse.Error(
      Parse.Error.INTERNAL_SERVER_ERROR,
      'SMTP nao configurado. No Back4App (App Settings → Environment Variables) cadastre SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM, ou crie 1 objeto na classe MailSettings. Publique cloud/main.js e cloud/package.json (nodemailer).'
    );
  }
  return config;
}

function loadNodemailer() {
  try {
    return require('nodemailer');
  } catch (error) {
    throw new Parse.Error(
      Parse.Error.INTERNAL_SERVER_ERROR,
      'Modulo nodemailer ausente. Publique cloud/package.json no Cloud Code e aguarde o build NPM.'
    );
  }
}

function isAllowedAttachmentUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host.includes('back4app') || host.endsWith('b4a.io');
  } catch {
    return false;
  }
}

async function buildMailAttachment(attachmentUrl, filename) {
  if (!attachmentUrl) return null;
  if (!isAllowedAttachmentUrl(attachmentUrl)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Anexo invalido.');
  }

  const response = await fetch(attachmentUrl);
  if (!response.ok) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao foi possivel ler o anexo.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAIL_ATTACHMENT_MAX_BYTES) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O anexo deve ter no maximo 5 MB.');
  }

  return {
    filename: String(filename || 'anexo').replace(/[^\w.\-]+/g, '_').slice(0, 80),
    content: buffer,
  };
}

async function sendAppMail({ to, subject, text, html, replyTo, attachmentUrl, attachmentName }) {
  const config = await assertSmtpConfigured();
  const nodemailer = loadNodemailer();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const attachments = [];
  const file = await buildMailAttachment(attachmentUrl, attachmentName);
  if (file) attachments.push(file);

  try {
    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html: html || undefined,
      replyTo: replyTo || config.replyTo || 'contato@controledebola.com.br',
      attachments: attachments.length ? attachments : undefined,
    });
  } catch (error) {
    const detail = error && error.message ? String(error.message) : 'falha SMTP';
    console.error('sendAppMail failed:', detail);
    throw new Parse.Error(
      Parse.Error.INTERNAL_SERVER_ERROR,
      'Nao foi possivel enviar o e-mail. Confira o objeto MailSettings (host/user/pass do Zoho).'
    );
  }
}

Parse.Cloud.define('configureMailSettingsClassPermissions', async (request) => {
  if (!request.master) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Use Master Key (API Console REST) para configurar MailSettings.'
    );
  }

  const schema = new Parse.Schema(MAIL_SETTINGS_CLASS);
  let exists = true;
  try {
    await schema.get();
  } catch {
    exists = false;
  }

  if (!exists) {
    schema.addString('host');
    schema.addNumber('port');
    schema.addString('user');
    schema.addString('pass');
    schema.addString('from');
    schema.addString('replyTo');
  }

  schema.setCLP({
    find: {},
    get: {},
    count: {},
    create: {},
    update: {},
    delete: {},
    addField: {},
  });

  if (exists) {
    await schema.update();
  } else {
    await schema.save();
  }

  return { ok: true, className: MAIL_SETTINGS_CLASS };
});

// --- 02-core.js ---

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

// --- 02b-contact-messages.js ---

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

// --- 03-push-notifications.js ---

/** Push notifications, hooks e sync de avatar */

const PUSH_APP_IDENTIFIER = 'com.minhapelada.app';
const FCM_SENDER_ID = '228387546437';
const ANDROID_PUSH_CHANNEL_ID = 'event_messages';

async function sendPushToUser(userId, payload) {
  if (!userId) return;
  // Notificacoes automaticas nao devem quebrar o afterSave.
  await sendPushToUsers([String(userId)], payload, { throwOnError: false });
}

function buildInstallationQueryForUsers(userIds) {
  const userPointers = userIds.map((id) => Parse.User.createWithoutData(id));
  const byUserPointer = new Parse.Query(Parse.Installation);
  byUserPointer.containedIn('user', userPointers);
  byUserPointer.exists('deviceToken');

  // Fallback: algumas instalacoes antigas podem ter so userId textual.
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.containedIn('userId', userIds);
  byUserId.exists('deviceToken');

  return Parse.Query.or(byUserPointer, byUserId);
}

/**
 * Monta payload FCM HTTP v1 para Capacitor.
 * IMPORTANTE: `rawPayload` deve ir no topo do Parse.Push.send (irmão de `where`),
 * nao dentro de `data` — senao o adaptador ignora e a bandeja Android fica vazia.
 */
function buildFcmPushFields(payload) {
  const title = payload.title || 'Controle de Bola';
  const alert = payload.alert || payload.body || title;
  const customData = {
    title,
    alert,
    body: alert,
    // Capacitor / FCM: canal deve bater com PushNotifications.createChannel({ id }).
    android_channel_id: ANDROID_PUSH_CHANNEL_ID,
    channel_id: ANDROID_PUSH_CHANNEL_ID,
  };
  const extra = payload.data || {};
  for (const key of Object.keys(extra)) {
    const value = extra[key];
    if (value == null) continue;
    customData[key] = typeof value === 'string' ? value : String(value);
  }

  const androidNotification = {
    title,
    body: alert,
    // firebase-admin (camelCase) + HTTP v1 REST (snake_case) — Gemini/Firebase.
    channelId: ANDROID_PUSH_CHANNEL_ID,
    channel_id: ANDROID_PUSH_CHANNEL_ID,
    sound: 'default',
  };

  return {
    title,
    alert,
    // Formato documentado pelo parse-server-push-adapter (issue #286).
    rawPayload: {
      notification: {
        title,
        body: alert,
      },
      android: {
        priority: 'high',
        notification: androidNotification,
        data: customData,
      },
      data: customData,
    },
    // Fallback legado (Parse Android SDK / adaptadores antigos).
    data: {
      notification: {
        title,
        body: alert,
      },
      data: customData,
      alert,
      title,
      body: alert,
      sound: 'default',
    },
  };
}

/** Usuarios com pushNotificationsEnabled === false nao recebem push (default: habilitado). */
async function filterUsersAllowingPush(userIds) {
  const ids = [...new Set([...(userIds || [])].map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];

  const denied = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const users = await new Parse.Query(Parse.User)
      .containedIn('objectId', batch)
      .select(['pushNotificationsEnabled'])
      .limit(100)
      .find({ useMasterKey: true });
    for (const row of users) {
      if (row.get('pushNotificationsEnabled') === false) {
        denied.add(row.id);
      }
    }
  }
  return ids.filter((id) => !denied.has(id));
}

async function unlinkAllInstallationsForUser(userId) {
  if (!userId) return 0;
  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', String(userId));
  const rows = await Parse.Query.or(byPointer, byUserId).limit(100).find({ useMasterKey: true });
  if (!rows.length) return 0;
  for (const row of rows) {
    row.unset('user');
    row.unset('userId');
  }
  await Parse.Object.saveAll(rows, { useMasterKey: true });
  return rows.length;
}

async function sendPushToUsers(userIds, payload, options = {}) {
  const throwOnError = options.throwOnError !== false;
  const idList = await filterUsersAllowingPush(userIds);
  if (!idList.length) {
    return {
      targetedUsers: 0,
      devicesMatched: 0,
      pushBatchesSent: 0,
      matchedUserIds: [],
      matchedInstallationIds: [],
    };
  }

  const { rawPayload, data } = buildFcmPushFields(payload);
  let devicesMatched = 0;
  let pushBatchesSent = 0;
  const matchedUserIds = new Set();
  const matchedInstallationIds = [];

  try {
    for (let i = 0; i < idList.length; i += 100) {
      const batch = idList.slice(i, i + 100);

      // Resolve instalacoes primeiro — Query.or direto no Push.send e instavel no Back4App.
      const installations = await buildInstallationQueryForUsers(batch)
        .limit(1000)
        .find({ useMasterKey: true });
      if (!installations.length) continue;

      const installationIds = [...new Set(installations.map((row) => row.id).filter(Boolean))];
      devicesMatched += installationIds.length;
      matchedInstallationIds.push(...installationIds);

      for (const row of installations) {
        const linked =
          (row.get('user') && row.get('user').id) ||
          row.get('userId') ||
          '';
        if (linked) matchedUserIds.add(String(linked));
      }

      const whereQuery = new Parse.Query(Parse.Installation);
      whereQuery.containedIn('objectId', installationIds);
      // rawPayload no TOPO (nao dentro de data) — exigido pelo adaptador FCM v1.
      await Parse.Push.send({ where: whereQuery, rawPayload, data }, { useMasterKey: true });
      pushBatchesSent += 1;
    }
  } catch (error) {
    console.error('sendPushToUsers failed', error);
    if (throwOnError) throw error;
    return {
      targetedUsers: idList.length,
      devicesMatched,
      pushBatchesSent,
      matchedUserIds: [...matchedUserIds],
      matchedInstallationIds,
    };
  }

  return {
    targetedUsers: idList.length,
    devicesMatched,
    pushBatchesSent,
    matchedUserIds: [...matchedUserIds],
    matchedInstallationIds,
  };
}

function formatEventPushDate(startTime) {
  if (!startTime) return '';
  const date = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function collectNewPeladaEventAudience(peladaId, excludeEventId) {
  if (typeof collectPeladaParticipantUserIds === 'function') {
    return collectPeladaParticipantUserIds(peladaId);
  }
  return collectPeladaPreviousEventParticipantUserIds(peladaId, excludeEventId);
}

async function notifyNewPeladaEvent(event) {
  const empty = {
    ok: false,
    skipped: 'missing_event',
    targetedUsers: 0,
    devicesMatched: 0,
    audience: 0,
  };
  if (!event || !event.id) return empty;

  if (event.get('pushNewEventSentAt')) {
    return {
      ok: true,
      skipped: 'already_sent',
      targetedUsers: 0,
      devicesMatched: 0,
      audience: 0,
    };
  }

  const peladaPtr = event.get('pelada');
  if (!peladaPtr || !peladaPtr.id) {
    return { ...empty, skipped: 'missing_pelada' };
  }

  const peladaId = peladaPtr.id;
  const eventId = event.id;
  const participantIds = await collectNewPeladaEventAudience(peladaId, eventId);
  const admin = event.get('admin');
  if (admin && admin.id) {
    participantIds.delete(String(admin.id));
  }
  if (!participantIds.size) {
    console.info('notifyNewPeladaEvent empty audience', { eventId, peladaId });
    return { ok: true, skipped: 'empty_audience', targetedUsers: 0, devicesMatched: 0, audience: 0 };
  }

  let peladaName = 'pelada';
  try {
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    peladaName = pelada.get('name') || peladaName;
  } catch {
    // Mantem nome padrao se a pelada nao for encontrada.
  }

  const eventName = event.get('name') || 'Novo evento';
  const dateLabel = formatEventPushDate(event.get('startTime'));
  const alert = dateLabel
    ? `Novo evento "${eventName}" em ${peladaName} em ${dateLabel}.`
    : `Novo evento "${eventName}" em ${peladaName}.`;

  const pushResult = await sendPushToUsers(
    participantIds,
    {
      title: 'Novo evento na pelada',
      alert,
      data: {
        type: 'new_pelada_event',
        peladaId,
        eventId,
      },
    },
    { throwOnError: false }
  );

  if (typeof createAppMessages === 'function' && admin && admin.id) {
    await createAppMessages([...participantIds], {
      senderId: String(admin.id),
      kind: 'new_pelada_event',
      title: 'Novo evento na pelada',
      body: alert,
      relatedClass: 'Event',
      relatedId: eventId,
      actionRoute: `/event/${eventId}`,
    });
  }

  event.set('pushNewEventSentAt', new Date());
  try {
    await event.save(null, { useMasterKey: true });
  } catch (error) {
    console.error('notifyNewPeladaEvent flag save failed', error);
  }

  console.info('notifyNewPeladaEvent sent', {
    eventId,
    peladaId,
    audience: participantIds.size,
    targetedUsers: pushResult.targetedUsers,
    devicesMatched: pushResult.devicesMatched,
  });

  return {
    ok: true,
    skipped: null,
    audience: participantIds.size,
    targetedUsers: pushResult.targetedUsers || 0,
    devicesMatched: pushResult.devicesMatched || 0,
    pushBatchesSent: pushResult.pushBatchesSent || 0,
  };
}

async function notifyTeamMatchStakeholders(event, userIds, excludeUserId) {
  const targets = new Set();
  for (const id of userIds || []) {
    const value = String(id || '').trim();
    if (value && value !== excludeUserId) targets.add(value);
  }
  if (!targets.size) {
    return { audience: 0, devicesMatched: 0 };
  }
  const home = event.get('homeTeamName') || 'Mandante';
  const away = event.get('awayTeamName') || 'Visitante';
  const eventName = event.get('name') || `${home} x ${away}`;
  const dateLabel = formatEventPushDate(event.get('startTime'));
  const alert = dateLabel
    ? `Confronto ${eventName} marcado para ${dateLabel}.`
    : `Confronto ${eventName} marcado.`;
  const pushResult = await sendPushToUsers(
    targets,
    {
      title: 'Novo confronto',
      alert,
      data: { type: 'team_match_created', eventId: event.id },
    },
    { throwOnError: false }
  );
  return {
    audience: targets.size,
    devicesMatched: pushResult.devicesMatched || 0,
  };
}

async function notifyProfilePresentationDecision(registration, event, peladaId, decision) {
  const participantUserId = String(
    registration.get('participantUserId') ||
      (registration.get('user') && registration.get('user').id) ||
      ''
  );
  if (!participantUserId) return;

  const eventName = (event && event.get && event.get('name')) || 'evento';
  const approved = decision === 'approved';
  const title = approved ? 'Participacao aprovada' : 'Participacao recusada';
  const alert = approved
    ? `Sua participacao no evento "${eventName}" foi aprovada.`
    : `Sua solicitacao no evento "${eventName}" foi recusada.`;

  await sendPushToUser(participantUserId, {
    title,
    alert,
    data: {
      type: approved ? 'profile_presentation_approved' : 'profile_presentation_rejected',
      eventId: event.id,
      peladaId,
      registrationId: registration.id,
    },
  });

  let senderId = '';
  if (peladaId) {
    try {
      const pelada = await new Parse.Query('Pelada').get(String(peladaId), { useMasterKey: true });
      const admin = pelada.get('admin');
      if (admin && admin.id) senderId = String(admin.id);
    } catch (error) {
      console.error('profile presentation admin lookup failed', error);
    }
  }
  if (typeof createAppMessage === 'function' && senderId && senderId !== participantUserId) {
    await createAppMessage({
      recipientId: participantUserId,
      senderId,
      kind: approved ? 'profile_presentation_approved' : 'profile_presentation_rejected',
      title,
      body: alert,
      relatedClass: 'EventRegistration',
      relatedId: registration.id,
      actionRoute: event && event.id ? `/event/${event.id}` : '',
    });
  }
}

Parse.Cloud.afterSave('Event', async (request) => {
  const event = request.object;
  if (!event || event.get('pushNewEventSentAt')) return;
  const createdAt = event.createdAt instanceof Date ? event.createdAt : new Date(event.createdAt || 0);
  if (Number.isNaN(createdAt.getTime())) return;
  // Back4App pode mandar original.id mesmo no create — dispara se o evento e recente.
  if (Date.now() - createdAt.getTime() > 5 * 60 * 1000) return;
  try {
    await notifyNewPeladaEvent(event);
  } catch (error) {
    console.error('notifyNewPeladaEvent failed', error);
  }
});

Parse.Cloud.afterSave('Event', async (request) => {
  const event = request.object;
  const wasEnabled = request.original ? !!request.original.get('gateTicketControlEnabled') : false;
  const isEnabled = !!event.get('gateTicketControlEnabled');
  if (!isEnabled || wasEnabled) return;

  const admin = event.get('admin');
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
    await maybeIssueGateTicketForRegistration(registration, event, admin);
  }
});

Parse.Cloud.afterSave('EventRegistration', async (request) => {
  const registration = request.object;
  if (registration.get('profilePresentationStatus') !== 'pending') return;
  if (request.original && request.original.get('profilePresentationStatus') === 'pending') return;

  const eventPtr = registration.get('event');
  if (!eventPtr || !eventPtr.id) return;

  let event;
  try {
    event = await new Parse.Query('Event').include('pelada').get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }

  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.id) return;
  const admin = pelada.get('admin');
  if (!admin || !admin.id) return;

  const participantName =
    registration.get('userDisplayName') || registration.get('apelido') || 'Participante';
  const eventName = event.get('name') || 'evento';

  const requestAlert = `${participantName} pediu para participar do evento "${eventName}".`;
  await sendPushToUser(admin.id, {
    title: 'Nova solicitacao de participacao',
    alert: requestAlert,
    data: {
      type: 'profile_presentation_request',
      peladaId: pelada.id,
      eventId: event.id,
      registrationId: registration.id,
    },
  });

  const participantUserId = String(
    registration.get('participantUserId') ||
      (registration.get('user') && registration.get('user').id) ||
      (request.user && request.user.id) ||
      ''
  );
  if (
    typeof createAppMessage === 'function' &&
    participantUserId &&
    participantUserId !== admin.id
  ) {
    await createAppMessage({
      recipientId: admin.id,
      senderId: participantUserId,
      kind: 'profile_presentation_request',
      title: 'Nova solicitacao de participacao',
      body: requestAlert,
      relatedClass: 'EventRegistration',
      relatedId: registration.id,
      actionRoute: `/event/${event.id}`,
    });
  }
});

/** Confirmados efetivos de um evento (para lembrete / remarcacao / cancelamento). */
async function collectConfirmedParticipantUserIdsForEvent(event) {
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });
  const userIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      userIds.push(String(resolved.userId));
    }
  }
  return [...new Set(userIds)];
}

const RESCHEDULE_MIN_DELTA_MS = 15 * 60 * 1000;
const REMINDER_2H_WINDOW_BEFORE_MS = 2 * 60 * 60 * 1000;
const REMINDER_2H_TOLERANCE_MS = 10 * 60 * 1000;

function scheduleChangeSenderId(event, actor) {
  if (actor && actor.id) return String(actor.id);
  const changedBy = event && event.get ? event.get('lastScheduleChangeBy') : null;
  if (changedBy && changedBy.id) return String(changedBy.id);
  const admin = event && event.get ? event.get('admin') : null;
  if (admin && admin.id) return String(admin.id);
  return '';
}

async function notifyEventScheduleOrCancelChange(event, original, actor) {
  if (!original) return;

  const wasFinished = !!original.get('isFinished');
  const isFinished = !!event.get('isFinished');
  const oldStart = original.get('startTime');
  const newStart = event.get('startTime');
  const oldStartMs = oldStart instanceof Date ? oldStart.getTime() : new Date(oldStart || 0).getTime();
  const newStartMs = newStart instanceof Date ? newStart.getTime() : new Date(newStart || 0).getTime();
  const now = Date.now();
  const finishChanged = !wasFinished && isFinished;
  const startChanged =
    !Number.isNaN(oldStartMs) &&
    !Number.isNaN(newStartMs) &&
    Math.abs(newStartMs - oldStartMs) >= RESCHEDULE_MIN_DELTA_MS;

  // Ignora saves auxiliares (ex.: limpar pushReminder2hSentAt) sem mudanca de agenda.
  if (!finishChanged && !startChanged) return;

  let audienceIds = [];
  if (event.get('type') === 'team_match' && typeof collectTeamMatchNotifyUserIds === 'function') {
    try {
      audienceIds = await collectTeamMatchNotifyUserIds(event);
    } catch (error) {
      console.error('collectTeamMatchNotifyUserIds (schedule change) failed', error);
    }
  }
  if (!audienceIds.length) {
    audienceIds = await collectConfirmedParticipantUserIdsForEvent(event);
  }
  if (!audienceIds.length) {
    if (startChanged && event.get('pushReminder2hSentAt')) {
      event.unset('pushReminder2hSentAt');
      await event.save(null, { useMasterKey: true });
    }
    return;
  }

  const eventName = event.get('name') || 'evento';
  const eventId = event.id;
  const peladaPtr = event.get('pelada');
  const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
  const reasonRaw = String(event.get('lastScheduleChangeReason') || '').trim();
  const reasonSuffix = reasonRaw ? ` Motivo: ${reasonRaw.slice(0, 220)}` : '';
  const isTeamMatch = event.get('type') === 'team_match';
  const cancelTitle = isTeamMatch ? 'Confronto cancelado' : 'Evento cancelado';
  const rescheduleTitle = isTeamMatch ? 'Confronto remarcado' : 'Evento remarcado';

  // Cancelamento antecipado: marcado como encerrado antes do horario de inicio.
  if (finishChanged && newStartMs && newStartMs > now) {
    const cancelAlert = `O evento "${eventName}" foi cancelado.${reasonSuffix}`;
    await sendPushToUsers(
      audienceIds,
      {
        title: cancelTitle,
        alert: cancelAlert,
        data: {
          type: 'event_cancelled',
          eventId,
          peladaId,
        },
      },
      { throwOnError: false }
    );
    if (typeof createAppMessages === 'function') {
      await createAppMessages(audienceIds, {
        senderId: scheduleChangeSenderId(event, actor),
        kind: 'event_cancelled',
        title: cancelTitle,
        body: cancelAlert,
        relatedClass: 'Event',
        relatedId: eventId,
        actionRoute: `/event/${eventId}`,
      });
    }
    if (reasonRaw) {
      event.unset('lastScheduleChangeReason');
      try {
        await event.save(null, { useMasterKey: true });
      } catch (error) {
        console.error('clear lastScheduleChangeReason failed', error);
      }
    }
    return;
  }

  if (startChanged) {
    const dateLabel = formatEventPushDate(newStart);
    const alert = dateLabel
      ? `O evento "${eventName}" foi remarcado para ${dateLabel}.${reasonSuffix}`
      : `O evento "${eventName}" teve o horario alterado.${reasonSuffix}`;

    await sendPushToUsers(
      audienceIds,
      {
        title: rescheduleTitle,
        alert,
        data: {
          type: 'event_rescheduled',
          eventId,
          peladaId,
        },
      },
      { throwOnError: false }
    );
    if (typeof createAppMessages === 'function') {
      await createAppMessages(audienceIds, {
        senderId: scheduleChangeSenderId(event, actor),
        kind: 'event_rescheduled',
        title: rescheduleTitle,
        body: alert,
        relatedClass: 'Event',
        relatedId: eventId,
        actionRoute: `/event/${eventId}`,
      });
    }

    if (reasonRaw) {
      event.unset('lastScheduleChangeReason');
      try {
        await event.save(null, { useMasterKey: true });
      } catch (error) {
        console.error('clear lastScheduleChangeReason failed', error);
      }
    }

    // Permite novo lembrete 2h apos remarcacao.
    if (event.get('pushReminder2hSentAt')) {
      event.unset('pushReminder2hSentAt');
      await event.save(null, { useMasterKey: true });
    }
  }
}

Parse.Cloud.afterSave('Event', async (request) => {
  if (!(request.original && request.original.id)) return;
  try {
    await notifyEventScheduleOrCancelChange(request.object, request.original, request.user);
  } catch (error) {
    console.error('notifyEventScheduleOrCancelChange failed', error);
  }
});

function hiringRoleLabel(role) {
  const map = {
    referee: 'juiz',
    scout: 'scout/mesario',
    journalist: 'jornalista',
    cameraman: 'cinegrafista',
    narrator: 'narrador',
    coach: 'treinador',
    physical_trainer: 'preparador fisico',
    masseur: 'massagista',
    kitman: 'roupeiro',
    gandula: 'gandula',
    gatekeeper: 'porteiro',
    athlete: 'atleta',
    fan: 'torcedor',
  };
  return map[String(role || '')] || 'profissional';
}

Parse.Cloud.afterSave('RefereeInvitation', async (request) => {
  try {
    const invitation = request.object;
    const original = request.original;
    const status = String(invitation.get('status') || '');
    const invitedUser = invitation.get('invitedUser');
    const invitedBy = invitation.get('invitedBy');
    const eventPtr = invitation.get('event');
    const peladaPtr = invitation.get('pelada');
    const eventId = eventPtr && eventPtr.id ? eventPtr.id : '';
    const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
    const roleLabel = hiringRoleLabel(invitation.get('role'));

    let eventName = 'evento';
    let eventStartTime = null;
    if (eventId) {
      try {
        const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
        eventName = event.get('name') || eventName;
        eventStartTime = event.get('startTime') || null;
      } catch {
        // mantem padrao
      }
    }
    const eventDateLabel = eventStartTime ? formatEventPushDate(eventStartTime) : '';

    // Novo convite pendente → profissional.
    if (!original) {
      const hiringApproval = invitation.get('refereeHiringApprovalStatus');
      if (hiringApproval === 'pending') {
        return;
      }
      if (status === 'pending' && invitedUser && invitedUser.id) {
        await sendPushToUser(invitedUser.id, {
          title: 'Novo convite de contratacao',
          alert: `Voce foi convidado como ${roleLabel} para "${eventName}".`,
          data: {
            type: 'hiring_invite',
            eventId,
            peladaId,
            invitationId: invitation.id,
          },
        });
        if (typeof createAppMessage === 'function') {
          const offeredAmount = Number(invitation.get('offeredAmount') || 0);
          await createAppMessage({
            recipientId: invitedUser.id,
            senderId: invitedBy && invitedBy.id ? invitedBy.id : '',
            kind: 'hiring_invite',
            title: `Convite de ${roleLabel}`,
            body:
              `Voce foi convidado como ${roleLabel} para "${eventName}"` +
              (eventDateLabel ? ` (${eventDateLabel}).` : '.') +
              (offeredAmount > 0 ? ` Valor oferecido: R$ ${offeredAmount.toFixed(2)}.` : '') +
              ' Aceite ou recuse na Entrada.',
            relatedClass: 'RefereeInvitation',
            relatedId: invitation.id,
            actionRoute: '/inbox',
          });
        }
      }
      return;
    }

    const prevStatus = String(original.get('status') || '');
    if (prevStatus !== 'pending') return;
    if (status !== 'accepted' && status !== 'declined') return;
    if (!invitedBy || !invitedBy.id) return;

    const inviteeName =
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      'O profissional';
    const decisionLabel = status === 'accepted' ? 'aceitou' : 'recusou';

    await sendPushToUser(invitedBy.id, {
      title: 'Resposta ao convite',
      alert: `${inviteeName} ${decisionLabel} o convite de ${roleLabel} em "${eventName}".`,
      data: {
        type: 'hiring_response',
        eventId,
        peladaId,
        invitationId: invitation.id,
        decision: status,
      },
    });

    // Recusa do presidente adversario em confronto ja gera mensagem propria
    // em respondTeamMatchRefereeHiringApproval — nao duplicar aqui.
    const rejectedByOpponent =
      String(invitation.get('refereeHiringApprovalStatus') || '') === 'rejected';
    if (typeof createAppMessage === 'function' && !rejectedByOpponent) {
      await createAppMessage({
        recipientId: invitedBy.id,
        senderId: invitedUser && invitedUser.id ? invitedUser.id : '',
        kind: 'hiring_response',
        title:
          status === 'accepted'
            ? `Contratacao confirmada: ${inviteeName}`
            : `Convite recusado por ${inviteeName}`,
        body:
          `${inviteeName} ${decisionLabel} o convite de ${roleLabel} em "${eventName}"` +
          (eventDateLabel ? ` (${eventDateLabel}).` : '.'),
        relatedClass: 'RefereeInvitation',
        relatedId: invitation.id,
        actionRoute: eventId ? `/event/${eventId}` : '/inbox',
      });
    }
  } catch (error) {
    console.error('RefereeInvitation push failed', error);
  }
});

async function runEventRemindersTwoHoursInternal() {
  const now = Date.now();
  const windowStart = new Date(now + REMINDER_2H_WINDOW_BEFORE_MS - REMINDER_2H_TOLERANCE_MS);
  const windowEnd = new Date(now + REMINDER_2H_WINDOW_BEFORE_MS + REMINDER_2H_TOLERANCE_MS);

  const query = new Parse.Query('Event');
  query.greaterThanOrEqualTo('startTime', windowStart);
  query.lessThanOrEqualTo('startTime', windowEnd);
  query.notEqualTo('isFinished', true);
  query.doesNotExist('pushReminder2hSentAt');
  query.limit(100);
  const events = await query.find({ useMasterKey: true });

  let eventsNotified = 0;
  let devicesMatched = 0;

  for (const event of events) {
    const confirmedIds = await collectConfirmedParticipantUserIdsForEvent(event);
    if (!confirmedIds.length) {
      event.set('pushReminder2hSentAt', new Date());
      await event.save(null, { useMasterKey: true });
      continue;
    }

    const eventName = event.get('name') || 'evento';
    const dateLabel = formatEventPushDate(event.get('startTime'));
    const alert = dateLabel
      ? `Faltam cerca de 2 horas para "${eventName}" (${dateLabel}).`
      : `Faltam cerca de 2 horas para "${eventName}".`;
    const peladaPtr = event.get('pelada');

    const pushResult = await sendPushToUsers(
      confirmedIds,
      {
        title: 'Lembrete de pelada',
        alert,
        data: {
          type: 'event_reminder_2h',
          eventId: event.id,
          peladaId: peladaPtr && peladaPtr.id ? peladaPtr.id : '',
        },
      },
      { throwOnError: false }
    );

    event.set('pushReminder2hSentAt', new Date());
    await event.save(null, { useMasterKey: true });

    eventsNotified += 1;
    devicesMatched += pushResult.devicesMatched || 0;
  }

  return {
    ok: true,
    scanned: events.length,
    eventsNotified,
    devicesMatched,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

Parse.Cloud.define('runEventRemindersTwoHours', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }
  return runEventRemindersTwoHoursInternal();
});

Parse.Cloud.job('sendEventRemindersTwoHoursJob', async () => {
  return runEventRemindersTwoHoursInternal();
});

Parse.Cloud.define('setPushNotificationsEnabled', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const enabled = !!request.params.enabled;
  user.set('pushNotificationsEnabled', enabled);
  await user.save(null, { useMasterKey: true });

  let unlinkedInstallations = 0;
  if (!enabled) {
    unlinkedInstallations = await unlinkAllInstallationsForUser(user.id);
  }

  return { ok: true, enabled, unlinkedInstallations };
});

Parse.Cloud.define('getPushNotificationsEnabled', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  await user.fetch({ useMasterKey: true });
  const enabled = user.get('pushNotificationsEnabled') !== false;
  return { ok: true, enabled };
});

Parse.Cloud.define('registerPushDevice', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  await user.fetch({ useMasterKey: true });
  if (user.get('pushNotificationsEnabled') === false) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Notificacoes desativadas pelo usuario. Ative no menu do app.'
    );
  }

  const deviceToken = String(request.params.deviceToken || '').trim();
  const deviceType = String(request.params.deviceType || 'android').trim();
  const deviceModel = String(request.params.deviceModel || '').trim().slice(0, 80);
  const deviceLabel = String(request.params.deviceLabel || '').trim().slice(0, 120);
  if (!deviceToken) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'deviceToken obrigatorio.');
  }

  let installation = await new Parse.Query(Parse.Installation)
    .equalTo('deviceToken', deviceToken)
    .first({ useMasterKey: true });

  if (!installation) {
    installation = new Parse.Installation();
    installation.set('deviceToken', deviceToken);
  }

  const normalizedType = deviceType === 'ios' ? 'ios' : 'android';
  installation.set('deviceType', normalizedType);
  installation.set('user', user);
  installation.set('userId', user.id);
  installation.set('appIdentifier', PUSH_APP_IDENTIFIER);
  installation.set('appName', 'Controle de Bola');
  installation.set('GCMSenderId', FCM_SENDER_ID);
  if (deviceModel) {
    installation.set('deviceModel', deviceModel);
  }
  if (deviceLabel) {
    installation.set('deviceLabel', deviceLabel);
  }
  // Obrigatorio para o adaptador FCM/GCM do Parse/Back4App entregar no Android.
  if (normalizedType === 'android') {
    installation.set('pushType', 'gcm');
  } else {
    installation.unset('pushType');
  }
  await installation.save(null, { useMasterKey: true });

  // Remove Installations antigas do mesmo usuario (tokens mortos geram falso "N aparelhos").
  const pruned = await pruneOtherInstallationsForUser(user.id, installation.id);

  return {
    ok: true,
    installationId: installation.id,
    deviceTokenPrefix: deviceToken.slice(0, 12),
    prunedOldInstallations: pruned,
  };
});

async function pruneOtherInstallationsForUser(userId, keepInstallationId) {
  if (!userId) return 0;
  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', String(userId));
  const rows = await Parse.Query.or(byPointer, byUserId).limit(100).find({ useMasterKey: true });
  const toDelete = rows.filter((row) => row.id !== keepInstallationId);
  if (!toDelete.length) return 0;
  await Parse.Object.destroyAll(toDelete, { useMasterKey: true });
  return toDelete.length;
}

/** Limpa Installations antigas de um usuario, mantendo so a mais recente. */
Parse.Cloud.define('pruneStalePushInstallationsForUser', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const userId = String(request.params.userId || (request.user && request.user.id) || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }
  if (request.user && !request.master && request.user.id !== userId) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'So pode limpar as proprias instalacoes.');
  }

  const byPointer = new Parse.Query(Parse.Installation);
  byPointer.equalTo('user', Parse.User.createWithoutData(userId));
  const byUserId = new Parse.Query(Parse.Installation);
  byUserId.equalTo('userId', userId);
  const rows = await Parse.Query.or(byPointer, byUserId)
    .descending('updatedAt')
    .limit(100)
    .find({ useMasterKey: true });

  if (!rows.length) {
    return { ok: true, kept: null, deleted: 0 };
  }

  const keep = rows[0];
  const deleted = await pruneOtherInstallationsForUser(userId, keep.id);
  return {
    ok: true,
    kept: {
      objectId: keep.id,
      deviceTokenPrefix: String(keep.get('deviceToken') || '').slice(0, 12),
      updatedAt: keep.updatedAt ? keep.updatedAt.toISOString() : null,
    },
    deleted,
  };
});

Parse.Cloud.define('unregisterPushDevice', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const deviceToken = String(request.params.deviceToken || '').trim();
  if (!deviceToken) {
    return { ok: true };
  }

  const installation = await new Parse.Query(Parse.Installation)
    .equalTo('deviceToken', deviceToken)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (installation) {
    installation.unset('user');
    await installation.save(null, { useMasterKey: true });
  }

  return { ok: true };
});

async function assertCanNotifyEventParticipants(user, event) {
  const admin = event.get('admin');
  if (admin && admin.id === user.id) {
    return;
  }

  const peladaPtr = event.get('pelada');
  if (peladaPtr && peladaPtr.id) {
    try {
      const pelada = await new Parse.Query('Pelada').get(peladaPtr.id, { useMasterKey: true });
      const peladaAdmin = pelada.get('admin');
      if (peladaAdmin && peladaAdmin.id === user.id) {
        return;
      }
    } catch {
      // segue para erro abaixo
    }
  }

  throw new Parse.Error(
    Parse.Error.OPERATION_FORBIDDEN,
    'Apenas o administrador do evento ou da pelada pode enviar esta notificacao.'
  );
}

Parse.Cloud.define('sendEventConfirmedParticipantNotification', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = String(request.params.title || '').trim().slice(0, 120);
  const alert = String(request.params.message || request.params.alert || '').trim().slice(0, 500);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Titulo da notificacao obrigatorio.');
  }
  if (!alert) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Mensagem da notificacao obrigatoria.');
  }

  const event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
  await assertCanNotifyEventParticipants(user, event);

  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  const userIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      userIds.push(String(resolved.userId));
    }
  }

  // Inclui o remetente se ele tambem for participante confirmado (ex.: admin testando no proprio aparelho).
  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) {
    return { ok: true, targetedUsers: 0, devicesMatched: 0, pushBatchesSent: 0 };
  }

  const pushResult = await sendPushToUsers(
    uniqueUserIds,
    {
      title,
      alert,
      data: {
        type: 'event_admin_message',
        eventId,
      },
    },
    { throwOnError: true }
  );

  if (typeof createAppMessages === 'function') {
    await createAppMessages(uniqueUserIds, {
      senderId: user.id,
      kind: 'event_admin_message',
      title,
      body: alert,
      relatedClass: 'Event',
      relatedId: eventId,
      actionRoute: `/event/${eventId}`,
    });
  }

  const focusEmail = String(request.params.focusEmail || '')
    .trim()
    .toLowerCase();
  const focusUserId = String(request.params.focusUserId || '').trim();
  let focus = null;
  if (focusEmail) {
    focus = await buildPushFocusReport(focusEmail, uniqueUserIds);
  } else if (focusUserId) {
    const installations = await buildInstallationQueryForUsers([focusUserId])
      .limit(50)
      .find({ useMasterKey: true });
    focus = {
      userId: focusUserId,
      found: true,
      confirmed: uniqueUserIds.includes(focusUserId),
      hasInstallation: installations.length > 0,
      inMatchedDevices: (pushResult.matchedUserIds || []).includes(focusUserId),
      installations: mapInstallationDiagnostics(installations),
    };
  }

  if (focus && focus.userId) {
    focus.inMatchedDevices = (pushResult.matchedUserIds || []).includes(String(focus.userId));
  }

  return {
    ok: true,
    targetedUsers: pushResult.targetedUsers,
    devicesMatched: pushResult.devicesMatched,
    pushBatchesSent: pushResult.pushBatchesSent,
    senderIncluded: uniqueUserIds.includes(user.id),
    focus,
  };
});

async function findUserByEmailOrPhone(email, phoneRaw) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const phone =
    typeof normalizePhoneForStorage === 'function'
      ? normalizePhoneForStorage(phoneRaw)
      : digitsOnly(phoneRaw);

  let foundUser = null;
  if (normalizedEmail) {
    foundUser = await new Parse.Query(Parse.User)
      .equalTo('email', normalizedEmail)
      .first({ useMasterKey: true });
    if (!foundUser) {
      foundUser = await new Parse.Query(Parse.User)
        .equalTo('username', normalizedEmail)
        .first({ useMasterKey: true });
    }
  }
  if (!foundUser && phone.length >= 10) {
    foundUser = await new Parse.Query(Parse.User)
      .equalTo('phone', phone)
      .first({ useMasterKey: true });
    if (!foundUser) {
      const variants = phoneVariants(phone);
      if (variants.length) {
        foundUser = await new Parse.Query(Parse.User)
          .containedIn('phone', variants)
          .first({ useMasterKey: true });
      }
    }
  }
  return foundUser;
}

function mapInstallationDiagnostics(installations, options = {}) {
  const includeFullToken = !!options.includeFullToken;
  return installations.map((row) => {
    const token = String(row.get('deviceToken') || '');
    return {
      objectId: row.id,
      deviceType: row.get('deviceType') || null,
      deviceModel: row.get('deviceModel') || null,
      deviceLabel: row.get('deviceLabel') || null,
      pushType: row.get('pushType') || null,
      GCMSenderId: row.get('GCMSenderId') || null,
      appIdentifier: row.get('appIdentifier') || null,
      userId: row.get('userId') || (row.get('user') && row.get('user').id) || null,
      hasDeviceToken: !!token,
      deviceTokenPrefix: token.slice(0, 12),
      // Token completo so com Master Key — para teste no Firebase Console (Engage > Messaging).
      deviceToken: includeFullToken ? token || null : undefined,
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    };
  });
}

async function buildPushFocusReport(email, confirmedUserIds) {
  const foundUser = await findUserByEmailOrPhone(email, '');
  if (!foundUser) {
    return {
      email,
      found: false,
      confirmed: false,
      hasInstallation: false,
      installations: [],
    };
  }
  const installations = await buildInstallationQueryForUsers([foundUser.id])
    .limit(50)
    .find({ useMasterKey: true });
  return {
    email,
    found: true,
    userId: foundUser.id,
    confirmed: confirmedUserIds.includes(foundUser.id),
    hasInstallation: installations.length > 0,
    inMatchedDevices: null,
    installations: mapInstallationDiagnostics(installations),
  };
}

/** Diagnostico: localiza usuario por e-mail/telefone e lista Installations com token. */
Parse.Cloud.define('diagnosePushForContact', async (request) => {
  if (!request.user && !request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const email = String(request.params.email || '')
    .trim()
    .toLowerCase();
  const phoneRaw = String(request.params.phone || '').trim();
  const phone =
    typeof normalizePhoneForStorage === 'function'
      ? normalizePhoneForStorage(phoneRaw)
      : digitsOnly(phoneRaw);

  if (!email && phone.length < 10) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe email ou telefone.');
  }

  const foundUser = await findUserByEmailOrPhone(email, phoneRaw);
  if (!foundUser) {
    return { ok: true, found: false, user: null, installations: [] };
  }

  const installations = await buildInstallationQueryForUsers([foundUser.id])
    .limit(50)
    .find({ useMasterKey: true });

  // Token completo apenas com Master Key (teste Firebase Console).
  const includeFullToken = !!request.master;

  return {
    ok: true,
    found: true,
    fcmSenderId: FCM_SENDER_ID,
    androidChannelId: ANDROID_PUSH_CHANNEL_ID,
    user: {
      objectId: foundUser.id,
      email: foundUser.get('email') || null,
      username: foundUser.get('username') || null,
      phone: foundUser.get('phone') || null,
    },
    installations: mapInstallationDiagnostics(installations, { includeFullToken }),
    firebaseTestHint:
      'Firebase Console > Engage > Messaging > Send test message — cole deviceToken do Motorola.',
  };
});

/**
 * Diagnostico do envio por evento: confirma se um e-mail esta na lista de confirmados
 * e se tem Installation (token) ligada — util quando "N aparelhos" nao inclui o alvo real.
 */
Parse.Cloud.define('diagnoseEventPushTargets', async (request) => {
  const user = request.user;
  if (!user && !request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const focusEmail = String(request.params.email || request.params.focusEmail || '')
    .trim()
    .toLowerCase();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
  if (user) {
    await assertCanNotifyEventParticipants(user, event);
  }

  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  const uniqueUserIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      uniqueUserIds.push(String(resolved.userId));
    }
  }
  const confirmedUserIds = [...new Set(uniqueUserIds)];
  const installations = confirmedUserIds.length
    ? await buildInstallationQueryForUsers(confirmedUserIds).limit(1000).find({ useMasterKey: true })
    : [];

  const focus = focusEmail ? await buildPushFocusReport(focusEmail, confirmedUserIds) : null;

  return {
    ok: true,
    eventId,
    confirmedUsers: confirmedUserIds.length,
    devicesMatched: installations.length,
    focus,
  };
});

/** Disparo explicito apos criar evento (nao depende so do afterSave). */
Parse.Cloud.define('notifyNewPeladaEventCreated', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
  await assertCanNotifyEventParticipants(user, event);
  const result = await notifyNewPeladaEvent(event);
  return { ok: true, eventId, ...result };
});

/** Diagnostico: o e-mail entra no publico de "novo evento" e tem Installation? */
Parse.Cloud.define('diagnoseNewPeladaEventPush', async (request) => {
  if (!request.user && !request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login ou chame com Master Key.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const peladaIdParam = String(request.params.peladaId || '').trim();
  const email = String(request.params.email || '').trim().toLowerCase();
  if (!email) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'email obrigatorio.');
  }
  if (!eventId && !peladaIdParam) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe eventId ou peladaId.');
  }

  let event = null;
  let peladaId = peladaIdParam;
  if (eventId) {
    event = await new Parse.Query('Event').include('pelada').get(eventId, { useMasterKey: true });
    const peladaPtr = event.get('pelada');
    peladaId = (peladaPtr && peladaPtr.id) || peladaId;
  }

  const audience = peladaId ? await collectNewPeladaEventAudience(peladaId, eventId) : new Set();
  const adminId = event && event.get('admin') && event.get('admin').id
    ? String(event.get('admin').id)
    : '';
  if (adminId) audience.delete(adminId);

  const focus = await buildPushFocusReport(email, [...audience]);
  const foundUser = focus.found
    ? await findUserByEmailOrPhone(email, '')
    : null;
  const pushEnabled = foundUser ? foundUser.get('pushNotificationsEnabled') !== false : null;

  return {
    ok: true,
    eventId: eventId || null,
    peladaId: peladaId || null,
    audience: audience.size,
    alreadySent: !!(event && event.get('pushNewEventSentAt')),
    focus: {
      ...focus,
      inAudience: !!(focus.userId && audience.has(String(focus.userId))),
      isEventAdmin: !!(focus.userId && adminId && focus.userId === adminId),
      pushEnabled,
    },
  };
});

/** Envia push de teste para o usuario logado (valida FCM + Installation). */
Parse.Cloud.define('sendTestPushToSelf', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pushResult = await sendPushToUsers(
    [user.id],
    {
      title: 'Teste de notificacao',
      alert: 'Se voce leu isto, o Push esta funcionando neste aparelho.',
      data: {
        type: 'push_self_test',
      },
    },
    { throwOnError: true }
  );

  return {
    ok: true,
    userId: user.id,
    targetedUsers: pushResult.targetedUsers,
    devicesMatched: pushResult.devicesMatched,
    pushBatchesSent: pushResult.pushBatchesSent,
  };
});

/** Repara instalacoes Android sem pushType=gcm (necessario para entrega FCM via Back4App). */
Parse.Cloud.define('backfillAndroidPushInstallations', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login ou chame com Master Key.'
    );
  }

  const query = new Parse.Query(Parse.Installation);
  query.equalTo('deviceType', 'android');
  query.exists('deviceToken');
  query.limit(1000);
  const rows = await query.find({ useMasterKey: true });
  const toSave = [];
  for (const row of rows) {
    let dirty = false;
    if (row.get('pushType') !== 'gcm') {
      row.set('pushType', 'gcm');
      dirty = true;
    }
    if (!row.get('GCMSenderId')) {
      row.set('GCMSenderId', FCM_SENDER_ID);
      dirty = true;
    }
    if (!row.get('appIdentifier')) {
      row.set('appIdentifier', PUSH_APP_IDENTIFIER);
      dirty = true;
    }
    const linkedUser = row.get('user');
    if (linkedUser && linkedUser.id && row.get('userId') !== linkedUser.id) {
      row.set('userId', linkedUser.id);
      dirty = true;
    }
    if (dirty) toSave.push(row);
  }
  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
  return { ok: true, scanned: rows.length, updated: toSave.length };
});

Parse.Cloud.define('syncUserAvatarForDisplay', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const avatarUrl = String(request.params.avatarUrl || '').trim();
  if (!avatarUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'avatarUrl obrigatorio.');
  }

  const toSave = [];

  const registrationQuery = new Parse.Query('EventRegistration');
  registrationQuery.equalTo('user', user);
  registrationQuery.limit(1000);
  const registrations = await registrationQuery.find({ useMasterKey: true });
  for (const registration of registrations) {
    if (registration.get('avatarUrl') !== avatarUrl) {
      registration.set('avatarUrl', avatarUrl);
      toSave.push(registration);
    }
  }

  const athleteProfile = await new Parse.Query('AthleteProfile')
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (athleteProfile && athleteProfile.get('userAvatarUrl') !== avatarUrl) {
    athleteProfile.set('userAvatarUrl', avatarUrl);
    toSave.push(athleteProfile);
  }

  const roleProfiles = await new Parse.Query('RoleProfile')
    .equalTo('user', user)
    .limit(50)
    .find({ useMasterKey: true });
  for (const profile of roleProfiles) {
    if (profile.get('userAvatarUrl') !== avatarUrl) {
      profile.set('userAvatarUrl', avatarUrl);
      toSave.push(profile);
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return { ok: true, updated: toSave.length };
});

// --- 04-auth-signup.js ---

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

  const cpfInput = String(params.cpf || '').trim();
  const normalizedCpf = normalizeCpfDigits(cpfInput);
  if (!isValidCpf(normalizedCpf)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um CPF valido.');
  }

  const normalizedPhone = phoneInput ? normalizePhoneForStorage(phoneInput) : '';
  const username = resolveUsernameFromContact(emailInput, normalizedPhone);
  if (!username) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um e-mail valido.');
  }

  await assertContactAvailable({
    username,
    email: emailInput || undefined,
    phone: normalizedPhone || undefined,
    cpf: normalizedCpf,
  });

  const user = new Parse.User();
  user.set('username', username);
  user.set('password', password);
  user.set('name', name);
  user.set('apelido', apelido);
  user.set('address', address);
  user.set('cpf', normalizedCpf);

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
  if (!request.master) {
    const locked = [
      'passwordResetOtpHash',
      'passwordResetExpiresAt',
      'passwordResetRequestedAt',
      'passwordResetFailCount',
      'passwordResetHourStartedAt',
      'passwordResetHourCount',
      'contactMessageRequestedAt',
      'contactMessageHourStartedAt',
      'contactMessageHourCount',
      'cpf',
    ];
    for (const key of locked) {
      if (key === 'cpf' && request.object.isNew()) {
        continue;
      }
      if (request.object.dirty(key)) {
        request.object.revert(key);
      }
    }
  }

  if (!request.object.isNew()) {
    return;
  }

  const cpf = normalizeCpfDigits(request.object.get('cpf'));
  if (!isValidCpf(cpf)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um CPF valido.');
  }
  request.object.set('cpf', cpf);
  await assertContactAvailable({ cpf });

  await validateNewUserSignupAntiBot(request.object, request.ip);
});

// --- 05-legends.js ---

/** Legendas amadoras e profissionais */

/** Legendas amadoras e profissionais */

const LEGEND_ATHLETE_RELATIONSHIPS = ['pai', 'filho', 'irmao', 'amigo', 'admirador'];
const LEGEND_TEAM_RELATIONSHIPS = ['ex_atleta', 'presidente', 'diretor', 'torcedor', 'amigo', 'admirador'];

function legendPublicAcl(user) {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  if (user) {
    acl.setWriteAccess(user, true);
  }
  return acl;
}

function parseOptionalDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapLegendAthleteRow(row) {
  const registeredBy = row.get('registeredByUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    address: row.get('address') || undefined,
    birthDate: row.get('birthDate') ? row.get('birthDate').toISOString() : undefined,
    careerEndYear: row.get('careerEndYear') ?? undefined,
    amateurTeams: row.get('amateurTeams') || [],
    position: row.get('position') || undefined,
    inMemoriam: !!row.get('inMemoriam'),
    memorialDate: row.get('memorialDate') ? row.get('memorialDate').toISOString() : undefined,
    relationship: row.get('relationship') || 'admirador',
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

function mapLegendTeamRow(row) {
  const registeredBy = row.get('registeredByUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    location: row.get('location') || undefined,
    foundedDate: row.get('foundedDate') ? row.get('foundedDate').toISOString() : undefined,
    endedDate: row.get('endedDate') ? row.get('endedDate').toISOString() : undefined,
    description: row.get('description') || undefined,
    relationship: row.get('relationship') || 'admirador',
    athleteRefs: row.get('athleteRefs') || [],
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

function normalizeLegendSearch(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function legendHaystack(parts) {
  return normalizeLegendSearch(parts.filter(Boolean).join(' '));
}

async function findExistingLegendByName(className, name, apelido) {
  const needles = [normalizeLegendSearch(name), normalizeLegendSearch(apelido)].filter(
    (value) => value.length >= 2
  );
  if (!needles.length) return null;
  const rows = await new Parse.Query(className).limit(200).find({ useMasterKey: true });
  return (
    rows.find((row) => {
      const names = [normalizeLegendSearch(row.get('name')), normalizeLegendSearch(row.get('apelido'))];
      return needles.some((needle) => names.includes(needle));
    }) || null
  );
}

Parse.Cloud.define('createAmateurLegendAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome da lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido da lenda.');
  }
  if (!LEGEND_ATHLETE_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com a lenda invalida.');
  }

  const existingAthlete = await findExistingLegendByName('AmateurLegendAthlete', name, apelido);
  if (existingAthlete) {
    const label = existingAthlete.get('apelido') || existingAthlete.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe a lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  const row = new Parse.Object('AmateurLegendAthlete');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('amateurTeams', Array.isArray(request.params.amateurTeams) ? request.params.amateurTeams.map(String) : []);
  row.set('inMemoriam', !!request.params.inMemoriam);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.address) row.set('address', request.params.address);
  if (request.params.position) row.set('position', String(request.params.position).trim());
  if (request.params.careerEndYear != null) row.set('careerEndYear', Number(request.params.careerEndYear));

  const birthDate = parseOptionalDate(request.params.birthDate);
  if (birthDate) row.set('birthDate', birthDate);

  const memorialDate = parseOptionalDate(request.params.memorialDate);
  if (memorialDate) row.set('memorialDate', memorialDate);

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  return mapLegendAthleteRow(row);
});

Parse.Cloud.define('createAmateurLegendTeam', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome do time lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido do time lenda.');
  }
  if (!LEGEND_TEAM_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com o time lenda invalida.');
  }

  const existingTeam = await findExistingLegendByName('AmateurLegendTeam', name, apelido);
  if (existingTeam) {
    const label = existingTeam.get('apelido') || existingTeam.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe o time lenda "${label}". Use o cadastro existente em Lendas.`
    );
  }

  const row = new Parse.Object('AmateurLegendTeam');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('athleteRefs', Array.isArray(request.params.athleteRefs) ? request.params.athleteRefs : []);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.location) row.set('location', request.params.location);
  if (request.params.description) row.set('description', String(request.params.description).trim());

  const foundedDate = parseOptionalDate(request.params.foundedDate);
  if (foundedDate) row.set('foundedDate', foundedDate);
  const endedDate = parseOptionalDate(request.params.endedDate);
  if (endedDate) row.set('endedDate', endedDate);

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  return mapLegendTeamRow(row);
});

Parse.Cloud.define('listAmateurLegendAthletes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('AmateurLegendAthlete');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapLegendAthleteRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, ...(row.amateurTeams || [])]).includes(search);
    });
});

Parse.Cloud.define('listAmateurLegendTeams', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('AmateurLegendTeam');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapLegendTeamRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, row.description]).includes(search);
    });
});

Parse.Cloud.define('getAmateurLegendAthlete', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('AmateurLegendAthlete').get(id, { useMasterKey: true });
  return mapLegendAthleteRow(row);
});

Parse.Cloud.define('getAmateurLegendTeam', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('AmateurLegendTeam').get(id, { useMasterKey: true });
  return mapLegendTeamRow(row);
});

Parse.Cloud.define('suggestAmateurFootballIdols', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const fetchLimit = search ? 200 : limit;
  const legendQuery = new Parse.Query('AmateurLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(fetchLimit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    pushSuggestion({
      id: row.id,
      label: row.get('apelido') || row.get('name'),
      subtitle: row.get('name'),
      source: 'legend_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
    if (suggestions.length >= limit) break;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(fetchLimit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser) continue;
    const fullUser = profileUser.id
      ? await new Parse.Query(Parse.User).get(profileUser.id, { useMasterKey: true }).catch(() => null)
      : null;
    const apelido = fullUser?.get('apelido') || fullUser?.get('name') || 'Atleta';
    pushSuggestion({
      id: fullUser?.id || profile.id,
      label: apelido,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser?.get('avatarUrl') || undefined,
    });
    if (suggestions.length >= limit * 2) break;
  }

  return suggestions.slice(0, limit);
});

function mapProLegendAthleteRow(row) {
  const registeredBy = row.get('registeredByUser');
  return {
    id: row.id,
    name: row.get('name') || '',
    apelido: row.get('apelido') || '',
    imageUrl: row.get('imageUrl') || undefined,
    address: row.get('address') || undefined,
    birthDate: row.get('birthDate') ? row.get('birthDate').toISOString() : undefined,
    careerEndYear: row.get('careerEndYear') ?? undefined,
    proTeams: row.get('proTeams') || [],
    position: row.get('position') || undefined,
    inMemoriam: !!row.get('inMemoriam'),
    memorialDate: row.get('memorialDate') ? row.get('memorialDate').toISOString() : undefined,
    relationship: row.get('relationship') || 'admirador',
    registeredByUserId: registeredBy ? registeredBy.id : undefined,
    registeredByName: row.get('registeredByName') || undefined,
    registeredAt: row.get('registeredAt') ? row.get('registeredAt').toISOString() : undefined,
  };
}

Parse.Cloud.define('createProLegendAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const name = String(request.params.name || '').trim();
  const apelido = String(request.params.apelido || '').trim();
  const relationship = String(request.params.relationship || '').trim();

  if (name.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o nome da lenda.');
  }
  if (apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o apelido da lenda.');
  }
  if (!LEGEND_ATHLETE_RELATIONSHIPS.includes(relationship)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Relacao com a lenda invalida.');
  }

  const existingPro = await findExistingLegendByName('ProLegendAthlete', name, apelido);
  if (existingPro) {
    const label = existingPro.get('apelido') || existingPro.get('name');
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Ja existe a lenda profissional "${label}". Use o cadastro existente.`
    );
  }

  const row = new Parse.Object('ProLegendAthlete');
  row.set('name', name);
  row.set('apelido', apelido);
  row.set('relationship', relationship);
  row.set('proTeams', Array.isArray(request.params.proTeams) ? request.params.proTeams.map(String) : []);
  row.set('inMemoriam', !!request.params.inMemoriam);
  row.set('registeredByUser', user);
  row.set('registeredByName', user.get('apelido') || user.get('name') || user.getUsername());
  row.set('registeredAt', new Date());

  if (request.params.imageUrl) row.set('imageUrl', String(request.params.imageUrl));
  if (request.params.address) row.set('address', request.params.address);
  if (request.params.position) row.set('position', String(request.params.position).trim());
  if (request.params.careerEndYear != null) row.set('careerEndYear', Number(request.params.careerEndYear));

  const birthDate = parseOptionalDate(request.params.birthDate);
  if (birthDate) row.set('birthDate', birthDate);

  const memorialDate = parseOptionalDate(request.params.memorialDate);
  if (memorialDate) row.set('memorialDate', memorialDate);

  row.setACL(legendPublicAcl(user));
  await row.save(null, { useMasterKey: true });
  return mapProLegendAthleteRow(row);
});

Parse.Cloud.define('listProLegendAthletes', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const query = new Parse.Query('ProLegendAthlete');
  query.descending('createdAt');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows
    .map(mapProLegendAthleteRow)
    .filter((row) => {
      if (!search) return true;
      return legendHaystack([row.name, row.apelido, ...(row.proTeams || [])]).includes(search);
    });
});

Parse.Cloud.define('getProLegendAthlete', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const id = String(request.params.id || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'id obrigatorio.');
  }
  const row = await new Parse.Query('ProLegendAthlete').get(id, { useMasterKey: true });
  return mapProLegendAthleteRow(row);
});

Parse.Cloud.define('suggestProFootballIdols', async (request) => {
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  const fetchLimit = search ? 200 : limit;
  const legendQuery = new Parse.Query('ProLegendAthlete');
  legendQuery.descending('createdAt');
  legendQuery.limit(fetchLimit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    pushSuggestion({
      id: row.id,
      label: row.get('apelido') || row.get('name'),
      subtitle: row.get('name'),
      source: 'legend_pro_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
    if (suggestions.length >= limit) break;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(fetchLimit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser) continue;
    const fullUser = profileUser.id
      ? await new Parse.Query(Parse.User).get(profileUser.id, { useMasterKey: true }).catch(() => null)
      : null;
    const apelido = fullUser?.get('apelido') || fullUser?.get('name') || 'Atleta';
    pushSuggestion({
      id: fullUser?.id || profile.id,
      label: apelido,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser?.get('avatarUrl') || undefined,
    });
    if (suggestions.length >= limit * 2) break;
  }

  return suggestions.slice(0, limit);
});

function amateurTeamImageUrl(row) {
  const direct = String(row.get('teamImageUrl') || '').trim();
  if (direct) return direct;
  const file = row.get('teamImage');
  if (file && typeof file.url === 'function') {
    try {
      return file.url() || undefined;
    } catch {
      return undefined;
    }
  }
  if (file && file._url) return file._url;
  return undefined;
}

function matchesLegendSearch(haystack, search) {
  if (!search) return true;
  return normalizeLegendSearch(haystack).includes(search);
}

Parse.Cloud.define('suggestFavoritePeladaTeams', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];
  const seen = new Set();

  function pushSuggestion(item) {
    const key = `${item.source}:${item.id}:${String(item.label || '')
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) return;
    if (!matchesLegendSearch(`${item.label} ${item.subtitle || ''}`, search)) return;
    seen.add(key);
    suggestions.push(item);
  }

  // Prioriza cadastro de Times Amadores (AmateurTeam), com varredura ampla por nome.
  const amateurTeamQuery = new Parse.Query('AmateurTeam');
  amateurTeamQuery.ascending('name');
  amateurTeamQuery.limit(500);
  for (const row of await amateurTeamQuery.find({ useMasterKey: true })) {
    const name = String(row.get('name') || '').trim();
    if (!name) continue;
    pushSuggestion({
      id: row.id,
      label: name,
      subtitle: 'Time amador no app',
      source: 'app_team',
      imageUrl: amateurTeamImageUrl(row),
    });
  }

  const legendTeamQuery = new Parse.Query('AmateurLegendTeam');
  legendTeamQuery.descending('createdAt');
  legendTeamQuery.limit(500);
  for (const row of await legendTeamQuery.find({ useMasterKey: true })) {
    const label = String(row.get('apelido') || row.get('name') || '').trim();
    if (!label) continue;
    pushSuggestion({
      id: row.id,
      label,
      subtitle: 'Time lenda',
      source: 'legend_team',
      imageUrl: row.get('imageUrl') || undefined,
    });
  }

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.exists('favoritePeladaTeam');
  fanQuery.limit(500);
  for (const row of await fanQuery.find({ useMasterKey: true })) {
    const label = String(row.get('favoritePeladaTeam') || '').trim();
    if (!label) continue;
    pushSuggestion({
      id: label,
      label,
      subtitle: 'Time citado por torcedores',
      source: 'pelada_team_text',
    });
  }

  // Tambem considera favoriteAmateurTeam ja gravado em usuarios (cadastros livres).
  if (search) {
    const userTeamQuery = new Parse.Query(Parse.User);
    userTeamQuery.exists('favoriteAmateurTeam');
    userTeamQuery.limit(500);
    for (const user of await userTeamQuery.find({ useMasterKey: true })) {
      const label = String(user.get('favoriteAmateurTeam') || '').trim();
      if (!label) continue;
      pushSuggestion({
        id: `user-team:${label.toLowerCase()}`,
        label,
        subtitle: 'Time amador citado no app',
        source: 'pelada_team_text',
      });
    }
  }

  return suggestions.slice(0, limit);
});

Parse.Cloud.define('searchLegendAthleteRefs', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const limit = Math.min(Math.max(Number(request.params.limit) || 20, 1), 50);
  const suggestions = [];

  const legendQuery = new Parse.Query('AmateurLegendAthlete');
  legendQuery.limit(limit);
  for (const row of await legendQuery.find({ useMasterKey: true })) {
    const label = row.get('apelido') || row.get('name');
    if (search && !`${label} ${row.get('name')}`.toLowerCase().includes(search)) continue;
    suggestions.push({
      id: row.id,
      label,
      subtitle: 'Lenda cadastrada',
      source: 'legend_athlete',
      imageUrl: row.get('imageUrl') || undefined,
    });
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.include('user');
  athleteQuery.limit(limit);
  for (const profile of await athleteQuery.find({ useMasterKey: true })) {
    const profileUser = profile.get('user');
    if (!profileUser?.id) continue;
    const fullUser = await new Parse.Query(Parse.User)
      .get(profileUser.id, { useMasterKey: true })
      .catch(() => null);
    if (!fullUser) continue;
    const label = fullUser.get('apelido') || fullUser.get('name') || 'Atleta';
    if (search && !label.toLowerCase().includes(search)) continue;
    suggestions.push({
      id: fullUser.id,
      label,
      subtitle: 'Atleta no app',
      source: 'app_athlete',
      imageUrl: fullUser.get('avatarUrl') || undefined,
    });
  }

  return suggestions.slice(0, limit);
});

function locationProximityScoreForLegend(addressA, addressB) {
  const normalize = (value) => String(value || '').trim().toLowerCase();
  const stateA = normalize(addressA && addressA.state);
  const stateB = normalize(addressB && addressB.state);
  const cityA = normalize(addressA && addressA.city);
  const cityB = normalize(addressB && addressB.city);
  const neighborhoodA = normalize(addressA && addressA.neighborhood);
  const neighborhoodB = normalize(addressB && addressB.neighborhood);
  let score = 0;
  if (stateA && stateB && stateA === stateB) score += 1;
  if (cityA && cityB && cityA === cityB) score += 3;
  if (neighborhoodA && neighborhoodB && neighborhoodA === neighborhoodB) score += 5;
  return score;
}

Parse.Cloud.define('listAmateurTeamsForLegend', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const search = normalizeLegendSearch(request.params.search);
  const address = request.params.address && typeof request.params.address === 'object'
    ? request.params.address
    : {};
  const limit = Math.min(Math.max(Number(request.params.limit) || 50, 1), 100);

  const rows = await new Parse.Query('AmateurTeam').limit(200).find({ useMasterKey: true });
  const results = [];

  for (const row of rows) {
    const name = String(row.get('name') || '').trim();
    if (!name) continue;
    if (search && !normalizeLegendSearch(name).includes(search)) continue;

    let presidentAddress = {};
    const president = row.get('president');
    if (president && president.id) {
      try {
        const user = await new Parse.Query(Parse.User).get(president.id, { useMasterKey: true });
        presidentAddress = user.get('address') || {};
      } catch {
        presidentAddress = {};
      }
    }

    const teamImage = row.get('teamImage');
    let averageAge = null;
    try {
      if (typeof amateurTeamAverageAge === 'function') {
        averageAge = await amateurTeamAverageAge(row.id);
      }
    } catch {
      averageAge = null;
    }
    results.push({
      id: row.id,
      name,
      imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
      averageAge,
      proximityScore: locationProximityScoreForLegend(address, presidentAddress),
    });
  }

  results.sort(
    (a, b) =>
      b.proximityScore - a.proximityScore || a.name.localeCompare(b.name, 'pt-BR')
  );
  return results.slice(0, limit).map(({ proximityScore, ...item }) => item);
});

// --- 06-gate-tickets.js ---

/** Controle de portaria e ingressos */

function isEventGateTicketControlEnabled(event) {
  return !!event.get('gateTicketControlEnabled');
}

function generateGateTicketToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function buildGateTicketQrPayload(eventId, registrationId, token) {
  return JSON.stringify({ eventId, registrationId, token, v: 1 });
}

function formatEventLocation(event) {
  const address = event.get('address') || {};
  const parts = [address.street, address.neighborhood, address.city, address.state].filter(Boolean);
  let text = parts.join(', ');
  const complement = String(event.get('locationComplement') || '').trim();
  if (complement) {
    text = text ? `${text} — ${complement}` : complement;
  }
  return text || 'Local a definir';
}

async function resolveGateTicketAdminDisplay(adminUser, event) {
  const admin = adminUser || event.get('admin');
  if (!admin || !admin.id) {
    return { adminId: '', adminName: 'Administrador', adminAvatarUrl: undefined };
  }
  let user = admin;
  if (!admin.get) {
    user = await new Parse.Query(Parse.User).get(admin.id, { useMasterKey: true });
  }
  const adminName =
    (user.get('apelido') || '').trim() ||
    (user.get('name') || '').trim() ||
    user.getUsername() ||
    'Administrador';
  return {
    adminId: user.id,
    adminName,
    adminAvatarUrl:
      resolveStoredAvatarUrl(user, null) ||
      String(event.get('adminAvatarUrl') || '').trim() ||
      undefined,
  };
}

function mapGateTicketResponse(registration, event, adminDisplay) {
  const token = registration.get('gateTicketToken');
  const cancelledAt = registration.get('gateTicketCancelledAt');
  const active = !!token && !cancelledAt;
  return {
    registrationId: registration.id,
    eventId: event.id,
    participantName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    participantApelido: registration.get('apelido') || registration.get('userApelido') || '',
    eventName: event.get('name') || 'Evento',
    eventStartTime: event.get('startTime') ? event.get('startTime').toISOString() : '',
    eventEndTime: event.get('endTime') ? event.get('endTime').toISOString() : '',
    eventLocation: formatEventLocation(event),
    authorizedByAdminId: registration.get('gateTicketAuthorizedByAdminId') || adminDisplay.adminId,
    authorizedByAdminName: adminDisplay.adminName,
    authorizedByAdminAvatarUrl: adminDisplay.adminAvatarUrl,
    qrPayload: active ? buildGateTicketQrPayload(event.id, registration.id, token) : '',
    issuedAt: registration.get('gateTicketIssuedAt')
      ? registration.get('gateTicketIssuedAt').toISOString()
      : undefined,
    cancelledAt: cancelledAt ? cancelledAt.toISOString() : undefined,
    entryAt: registration.get('gateTicketEntryAt')
      ? registration.get('gateTicketEntryAt').toISOString()
      : undefined,
    active,
  };
}

async function maybeIssueGateTicketForRegistration(registration, event, adminUser) {
  if (!isEventGateTicketControlEnabled(event)) return registration;
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) return registration;
  if (registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt')) {
    return registration;
  }
  const adminDisplay = await resolveGateTicketAdminDisplay(adminUser, event);
  registration.set('gateTicketToken', generateGateTicketToken());
  registration.set('gateTicketIssuedAt', new Date());
  registration.unset('gateTicketCancelledAt');
  registration.unset('gateTicketEntryAt');
  if (adminDisplay.adminId) {
    registration.set('gateTicketAuthorizedByAdminId', adminDisplay.adminId);
  }
  await registration.save(null, { useMasterKey: true });
  return registration;
}

async function assertGatekeeperOrEventAdmin(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (admin && admin.id === user.id) {
    return event;
  }
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'gatekeeper')
    .first({ useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);
  if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas administrador ou porteiro confirmado pode usar este recurso.'
    );
  }
  return event;
}

Parse.Cloud.define('getMyEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  const event = await new Parse.Query('Event').include('admin').get(eventId, { useMasterKey: true });
  if (!isEventGateTicketControlEnabled(event)) return null;

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (!registration) return null;

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) return null;

  if (!registration.get('gateTicketToken') || registration.get('gateTicketCancelledAt')) {
    await maybeIssueGateTicketForRegistration(registration, event, event.get('admin'));
    await registration.fetch({ useMasterKey: true });
  }
  if (!registration.get('gateTicketToken') || registration.get('gateTicketCancelledAt')) return null;

  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
});

async function handleIssueEventGateTicket(request) {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  const event = await assertEventAdmin(user, eventId);
  if (!isEventGateTicketControlEnabled(event)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Controle de ingresso nao esta ativo neste evento.');
  }
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Participante ainda nao esta confirmado para receber ingresso.'
    );
  }
  await maybeIssueGateTicketForRegistration(registration, event, user);
  const adminDisplay = await resolveGateTicketAdminDisplay(user, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
}

Parse.Cloud.define('issueEventGateTicket', handleIssueEventGateTicket);
// Compatibilidade: versao antiga do Cloud Code usava este nome com typo.
Parse.Cloud.define('issueEventGateTickect', handleIssueEventGateTicket);

Parse.Cloud.define('cancelEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  const event = await assertEventAdmin(user, eventId);
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }
  registration.set('gateTicketCancelledAt', new Date());
  registration.unset('gateTicketEntryAt');
  await registration.save(null, { useMasterKey: true });
  const adminDisplay = await resolveGateTicketAdminDisplay(user, event);
  return mapGateTicketResponse(registration, event, adminDisplay);
});

Parse.Cloud.define('validateEventGateTicket', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const qrPayload = String(request.params.qrPayload || '').trim();
  if (!eventId || !qrPayload) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e qrPayload obrigatorios.');
  }
  const event = await assertGatekeeperOrEventAdmin(user, eventId);
  if (!isEventGateTicketControlEnabled(event)) {
    return { valid: false, message: 'Controle de ingresso nao esta ativo neste evento.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(qrPayload);
  } catch {
    return { valid: false, message: 'QR-Code invalido.' };
  }
  if (!parsed || parsed.eventId !== eventId || !parsed.registrationId || !parsed.token) {
    return { valid: false, message: 'Ingresso nao pertence a este evento.' };
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', String(parsed.registrationId))
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!registration) {
    return { valid: false, message: 'Ingresso nao encontrado.' };
  }
  if (registration.get('gateTicketCancelledAt')) {
    return { valid: false, message: 'Ingresso cancelado.' };
  }
  if (String(registration.get('gateTicketToken') || '') !== String(parsed.token)) {
    return { valid: false, message: 'Ingresso invalido.' };
  }

  const now = new Date();
  if (event.get('endTime') && now > event.get('endTime')) {
    return { valid: false, message: 'Ingresso expirado.' };
  }

  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  if (registration.get('gateTicketEntryAt')) {
    return {
      valid: true,
      alreadyEntered: true,
      message: 'Participante ja ingressou.',
      participantName: registration.get('userDisplayName') || registration.get('apelido') || 'Participante',
      participantApelido: registration.get('apelido') || '',
      entryAt: registration.get('gateTicketEntryAt').toISOString(),
      authorizedByAdminName: adminDisplay.adminName,
    };
  }

  registration.set('gateTicketEntryAt', now);
  await registration.save(null, { useMasterKey: true });
  return {
    valid: true,
    message: 'Entrada autorizada.',
    participantName: registration.get('userDisplayName') || registration.get('apelido') || 'Participante',
    participantApelido: registration.get('apelido') || '',
    entryAt: now.toISOString(),
    authorizedByAdminName: adminDisplay.adminName,
  };
});

Parse.Cloud.define('listEventGateEntries', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  const event = await assertGatekeeperOrEventAdmin(user, eventId);
  const adminDisplay = await resolveGateTicketAdminDisplay(null, event);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .exists('gateTicketEntryAt')
    .ascending('gateTicketEntryAt')
    .limit(500)
    .find({ useMasterKey: true });

  return registrations.map((registration) => ({
    registrationId: registration.id,
    participantName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    participantApelido: registration.get('apelido') || registration.get('userApelido') || '',
    role: registration.get('role') || 'athlete',
    entryAt: registration.get('gateTicketEntryAt').toISOString(),
    authorizedByAdminName: adminDisplay.adminName,
  }));
});

Parse.Cloud.afterSave('EventRegistration', async (request) => {
  const registration = request.object;
  const eventPtr = registration.get('event');
  if (!eventPtr || !eventPtr.id) return;

  let event;
  try {
    event = await new Parse.Query('Event').get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }
  if (!isEventGateTicketControlEnabled(event)) return;

  const participationFee = Number(event.get('participationFee') || 0);
  const wasConfirmed = request.original
    ? computeRegistrationEffectiveConfirmation(request.original, participationFee)
    : false;
  const isConfirmed = computeRegistrationEffectiveConfirmation(registration, participationFee);
  if (!isConfirmed || wasConfirmed) return;
  if (registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt')) return;

  await maybeIssueGateTicketForRegistration(registration, event, event.get('admin'));
});

// Jobs para executar manualmente em: Cloud Code → Jobs → All Jobs → Run
Parse.Cloud.job('configureMuralClassPermissionsJob', async () => {
  return Parse.Cloud.run('configureMuralClassPermissions', {}, { useMasterKey: true });
});

Parse.Cloud.job('backfillEventMuralVoteSnapshotsJob', async (request) => {
  const eventId = request.params && request.params.eventId ? String(request.params.eventId) : '';
  return Parse.Cloud.run(
    'backfillEventMuralVoteSnapshots',
    eventId ? { eventId } : {},
    { useMasterKey: true }
  );
});

// --- 07-mural.js ---

/** Mural — votos, rankings, dashboards, perfis e analytics */

// Motor de votos e rankings
const MURAL_TARGET_ROLES = [
  'athlete',
  'goalkeeper',
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'fan',
  'gatekeeper',
];

function isGoalkeeperPosition(position) {
  return String(position || '').trim().toLowerCase() === 'goleiro';
}

async function loadGoalkeeperUserIdsForMuralScope(scope, scopeId) {
  const ids = new Set();

  async function addFromEventRegistrations(eventIds) {
    for (const eventId of eventIds) {
      const event = Parse.Object.extend('Event').createWithoutData(eventId);
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('athlete')
        .limit(500)
        .find({ useMasterKey: true });

      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;

        const role = registration.get('role') || 'athlete';
        const athlete = registration.get('athlete');
        const position =
          registration.get('primaryPosition') ||
          (athlete && athlete.get ? athlete.get('primaryPosition') : '');
        if (role === 'goalkeeper' || (role === 'athlete' && isGoalkeeperPosition(position))) {
          ids.add(String(resolved.userId));
        }
      }
    }
  }

  if (scope === 'event' && scopeId) {
    await addFromEventRegistrations([scopeId]);
    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    const eventIds = events.map((event) => event.id).filter(Boolean);
    await addFromEventRegistrations(eventIds);
    return ids;
  }

  const profiles = await new Parse.Query('AthleteProfile').limit(5000).find({ useMasterKey: true });
  for (const profile of profiles) {
    if (!isGoalkeeperPosition(profile.get('primaryPosition'))) continue;
    const user = profile.get('user');
    if (user && user.id) ids.add(String(user.id));
  }

  return ids;
}

function normalizeVoteRowTargetRole(voteRow, goalkeeperUserIds) {
  const role = voteRow.targetRole || 'athlete';
  if (role === 'athlete' && goalkeeperUserIds.has(voteRow.targetUserId)) {
    return { ...voteRow, targetRole: 'goalkeeper' };
  }
  return voteRow;
}

/** Uma nota por usuario (voter) por alvo/papel/periodo — evita contagem por perfil duplicado. */
function dedupeMuralVoteRowsByVoter(voteRows) {
  const byKey = new Map();
  for (const vote of voteRows) {
    if (!vote.targetUserId) continue;
    const voterKey = vote.voterId || `anon:${vote.targetUserId}:${vote.score}`;
    const key = `${voterKey}|${vote.targetUserId}|${vote.targetRole || 'athlete'}|${vote.period || ''}`;
    byKey.set(key, vote);
  }
  return Array.from(byKey.values());
}

/** Confrontos (team_match) pesam 3x em votacao/pontuacao agregada do mural. */
const TEAM_MATCH_MURAL_WEIGHT = 3;

async function attachTeamMatchVoteWeights(voteRows) {
  const eventIds = [
    ...new Set(
      voteRows
        .map((vote) => String(vote.scopeId || '').trim())
        .filter(Boolean)
    ),
  ];
  if (!eventIds.length) return voteRows;
  const typeById = new Map();
  const chunkSize = 50;
  for (let i = 0; i < eventIds.length; i += chunkSize) {
    const chunk = eventIds.slice(i, i + chunkSize);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }
  for (const vote of voteRows) {
    const type = typeById.get(String(vote.scopeId || '')) || '';
    const weight = type === 'team_match' ? TEAM_MATCH_MURAL_WEIGHT : 1;
    vote.scoreWeight = weight;
    vote.weightedScore = Number(vote.score || 0) * weight;
  }
  return voteRows;
}

async function mapMuralVoteRowsForScope(scope, scopeId, locationFilter) {
  const goalkeeperUserIds = await loadGoalkeeperUserIdsForMuralScope(scope, scopeId);
  const rawVotes = await loadMuralVoteRows(scope, scopeId, locationFilter);
  const mapped = rawVotes.map((vote) =>
    normalizeVoteRowTargetRole(mapVoteRow(vote), goalkeeperUserIds)
  );
  const deduped = dedupeMuralVoteRowsByVoter(mapped);
  if (scope === 'event') return deduped;
  return attachTeamMatchVoteWeights(deduped);
}

function assertEventVotingWindowOpen(event) {
  const startTime = event.get('startTime');
  const opensAt = event.get('votingOpensAt') || startTime;
  let closesAt = event.get('votingClosesAt');
  if (!closesAt && startTime) {
    closesAt = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
  }
  const now = new Date();
  if (opensAt && now < opensAt) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'A votacao ainda nao esta aberta.');
  }
  if (closesAt && now >= closesAt) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'A votacao deste evento ja encerrou.');
  }
}

function computePerformanceScoreFromRow(perf) {
  const points = Number(perf.get('points') || 0);
  const goals = Number(perf.get('goals') || 0);
  const assists = Number(perf.get('assists') || 0);
  const saves = Number(perf.get('saves') || 0);
  const yellowCards = Number(perf.get('yellowCards') || 0);
  const redCards = Number(perf.get('redCards') || 0);
  return points + goals * 3 + assists * 2 + saves * 2 - yellowCards - redCards * 3;
}

async function loadMuralVoteRows(scope, scopeId, locationFilter) {
  if (scope === 'app') {
    if (locationFilter && locationFilter.active) {
      const eventIds = await loadMuralLocationEventIds(locationFilter);
      return loadMuralVoteRowsForEventIds(eventIds);
    }
    const query = new Parse.Query('MuralVote');
    query.include(['targetUser', 'voter']);
    query.limit(10000);
    return query.find({ useMasterKey: true });
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    const eventIds = events.map((event) => event.id).filter(Boolean);

    const peladaVoteQuery = new Parse.Query('MuralVote');
    peladaVoteQuery.equalTo('scope', 'pelada');
    peladaVoteQuery.equalTo('scopeId', scopeId);

    const queries = [peladaVoteQuery];
    if (eventIds.length) {
      const eventVoteQuery = new Parse.Query('MuralVote');
      eventVoteQuery.equalTo('scope', 'event');
      eventVoteQuery.containedIn('scopeId', eventIds);
      queries.push(eventVoteQuery);
    }

    const combined = Parse.Query.or(...queries);
    combined.include(['targetUser', 'voter']);
    combined.limit(3000);
    return combined.find({ useMasterKey: true });
  }

  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', scope);
  if (scopeId) {
    query.equalTo('scopeId', scopeId);
  } else {
    query.doesNotExist('scopeId');
  }
  query.include(['targetUser', 'voter']);
  query.limit(3000);
  return query.find({ useMasterKey: true });
}

async function loadMuralPerformanceRows(scope, scopeId, locationFilter) {
  if (scope === 'app') {
    const query = new Parse.Query('EventPerformance');
    if (locationFilter && locationFilter.active) {
      query.matchesQuery('event', buildMuralLocationEventQuery(locationFilter));
    }
    return query.limit(3000).find({ useMasterKey: true });
  }

  if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });

    const byPelada = new Parse.Query('EventPerformance');
    byPelada.equalTo('pelada', pelada);

    const queries = [byPelada];
    if (events.length) {
      const byEvent = new Parse.Query('EventPerformance');
      byEvent.containedIn('event', events);
      queries.push(byEvent);
    }

    const combined = Parse.Query.or(...queries);
    combined.limit(3000);
    return combined.find({ useMasterKey: true });
  }

  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    return new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .limit(3000)
      .find({ useMasterKey: true });
  }

  return [];
}

function mapPerformanceRow(perf, conflictMap = new Map(), scopeDefaultPriority) {
  const userId = getPerformanceParticipantId(perf);
  const user = perf.get('user');
  const priority = resolvePerformanceStatsPriority(perf, conflictMap, scopeDefaultPriority);
  const effective = resolveEffectivePerformanceStats(perf, priority);
  const event = perf.get('event');
  return {
    userId,
    userName:
      (user && user.get ? user.get('apelido') : '') ||
      (user && user.get ? user.get('name') : '') ||
      (user && user.getUsername ? user.getUsername() : '') ||
      'Usuario',
    role: perf.get('role') || 'athlete',
    score: computeEffectivePerformanceScore(perf, priority),
    goals: effective.goals,
    saves: effective.saves,
    eventId: event && event.id ? String(event.id) : '',
  };
}

async function attachTeamMatchPerformanceWeights(rows, applyWeight = true) {
  const eventIds = [
    ...new Set(rows.map((row) => String(row.eventId || '').trim()).filter(Boolean)),
  ];
  if (!eventIds.length) return rows;
  const typeById = new Map();
  for (let i = 0; i < eventIds.length; i += 50) {
    const chunk = eventIds.slice(i, i + 50);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }
  for (const row of rows) {
    const type = typeById.get(String(row.eventId || '')) || '';
    row.eventType = type === 'team_match' ? 'team_match' : type || 'pelada';
    if (type === 'team_match' && applyWeight) {
      row.score = Number(row.score || 0) * TEAM_MATCH_MURAL_WEIGHT;
    }
  }
  return rows;
}

async function mapPerformanceRowsForMural(scope, scopeId, performances) {
  let scopeDefaultPriority;
  if (scope === 'pelada' && scopeId) {
    scopeDefaultPriority = await loadPeladaStatsConflictSource(scopeId);
  }
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(performances);
  const rows = performances.map((perf) => mapPerformanceRow(perf, conflictMap, scopeDefaultPriority));
  return attachTeamMatchPerformanceWeights(rows, scope !== 'event');
}

function buildLocationStatsFromParticipantRows(participants) {
  const byCity = new Map();
  const byNeighborhood = new Map();
  let total = 0;

  for (const row of participants) {
    const address = row.address || {};
    const city = normalizeLocationLabel(address.city);
    const neighborhood = normalizeLocationLabel(address.neighborhood);
    const state = normalizeBrazilUfLabel(address.state);
    if (!city && !neighborhood) continue;
    total += 1;
    if (city) {
      const cityLabel = state ? `${city} - ${state}` : city;
      byCity.set(cityLabel, (byCity.get(cityLabel) || 0) + 1);
    }
    if (neighborhood) {
      const label = [neighborhood, city, state].filter(Boolean).join(' · ');
      byNeighborhood.set(label, (byNeighborhood.get(label) || 0) + 1);
    }
  }

  return {
    total,
    byState: [],
    byCity: sortLocationCounts(byCity),
    byNeighborhood: sortLocationCounts(byNeighborhood),
  };
}

function resolveRegistrationDisplayFields(registration, resolvedUserId) {
  const user = registration.get('user');
  const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
  const displayName =
    apelido ||
    (registration.get('userDisplayName') || '').trim() ||
    (registration.get('userFullName') || '').trim() ||
    (user && user.get ? (user.get('apelido') || '').trim() : '') ||
    (user && user.get ? (user.get('name') || '').trim() : '') ||
    'Participante';
  const avatarUrl = resolveStoredAvatarUrl(user, registration);
  return {
    userId: resolvedUserId,
    displayName,
    avatarUrl: avatarUrl || undefined,
  };
}

function applyEventMuralVoteSnapshot(vote, registration, resolvedUserId) {
  const display = resolveRegistrationDisplayFields(registration, resolvedUserId);
  vote.set('targetUserId', resolvedUserId);
  vote.set('targetDisplayName', display.displayName);
  if (display.avatarUrl) {
    vote.set('targetAvatarUrl', display.avatarUrl);
  } else {
    vote.unset('targetAvatarUrl');
  }
}

function buildMuralVoteACL(voterId) {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  if (voterId) {
    acl.setReadAccess(voterId, true);
    acl.setWriteAccess(voterId, true);
  }
  return acl;
}

function enrichRankingsWithParticipantMeta(rankings, participants) {
  const nameById = new Map();
  const avatarById = new Map();
  for (const row of participants) {
    if (!row.userId) continue;
    nameById.set(
      row.userId,
      row.apelido || row.userName || nameById.get(row.userId) || 'Participante'
    );
    if (row.avatarUrl) avatarById.set(row.userId, row.avatarUrl);
  }

  for (const role of MURAL_TARGET_ROLES) {
    rankings[role] = (rankings[role] || []).map((entry) => ({
      ...entry,
      userName: nameById.get(entry.userId) || entry.userName || 'Participante',
      avatarUrl: avatarById.get(entry.userId) || entry.avatarUrl,
    }));
  }
  return rankings;
}

async function backfillEventMuralVoteSnapshots(votes, eventId) {
  if (!votes.length || !eventId) return;

  const needsBackfill = votes.filter((vote) => !vote.get('targetDisplayName'));
  if (!needsBackfill.length) return;

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  const regByUserId = new Map();
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId) {
      regByUserId.set(resolved.userId, registration);
    }
  }

  const toSave = [];
  for (const vote of needsBackfill) {
    const targetUser = vote.get('targetUser');
    const targetUserId = String(
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
    );
    const registration = regByUserId.get(targetUserId);
    if (!registration || !targetUserId) continue;
    applyEventMuralVoteSnapshot(vote, registration, targetUserId);
    if (!vote.getACL()) {
      const voter = vote.get('voter');
      const voterId = voter && voter.id ? voter.id : '';
      if (voterId) {
        vote.setACL(buildMuralVoteACL(voterId));
      }
    }
    toSave.push(vote);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
}

async function listMyEventMuralVoteRows(eventId, voterId) {
  const voter = Parse.User.createWithoutData(voterId);
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  query.equalTo('scopeId', eventId);
  query.equalTo('period', eventId);
  query.equalTo('voter', voter);
  query.limit(500);
  const votes = await query.find({ useMasterKey: true });
  await backfillEventMuralVoteSnapshots(votes, eventId);
  return votes;
}

function mapMyEventMuralVoteRow(vote, participantById) {
  const targetUser = vote.get('targetUser');
  const targetUserId = String(
    vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
  );
  const participant = participantById.get(targetUserId);
  const targetUserName =
    vote.get('targetDisplayName') ||
    (participant && participant.apelido) ||
    (participant && participant.userName) ||
    'Participante';
  const targetAvatarUrl = vote.get('targetAvatarUrl') || (participant && participant.avatarUrl);
  return {
    objectId: vote.id,
    scope: 'event',
    scopeId: vote.get('scopeId') || '',
    voterId: vote.get('voter') && vote.get('voter').id ? vote.get('voter').id : '',
    targetUserId,
    targetUserName,
    targetAvatarUrl: targetAvatarUrl || undefined,
    targetRole: vote.get('targetRole') || 'athlete',
    score: Number(vote.get('score') || 0),
    period: vote.get('period') || '',
    createdAt: vote.get('createdAt') ? vote.get('createdAt').toISOString() : new Date().toISOString(),
  };
}

function mapVoteRow(vote) {
  const voter = vote.get('voter');
  const targetUser = vote.get('targetUser');
  const targetUserId = String(
    vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
  );
  return {
    voterId: voter && voter.id ? String(voter.id) : '',
    targetUserId,
    targetUserName:
      vote.get('targetDisplayName') ||
      (targetUser && targetUser.get ? targetUser.get('apelido') : '') ||
      (targetUser && targetUser.get ? targetUser.get('name') : '') ||
      (targetUser && targetUser.getUsername ? targetUser.getUsername() : '') ||
      'Participante',
    targetRole: vote.get('targetRole') || 'athlete',
    score: Number(vote.get('score') || 0),
    period: vote.get('period') || '',
    scopeId: String(vote.get('scopeId') || ''),
    scoreWeight: 1,
  };
}

function muralRankingDisplayScore(entry) {
  const voteCount = Number(entry.voteCount || 0);
  const totalScore = Number(entry.totalScore || 0);
  const combinedScore = Number(entry.combinedScore || 0);
  return voteCount > 0 ? totalScore : combinedScore;
}

/** Nota exibida na badge do Top 10 Atletas (averageScore quando há votos). */
function athleteDisplayNote(entry) {
  if (Number(entry.voteCount || 0) > 0) return Number(entry.averageScore || 0);
  return Number(entry.combinedScore || 0);
}

function buildMuralRankingsFromData(performances, votes, topN = 10) {
  const perfScores = new Map();
  const perfMeta = new Map();
  for (const perf of performances) {
    if (!perf.userId) continue;
    const key = `${perf.userId}:${perf.role}`;
    perfScores.set(key, (perfScores.get(key) || 0) + perf.score);
    if (!perfMeta.has(key)) perfMeta.set(key, perf);
  }

  const voteAgg = new Map();
  for (const vote of dedupeMuralVoteRowsByVoter(votes)) {
    if (!vote.targetUserId) continue;
    const key = `${vote.targetUserId}:${vote.targetRole}`;
    const current = voteAgg.get(key) || { total: 0, count: 0, weightSum: 0 };
    const weight = Number(vote.scoreWeight || 1) || 1;
    const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
    current.total += weighted;
    current.count += 1;
    current.weightSum += weight;
    voteAgg.set(key, current);
  }

  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    const userIds = new Set();
    for (const perf of performances) {
      if (perf.role === role && perf.userId) userIds.add(perf.userId);
    }
    for (const vote of votes) {
      if (vote.targetRole === role && vote.targetUserId) userIds.add(vote.targetUserId);
    }

    const entries = [];
    for (const userId of userIds) {
      const perfKey = `${userId}:${role}`;
      const performanceScore = perfScores.get(perfKey) || 0;
      const voteData = voteAgg.get(perfKey) || { total: 0, count: 0, weightSum: 0 };
      if (voteData.count === 0 && performanceScore === 0) continue;
      const averageScore =
        voteData.weightSum > 0
          ? voteData.total / voteData.weightSum
          : voteData.count > 0
            ? voteData.total / voteData.count
            : 0;
      const combinedScore = performanceScore + averageScore * 10;
      const perf = perfMeta.get(perfKey);
      const vote = votes.find((row) => row.targetUserId === userId && row.targetRole === role);
      entries.push({
        userId,
        userName: (perf && perf.userName) || (vote && vote.targetUserName) || 'Usuario',
        role,
        totalScore: voteData.total,
        voteCount: voteData.count,
        averageScore,
        performanceScore,
        combinedScore,
      });
    }

    entries.sort((a, b) => {
      if (role === 'goalkeeper') {
        const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
      }
      if (role === 'athlete') {
        const noteDiff = athleteDisplayNote(b) - athleteDisplayNote(a);
        if (noteDiff !== 0) return noteDiff;
        const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
        if (voteDiff !== 0) return voteDiff;
        return (b.combinedScore || 0) - (a.combinedScore || 0);
      }
      return b.combinedScore - a.combinedScore;
    });
    result[role] = entries.slice(0, topN);
  }

  return result;
}

/** Perfis de apoio: media das notas por evento / qtd de eventos com nota. */
const SUPPORT_MURAL_ROLES = [
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'fan',
  'gatekeeper',
];

function isSupportMuralRole(role) {
  return SUPPORT_MURAL_ROLES.indexOf(role) >= 0;
}

/**
 * Media das notas por evento (media de cada evento / qtd de eventos com nota).
 * Usado no mural da pelada e do app para perfis de apoio.
 */
function buildSupportRoleAverageByEventRankings(voteRows, topN = 10) {
  const deduped = dedupeMuralVoteRowsByVoter(voteRows);
  const result = {};

  for (const role of SUPPORT_MURAL_ROLES) {
    const byUser = new Map();
    for (const vote of deduped) {
      if (vote.targetRole !== role || !vote.targetUserId) continue;
      const eventId = String(vote.scopeId || '').trim() || '_';
      let userData = byUser.get(vote.targetUserId);
      if (!userData) {
        userData = {
          userName: vote.targetUserName || 'Participante',
          events: new Map(),
          voteCount: 0,
        };
        byUser.set(vote.targetUserId, userData);
      }
      if (vote.targetUserName && vote.targetUserName !== 'Usuario') {
        userData.userName = vote.targetUserName;
      }
      const eventAgg = userData.events.get(eventId) || { sum: 0, count: 0, weightSum: 0 };
      const weight = Number(vote.scoreWeight || 1) || 1;
      const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
      eventAgg.sum += weighted;
      eventAgg.count += 1;
      eventAgg.weightSum += weight;
      userData.events.set(eventId, eventAgg);
      userData.voteCount += 1;
    }

    const entries = Array.from(byUser.entries())
      .map(([userId, data]) => {
        const eventAverages = [];
        for (const eventAgg of data.events.values()) {
          if (eventAgg.weightSum > 0) {
            eventAverages.push(eventAgg.sum / eventAgg.weightSum);
          } else if (eventAgg.count > 0) {
            eventAverages.push(eventAgg.sum / eventAgg.count);
          }
        }
        const eventsParticipated = eventAverages.length;
        const averageScore =
          eventsParticipated > 0
            ? eventAverages.reduce((sum, value) => sum + value, 0) / eventsParticipated
            : 0;
        return {
          userId,
          userName: data.userName,
          role,
          totalScore: averageScore,
          voteCount: data.voteCount,
          averageScore,
          performanceScore: 0,
          combinedScore: averageScore,
          eventsParticipated,
        };
      })
      .filter((entry) => entry.eventsParticipated > 0)
      .sort((a, b) => {
        const avgDiff = (b.averageScore || 0) - (a.averageScore || 0);
        if (avgDiff !== 0) return avgDiff;
        return (b.voteCount || 0) - (a.voteCount || 0);
      })
      .slice(0, topN);

    result[role] = entries;
  }

  return result;
}

function buildPeladaMuralRankings(performances, voteRows, topN = 10) {
  const perfRankings = buildMuralRankingsFromData(performances, voteRows, topN);
  const voteRankings = buildEventVoteRankings(voteRows, topN);
  const supportAvgRankings = buildSupportRoleAverageByEventRankings(voteRows, topN);
  const result = {};

  for (const role of MURAL_TARGET_ROLES) {
    if (isSupportMuralRole(role)) {
      const supportList = supportAvgRankings[role] || [];
      if (supportList.length > 0) {
        result[role] = supportList;
        continue;
      }
    }

    const voteList = voteRankings[role] || [];
    if (voteList.length > 0) {
      result[role] = voteList.map((entry) => {
        const perfEntry = (perfRankings[role] || []).find((row) => row.userId === entry.userId);
        return {
          ...entry,
          userName: entry.userName || perfEntry?.userName || 'Participante',
          performanceScore: perfEntry?.performanceScore ?? entry.performanceScore ?? 0,
          averageScore: perfEntry?.averageScore ?? entry.averageScore ?? 0,
          voteCount: entry.voteCount ?? perfEntry?.voteCount ?? 0,
          combinedScore: perfEntry?.combinedScore ?? entry.totalScore,
        };
      });
      continue;
    }

    result[role] = perfRankings[role] || [];
  }

  return result;
}

function resolveStoredAvatarUrl(user, registration) {
  const registrationAvatar = registration && registration.get ? registration.get('avatarUrl') : '';
  if (registrationAvatar && String(registrationAvatar).trim()) {
    return String(registrationAvatar).trim();
  }
  if (!user || !user.get) return undefined;
  const direct = (user.get('avatarUrl') || '').trim();
  if (direct) return direct;
  const avatar = user.get('avatar');
  if (avatar && typeof avatar.url === 'function') {
    return avatar.url();
  }
  if (avatar && avatar._url) return avatar._url;
  return undefined;
}

function buildEventVoteRankings(voteRows, topN = 10) {
  const deduped = dedupeMuralVoteRowsByVoter(voteRows);
  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    const agg = new Map();
    for (const vote of deduped) {
      if (vote.targetRole !== role || !vote.targetUserId) continue;
      const current = agg.get(vote.targetUserId) || {
        total: 0,
        count: 0,
        weightSum: 0,
        userName: vote.targetUserName || 'Participante',
      };
      const weight = Number(vote.scoreWeight || 1) || 1;
      const weighted = Number(vote.weightedScore != null ? vote.weightedScore : vote.score * weight);
      current.total += weighted;
      current.count += 1;
      current.weightSum += weight;
      if (vote.targetUserName && vote.targetUserName !== 'Usuario') {
        current.userName = vote.targetUserName;
      }
      agg.set(vote.targetUserId, current);
    }

    const entries = Array.from(agg.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        role,
        totalScore: data.total,
        voteCount: data.count,
        averageScore:
          data.weightSum > 0
            ? data.total / data.weightSum
            : data.count > 0
              ? data.total / data.count
              : 0,
        performanceScore: 0,
        combinedScore: data.total,
      }))
      .sort((a, b) => {
        if (role === 'goalkeeper') {
          const scoreDiff = (b.totalScore || 0) - (a.totalScore || 0);
          if (scoreDiff !== 0) return scoreDiff;
        }
        return b.totalScore - a.totalScore;
      })
      .slice(0, topN);

    result[role] = entries;
  }
  return result;
}

async function loadUserAgesForRanking(userIds) {
  const map = new Map();
  if (!userIds.length) return map;

  for (let i = 0; i < userIds.length; i += 100) {
    const batch = userIds.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    const users = await userQuery.find({ useMasterKey: true });
    for (const user of users) {
      const birthDate = user.get('birthDate');
      if (birthDate instanceof Date && !Number.isNaN(birthDate.getTime())) {
        map.set(user.id, calcAgeFromBirthDate(birthDate));
      }
    }
  }
  return map;
}

async function finalizeEventGoalkeeperRankings(rankings) {
  const entries = rankings.goalkeeper || [];
  if (entries.length <= 1) return rankings;

  const ageByUserId = await loadUserAgesForRanking(entries.map((entry) => entry.userId));
  entries.sort((a, b) => {
    const totalDiff = (b.totalScore || 0) - (a.totalScore || 0);
    if (totalDiff !== 0) return totalDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });
  rankings.goalkeeper = entries;
  return rankings;
}

function muralRankingPrimarySort(a, b, role) {
  if (role === 'goalkeeper') {
    const totalDiff = (b.totalScore || 0) - (a.totalScore || 0);
    if (totalDiff !== 0) return totalDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return 0;
  }
  if (role === 'athlete') {
    const noteDiff = athleteDisplayNote(b) - athleteDisplayNote(a);
    if (noteDiff !== 0) return noteDiff;
    const voteDiff = (b.voteCount || 0) - (a.voteCount || 0);
    if (voteDiff !== 0) return voteDiff;
    return (b.combinedScore || 0) - (a.combinedScore || 0);
  }
  const combinedDiff = (b.combinedScore || 0) - (a.combinedScore || 0);
  if (combinedDiff !== 0) return combinedDiff;
  const avgDiff = (b.averageScore || 0) - (a.averageScore || 0);
  if (avgDiff !== 0) return avgDiff;
  return (b.voteCount || 0) - (a.voteCount || 0);
}

async function finalizeMuralRankingsAgeTiebreak(rankings) {
  const userIds = new Set();
  for (const role of MURAL_TARGET_ROLES) {
    for (const entry of rankings[role] || []) {
      if (entry.userId) userIds.add(entry.userId);
    }
  }
  const ageByUserId = await loadUserAgesForRanking(Array.from(userIds));

  for (const role of MURAL_TARGET_ROLES) {
    const entries = rankings[role] || [];
    if (entries.length <= 1) continue;
    entries.sort((a, b) => {
      const primary = muralRankingPrimarySort(a, b, role);
      if (primary !== 0) return primary;
      return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
    });
    rankings[role] = entries;
  }
  return rankings;
}

function extractUserLocationKeys(user, includeState) {
  const address = user.get('address') || {};
  const state = normalizeBrazilUfLabel(address.state);
  const city = normalizeLocationLabel(address.city);
  const neighborhood = normalizeLocationLabel(address.neighborhood);

  return {
    state: includeState && state ? state : null,
    city: city ? (includeState && state ? `${city} - ${state}` : city) : null,
    neighborhood: neighborhood
      ? [neighborhood, city, includeState ? state : ''].filter(Boolean).join(' · ')
      : null,
  };
}

function buildMuralLocationTopRankingsFromUsers(users, fullRankings, includeState) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();

  for (const user of users) {
    if (!user.id) continue;
    const keys = extractUserLocationKeys(user, includeState);
    if (keys.state) {
      if (!byState.has(keys.state)) byState.set(keys.state, new Set());
      byState.get(keys.state).add(user.id);
    }
    if (keys.city) {
      if (!byCity.has(keys.city)) byCity.set(keys.city, new Set());
      byCity.get(keys.city).add(user.id);
    }
    if (keys.neighborhood) {
      if (!byNeighborhood.has(keys.neighborhood)) {
        byNeighborhood.set(keys.neighborhood, new Set());
      }
      byNeighborhood.get(keys.neighborhood).add(user.id);
    }
  }

  const buildGroups = (groupsMap) => {
    const result = [];
    for (const [label, userIds] of groupsMap) {
      if (userIds.size < 3) continue;
      const rankings = {};
      for (const role of MURAL_TARGET_ROLES) {
        rankings[role] = (fullRankings[role] || [])
          .filter((entry) => {
            if (!userIds.has(entry.userId) || muralRankingDisplayScore(entry) <= 0) {
              return false;
            }
            const votes = Number(entry.voteCount || 0);
            // Com votos, exige quórum no papel; ranking so de desempenho (0 votos) segue.
            if (votes > 0 && votes < INTEGRITY_MIN_LOCATION_ROLE_VOTES) {
              return false;
            }
            return true;
          })
          .sort((a, b) => muralRankingDisplayScore(b) - muralRankingDisplayScore(a))
          .slice(0, 3);
      }
      result.push({
        label,
        participantCount: userIds.size,
        rankings,
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  };

  return {
    byState: includeState ? buildGroups(byState) : [],
    byCity: buildGroups(byCity),
    byNeighborhood: buildGroups(byNeighborhood),
  };
}

async function loadEventMuralParticipantRows(eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  const byUser = {};
  const toSave = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (resolved.shouldSave) toSave.push(registration);

    const role = registration.get('role') || 'athlete';
    const user = registration.get('user');
    const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
    const userName =
      apelido ||
      (registration.get('userDisplayName') || '').trim() ||
      (registration.get('userFullName') || '').trim() ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      'Participante';
    const birthDate = user && user.get ? user.get('birthDate') : undefined;
    const address = user && user.get ? user.get('address') : undefined;
    const avatarUrl = resolveStoredAvatarUrl(user, registration);

    if (!byUser[resolved.userId]) {
      byUser[resolved.userId] = {
        userId: resolved.userId,
        userName,
        apelido,
        fullName:
          (registration.get('userFullName') || '').trim() ||
          (user && user.get ? (user.get('name') || '').trim() : '') ||
          '',
        roles: [role],
        avatarUrl,
        birthDate: birthDate ? birthDate.toISOString() : undefined,
        address: address || undefined,
        proFootballIdol:
          user && user.get ? (user.get('proFootballIdol') || '').trim() || undefined : undefined,
        amateurFootballIdol:
          user && user.get ? (user.get('amateurFootballIdol') || '').trim() || undefined : undefined,
      };
    } else {
      if (!byUser[resolved.userId].roles.includes(role)) {
        byUser[resolved.userId].roles.push(role);
      }
      if (!byUser[resolved.userId].avatarUrl && avatarUrl) {
        byUser[resolved.userId].avatarUrl = avatarUrl;
      }
      if (!byUser[resolved.userId].apelido && apelido) {
        byUser[resolved.userId].apelido = apelido;
      }
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return Object.values(byUser).sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
}

async function enrichMuralRankingNames(scope, scopeId, result) {
  const userIds = new Set();
  for (const role of MURAL_TARGET_ROLES) {
    for (const entry of result[role] || []) {
      if (entry.userId) userIds.add(entry.userId);
    }
  }
  if (!userIds.size) return result;

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  const userById = new Map(users.map((user) => [user.id, user]));

  const registrationNames = new Map();
  const registrationAvatars = new Map();
  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .include('user')
      .limit(500)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
      const displayName =
        apelido ||
        (registration.get('userDisplayName') || '').trim() ||
        (registration.get('userFullName') || '').trim();
      if (displayName) registrationNames.set(resolved.userId, displayName);
      const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
      if (avatarUrl) registrationAvatars.set(resolved.userId, avatarUrl);
    }
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    for (const event of events) {
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('user')
        .limit(500)
        .find({ useMasterKey: true });
      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;
        const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
        const displayName =
          apelido ||
          (registration.get('userDisplayName') || '').trim() ||
          (registration.get('userFullName') || '').trim();
        if (displayName && !registrationNames.has(resolved.userId)) {
          registrationNames.set(resolved.userId, displayName);
        }
        const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
        if (avatarUrl && !registrationAvatars.has(resolved.userId)) {
          registrationAvatars.set(resolved.userId, avatarUrl);
        }
      }
    }
  }

  for (const role of MURAL_TARGET_ROLES) {
    result[role] = (result[role] || []).map((entry) => {
      const user = userById.get(entry.userId);
      const userName =
        registrationNames.get(entry.userId) ||
        (user && user.get('apelido')) ||
        (user && user.get('name')) ||
        (user && user.getUsername()) ||
        entry.userName ||
        'Participante';
      const avatarUrl =
        registrationAvatars.get(entry.userId) ||
        resolveStoredAvatarUrl(user) ||
        entry.avatarUrl;
      return {
        ...entry,
        userName,
        avatarUrl: avatarUrl || undefined,
      };
    });
  }

  return result;
}

function sumScoutTypedGoals(stats) {
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(stats[field] || 0);
  }
  return total;
}

function hasRefereeSumulaSaved(perf) {
  if (!perf || !perf.get) return false;
  if (perf.get('refereeSumulaSaved')) return true;
  if (perf.get('refereeObservation')) return true;
  if (Number(perf.get('refereeGoals') || 0) > 0) return true;
  if (Number(perf.get('refereeGoalsConceded') || 0) > 0) return true;
  if (Number(perf.get('refereeYellowCards') || 0) > 0) return true;
  if (Number(perf.get('refereeRedCards') || 0) > 0) return true;
  if (Number(perf.get('refereeFoulsCommitted') || 0) > 0) return true;
  return false;
}

function hasScoutApontamentoSaved(perf) {
  if (!perf || !perf.get) return false;
  if (perf.get('scoutApontamentoSaved')) return true;
  const stats = mapPerformanceToScoutStats(perf);
  if (Number(stats.goals || 0) > 0 || sumScoutTypedGoals(stats) > 0) return true;
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals') continue;
    if (Number(stats[field] || 0) > 0) return true;
  }
  return false;
}

function resolveEffectiveGoalsForCounting(perf, priority) {
  if (!perf || !perf.get) return 0;
  const scoutStats = mapPerformanceToScoutStats(perf);
  const refereeStats = mapPerformanceToRefereeSumula(perf);
  const scoutGoals = Math.max(
    Number(scoutStats.goals || 0),
    sumScoutTypedGoals(scoutStats)
  );
  const refereeGoals = Number(refereeStats.goals || 0);
  const legacyGoals = Number(perf.get('goals') || 0);
  const scoutSaved = hasScoutApontamentoSaved(perf);
  const refereeSaved = hasRefereeSumulaSaved(perf);
  const useScoutFirst = normalizeStatsConflictSource(priority) === 'scout';

  if (useScoutFirst) {
    if (scoutSaved) return scoutGoals;
    if (refereeSaved) return refereeGoals;
  } else {
    if (refereeSaved) return refereeGoals;
    if (scoutSaved) return scoutGoals;
  }
  return Math.max(scoutGoals, refereeGoals, legacyGoals);
}

function resolveMuralHighlightGoals(perf, priority) {
  return resolveEffectiveGoalsForCounting(perf, priority || 'referee');
}


// Perfis de participantes e times favoritos
async function collectMuralProfileUserIds(scope, scopeId, extraUserIds) {
  const ids = new Set();
  for (const id of extraUserIds || []) {
    if (id) ids.add(String(id));
  }

  if (scope === 'app') {
    const birthQuery = new Parse.Query(Parse.User);
    birthQuery.exists('birthDate');
    birthQuery.limit(5000);
    const usersWithBirth = await birthQuery.find({ useMasterKey: true });
    for (const user of usersWithBirth) {
      if (user.id) ids.add(user.id);
    }

    const voteRows = await loadMuralVoteRows('app');
    for (const vote of voteRows) {
      const targetUserId = vote.get('targetUserId');
      const targetUser = vote.get('targetUser');
      const userId = targetUserId || (targetUser && targetUser.id ? targetUser.id : '');
      if (userId) ids.add(String(userId));
    }

    const performances = await loadMuralPerformanceRows('app');
    for (const perf of performances) {
      const userId = getPerformanceParticipantId(perf);
      if (userId) ids.add(userId);
    }

    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const participantIds = await collectPeladaParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  if (scope === 'event' && scopeId) {
    const participantIds = await collectEventParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  return ids;
}

function buildMuralParticipantProfile(user, athleteProfile, amateurTeam, fanProfile) {
  const birthDate = user.get('birthDate');
  const age = calcAgeFromBirthDate(birthDate);
  const primaryRole = user.get('primaryRole');
  const athletePosition = athleteProfile ? athleteProfile.get('primaryPosition') : undefined;
  const profileLabels = {
    athlete: 'Atleta',
    referee: 'Juiz',
    scout: 'Scout / Mesario',
    journalist: 'Jornalista',
    cameraman: 'Cinegrafista',
    narrator: 'Narrador',
    coach: 'Treinador',
    physical_trainer: 'Preparador Fisico',
    masseur: 'Massagista',
    kitman: 'Ropeiro',
    gandula: 'Gandula',
    fan: 'Torcedor',
  };
  const profileLabel =
    athletePosition ||
    (primaryRole && profileLabels[primaryRole]) ||
    'Participante';
  const apelido = (user.get('apelido') || '').trim();
  const fullName = (user.get('name') || '').trim();

  return {
    userId: user.id,
    displayName: apelido || fullName || user.getUsername() || 'Participante',
    avatarUrl: user.get('avatarUrl') || undefined,
    profileLabel,
    isAthlete: !!athleteProfile,
    favoriteProTeam: readUserFavoriteProTeam(
      user,
      athleteProfile ? athleteProfile.get('favoriteProTeam') : undefined,
      fanProfile ? fanProfile.get('favoriteProTeam') : undefined
    ),
    favoriteAmateurTeam: readUserFavoriteAmateurTeam(
      user,
      amateurTeam ? amateurTeam.get('name') : undefined
    ),
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    birthDate: birthDate ? birthDate.toISOString() : undefined,
    age,
    ageBand: getAgeBandFromAge(age),
  };
}

Parse.Cloud.define('getMuralParticipantProfiles', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const userIds = await collectMuralProfileUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return [];
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.containedIn('user', users);
  athleteQuery.limit(users.length);
  const athletes = await athleteQuery.find({ useMasterKey: true });
  const athleteByUserId = new Map();
  for (const row of athletes) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) athleteByUserId.set(userPtr.id, row);
  }

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.containedIn('user', users);
  fanQuery.limit(users.length);
  const fans = await fanQuery.find({ useMasterKey: true });
  const fanByUserId = new Map();
  for (const row of fans) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) fanByUserId.set(userPtr.id, row);
  }

  const teamQuery = new Parse.Query('AmateurTeam');
  teamQuery.containedIn('president', users);
  teamQuery.limit(users.length);
  const teams = await teamQuery.find({ useMasterKey: true });
  const teamByPresidentId = new Map();
  for (const row of teams) {
    const president = row.get('president');
    if (president && president.id) teamByPresidentId.set(president.id, row);
  }

  return users
    .filter((user) => user.id)
    .map((user) =>
      buildMuralParticipantProfile(
        user,
        athleteByUserId.get(user.id),
        teamByPresidentId.get(user.id),
        fanByUserId.get(user.id)
      )
    );
});

Parse.Cloud.define('getFavoriteProTeamStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const userIds = await collectMuralProfileUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return { teams: [], totalParticipants: 0 };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.containedIn('user', users);
  athleteQuery.limit(users.length);
  const athletes = await athleteQuery.find({ useMasterKey: true });

  const fanQuery = new Parse.Query('FanProfile');
  fanQuery.containedIn('user', users);
  fanQuery.limit(users.length);
  const fans = await fanQuery.find({ useMasterKey: true });

  const legacyTeamByUserId = new Map();
  for (const row of athletes) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) {
      legacyTeamByUserId.set(userPtr.id, row.get('favoriteProTeam'));
    }
  }
  for (const row of fans) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id && !legacyTeamByUserId.has(userPtr.id)) {
      legacyTeamByUserId.set(userPtr.id, row.get('favoriteProTeam'));
    }
  }

  const userById = new Map(users.map((user) => [user.id, user]));
  const teamByUserId = new Map();
  for (const userId of userIds) {
    const user = userById.get(userId);
    const team = readUserFavoriteProTeam(user, legacyTeamByUserId.get(userId));
    if (team) teamByUserId.set(userId, team);
  }

  const counts = new Map();
  let totalParticipants = 0;
  for (const userId of userIds) {
    const teamName = normalizeLocationLabel(teamByUserId.get(userId) || '');
    if (!teamName || teamName.toLowerCase() === 'sem time') continue;
    totalParticipants += 1;
    counts.set(teamName, (counts.get(teamName) || 0) + 1);
  }

  const teams = Array.from(counts.entries())
    .map(([teamName, count]) => ({ teamName, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return a.teamName.localeCompare(b.teamName, 'pt-BR');
    });

  return {
    teams,
    totalParticipants,
    favoriteTeam: teams.length ? teams[0] : null,
  };
});

// Estatisticas de localizacao
function normalizeLocationLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Corrige UFs invalidas vindas de geocoding (ex.: Federal District → FE). */
function normalizeBrazilUfLabel(value) {
  const uf = normalizeLocationLabel(value).toUpperCase();
  if (uf === 'FE') return 'DF';
  return uf;
}

/* ---------- Filtro de regiao do mural (local do jogo: Event.address) ---------- */

const MURAL_LOCATION_EVENT_SCAN_LIMIT = 5000;

/** UFs gravadas no banco sem normalizacao (geocoding ja gerou 'FE' e minusculas). */
function muralLocationStateVariants(uf) {
  const normalized = normalizeBrazilUfLabel(uf);
  if (!normalized) return [];
  const variants = new Set([normalized, normalized.toLowerCase()]);
  if (normalized === 'DF') {
    variants.add('FE');
    variants.add('fe');
  }
  return Array.from(variants);
}

/** Cascata Estado > Cidade > Bairro: cidade exige UF e bairro exige cidade. */
function normalizeMuralLocationFilter(params) {
  const source = params || {};
  const state = normalizeBrazilUfLabel(source.state);
  const city = state ? normalizeLocationLabel(source.city) : '';
  const neighborhood = city ? normalizeLocationLabel(source.neighborhood) : '';
  return { state, city, neighborhood, active: !!state };
}

function applyMuralLocationFilterToEventQuery(query, filter) {
  if (!filter || !filter.active) return query;
  if (filter.state) {
    query.containedIn('address.state', muralLocationStateVariants(filter.state));
  }
  if (filter.city) {
    query.equalTo('address.city', filter.city);
  }
  if (filter.neighborhood) {
    query.equalTo('address.neighborhood', filter.neighborhood);
  }
  return query;
}

/** Eventos (pelada ou confronto) com endereco dentro do recorte. */
function buildMuralLocationEventQuery(filter) {
  const query = new Parse.Query('Event');
  query.exists('address');
  return applyMuralLocationFilterToEventQuery(query, filter);
}

/** Eventos que ja contam para o mural: encerrados ou com inicio no passado. */
function buildCountedEventQueryForLocation(filter) {
  const finishedQuery = new Parse.Query('Event').equalTo('isFinished', true);
  const startedQuery = new Parse.Query('Event').lessThan('startTime', new Date());
  const combined = Parse.Query.or(finishedQuery, startedQuery);
  combined.exists('address');
  return applyMuralLocationFilterToEventQuery(combined, filter);
}

async function loadMuralLocationEventIds(filter) {
  if (!filter || !filter.active) return null;
  const query = buildMuralLocationEventQuery(filter);
  query.select(['objectId']);
  query.limit(MURAL_LOCATION_EVENT_SCAN_LIMIT);
  const events = await query.find({ useMasterKey: true });
  return events.map((event) => event.id).filter(Boolean);
}

async function loadMuralVoteRowsForEventIds(eventIds) {
  const ids = (eventIds || []).filter(Boolean);
  if (!ids.length) return [];
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const query = new Parse.Query('MuralVote');
    query.equalTo('scope', 'event');
    query.containedIn('scopeId', ids.slice(i, i + 200));
    query.include(['targetUser', 'voter']);
    query.limit(10000);
    for (const row of await query.find({ useMasterKey: true })) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}

Parse.Cloud.define('getMuralLocationOptions', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const level = String(request.params.level || 'state').trim();
  if (level !== 'state' && level !== 'city' && level !== 'neighborhood') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nivel invalido. Use state, city ou neighborhood.'
    );
  }

  const state = normalizeBrazilUfLabel(request.params.state);
  const city = normalizeLocationLabel(request.params.city);
  if (level !== 'state' && !state) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o Estado.');
  }
  if (level === 'neighborhood' && !city) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a Cidade.');
  }

  const parentFilter = {
    state: level === 'state' ? '' : state,
    city: level === 'neighborhood' ? city : '',
    neighborhood: '',
    active: level !== 'state',
  };
  const query = buildCountedEventQueryForLocation(parentFilter);
  query.select(['address']);
  query.limit(MURAL_LOCATION_EVENT_SCAN_LIMIT);
  const events = await query.find({ useMasterKey: true });

  const counts = new Map();
  for (const event of events) {
    const address = event.get('address') || {};
    const eventState = normalizeBrazilUfLabel(address.state);
    const eventCity = normalizeLocationLabel(address.city);
    const eventNeighborhood = normalizeLocationLabel(address.neighborhood);

    let value = '';
    if (level === 'state') {
      value = eventState;
    } else if (level === 'city') {
      if (eventState !== state) continue;
      value = eventCity;
    } else {
      if (eventState !== state || eventCity !== city) continue;
      value = eventNeighborhood;
    }
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const options = Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => {
      const diff = b.count - a.count;
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });

  return { options };
});

function sortLocationCounts(map) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
}

async function collectAppParticipantUserIdsForStats() {
  const ids = new Set();
  const userQuery = new Parse.Query(Parse.User);
  userQuery.exists('address');
  userQuery.limit(5000);
  const users = await userQuery.find({ useMasterKey: true });
  for (const user of users) {
    const address = user.get('address') || {};
    if (
      user.id &&
      (normalizeLocationLabel(address.state) ||
        normalizeLocationLabel(address.city) ||
        normalizeLocationLabel(address.neighborhood))
    ) {
      ids.add(user.id);
    }
  }
  return ids;
}

async function collectMuralStatsUserIds(scope, scopeId, extraUserIds) {
  const ids = new Set();
  for (const id of extraUserIds || []) {
    if (id) ids.add(String(id));
  }

  if (scope === 'app') {
    const appIds = await collectAppParticipantUserIdsForStats();
    for (const id of appIds) ids.add(id);
    return ids;
  }

  if (scope === 'pelada' && scopeId) {
    const participantIds = await collectPeladaParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  if (scope === 'event' && scopeId) {
    const participantIds = await collectEventParticipantUserIds(scopeId);
    for (const id of participantIds) ids.add(id);
    return ids;
  }

  return ids;
}

function buildMuralParticipantLocationStats(users, includeState) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();
  let total = 0;

  for (const user of users) {
    const address = user.get('address') || {};
    const state = normalizeBrazilUfLabel(address.state);
    const city = normalizeLocationLabel(address.city);
    const neighborhood = normalizeLocationLabel(address.neighborhood);

    if (!state && !city && !neighborhood) continue;
    total += 1;

    if (includeState && state) {
      byState.set(state, (byState.get(state) || 0) + 1);
    }

    if (city) {
      const cityLabel = includeState && state ? `${city} - ${state}` : city;
      byCity.set(cityLabel, (byCity.get(cityLabel) || 0) + 1);
    }

    if (neighborhood) {
      const neighborhoodLabel = [neighborhood, city, includeState ? state : '']
        .filter(Boolean)
        .join(' · ');
      byNeighborhood.set(neighborhoodLabel, (byNeighborhood.get(neighborhoodLabel) || 0) + 1);
    }
  }

  return {
    total,
    byState: includeState ? sortLocationCounts(byState) : [],
    byCity: sortLocationCounts(byCity),
    byNeighborhood: sortLocationCounts(byNeighborhood),
  };
}

Parse.Cloud.define('getMuralParticipantLocationStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const extraUserIds = Array.isArray(request.params.userIds) ? request.params.userIds : [];
  const includeState = scope === 'app';
  const userIds = await collectMuralStatsUserIds(scope, scopeId, extraUserIds);

  if (!userIds.size) {
    return {
      total: 0,
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  return buildMuralParticipantLocationStats(users, includeState);
});

async function buildHighlightGoalRowsFromRawPerformances(rawPerformances) {
  const conflictMap = await buildPeladaStatsConflictMapFromPerformances(rawPerformances);
  const goalsByEventUser = new Map();
  const eventIds = new Set();

  for (const perf of rawPerformances) {
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;

    const role = perf.get('role') || 'athlete';
    if (role !== 'athlete') continue;

    const pelada = perf.get('pelada');
    const peladaId = pelada && pelada.id ? pelada.id : '';
    const priority = conflictMap.get(peladaId) || 'referee';
    const goals = resolveMuralHighlightGoals(perf, priority);
    if (goals <= 0) continue;

    const event = perf.get('event');
    const eventId = event && event.id ? String(event.id) : String(perf.id);
    if (event && event.id) eventIds.add(event.id);
    const eventUserKey = `${eventId}:${userId}`;
    const currentEventGoals = goalsByEventUser.get(eventUserKey) ?? 0;
    goalsByEventUser.set(eventUserKey, Math.max(currentEventGoals, goals));
  }

  const typeById = new Map();
  const idList = Array.from(eventIds);
  for (let i = 0; i < idList.length; i += 50) {
    const chunk = idList.slice(i, i + 50);
    const events = await new Parse.Query('Event')
      .containedIn('objectId', chunk)
      .select(['type'])
      .limit(chunk.length)
      .find({ useMasterKey: true });
    for (const event of events) {
      typeById.set(event.id, event.get('type') || '');
    }
  }

  const byUserId = new Map();
  for (const [eventUserKey, goals] of goalsByEventUser.entries()) {
    const parts = eventUserKey.split(':');
    const eventId = parts[0];
    const userId = parts.slice(1).join(':');
    if (!userId) continue;
    const type = typeById.get(eventId) || '';
    const bucket = type === 'team_match' ? 'teamMatch' : 'pelada';
    const current = byUserId.get(userId) || {
      userId,
      role: 'athlete',
      goals: 0,
      peladaGoals: 0,
      teamMatchGoals: 0,
      eventType: type || 'pelada',
    };
    current.goals += goals;
    if (bucket === 'teamMatch') current.teamMatchGoals += goals;
    else current.peladaGoals += goals;
    byUserId.set(userId, current);
  }

  return Array.from(byUserId.values());
}

function weightedGoleadorPointsFromRow(row, bucket) {
  const peladaGoals = Number(row.peladaGoals || 0);
  const teamMatchGoals = Number(row.teamMatchGoals || 0);
  if (bucket === 'pelada') return peladaGoals;
  if (bucket === 'team_match') return teamMatchGoals;
  return peladaGoals + teamMatchGoals * TEAM_MATCH_MURAL_WEIGHT;
}

async function buildAppTopScorerRankingEntries(rawPerformances, bucket, topN = 10) {
  const rows = await buildHighlightGoalRowsFromRawPerformances(rawPerformances);
  const scored = rows
    .map((row) => {
      const peladaGoals = Number(row.peladaGoals || 0);
      const teamMatchGoals = Number(row.teamMatchGoals || 0);
      const displayGoals = peladaGoals + teamMatchGoals;
      return {
        userId: row.userId,
        userName: 'Participante',
        role: 'athlete',
        weightedGoals: weightedGoleadorPointsFromRow(row, bucket),
        displayGoals,
        peladaGoals,
        teamMatchGoals,
      };
    })
    .filter((row) => row.weightedGoals > 0);

  const ageByUserId = await loadUserAgesForRanking(scored.map((row) => row.userId));
  scored.sort((a, b) => {
    const diff = b.weightedGoals - a.weightedGoals;
    if (diff !== 0) return diff;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });

  const topRows = scored.slice(0, topN);
  const enriched = await enrichMuralRankingNames('app', undefined, { athlete: topRows });
  return (enriched.athlete || []).map((entry, index) => {
    const row = topRows[index];
    const displayGoals = row?.displayGoals ?? 0;
    return {
      ...entry,
      weightedGoals: row?.weightedGoals ?? 0,
      // Cards mostram gols reais; peso 3x fica so no sort (weightedGoals).
      totalScore: displayGoals,
      combinedScore: displayGoals,
    };
  });
}

/** Aplica campos de exibicao (sem peso 3x) mantendo a ordem ja calculada com peso. */
function applyMergedRankingDisplayFields(orderedRankings, displayRankings) {
  const result = { ...orderedRankings };
  for (const role of MURAL_TARGET_ROLES) {
    const ordered = orderedRankings[role] || [];
    const displayById = new Map((displayRankings[role] || []).map((entry) => [entry.userId, entry]));
    result[role] = ordered.map((entry) => {
      const display = displayById.get(entry.userId);
      if (!display) {
        return {
          ...entry,
          rankingScore: Number(entry.combinedScore || entry.totalScore || 0),
        };
      }
      return {
        ...entry,
        rankingScore: Number(entry.combinedScore || entry.totalScore || 0),
        totalScore: Number(display.totalScore || 0),
        performanceScore: Number(display.performanceScore || 0),
        combinedScore: Number(display.combinedScore || 0),
        averageScore: Number(display.averageScore || 0),
        voteCount: Number(display.voteCount || 0),
      };
    });
  }
  return result;
}

function unweightPerformanceRowsForDisplay(performanceRows) {
  return performanceRows.map((row) => ({
    ...row,
    score:
      row.eventType === 'team_match'
        ? Number(row.score || 0) / TEAM_MATCH_MURAL_WEIGHT
        : Number(row.score || 0),
  }));
}

async function buildAppMuralBucketPayload(
  scope,
  performanceRows,
  voteRows,
  performanceRaw,
  bucket,
  locationFilter
) {
  let perf = performanceRows;
  let votes = voteRows;
  if (bucket === 'pelada') {
    votes = unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'pelada'));
    perf = filterPerformanceRowsByEventBucket(performanceRows, 'pelada');
  } else if (bucket === 'team_match') {
    votes = unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'teamMatch'));
    perf = normalizePerformanceScoresForBucket(
      filterPerformanceRowsByEventBucket(performanceRows, 'teamMatch'),
      'teamMatch'
    );
  }

  let rankings = buildPeladaMuralRankings(perf, votes, 10);
  rankings = await enrichMuralRankingNames(scope, undefined, rankings);
  rankings = await finalizeEventGoalkeeperRankings(rankings);
  rankings = await finalizeMuralRankingsAgeTiebreak(rankings);

  let voteAggregates = buildMuralVoteAggregatesFromRows(votes);

  if (bucket === 'merged') {
    const displayVotes = unweightVoteRows(voteRows);
    const displayPerf = unweightPerformanceRowsForDisplay(performanceRows);
    const displayRankings = buildPeladaMuralRankings(displayPerf, displayVotes, 50);
    rankings = applyMergedRankingDisplayFields(rankings, displayRankings);
    voteAggregates = buildMuralVoteAggregatesFromRows(displayVotes, voteRows);
  }

  const topScorers = await buildAppTopScorerRankingEntries(performanceRaw, bucket, 10);
  const predictionRankings = await computePredictionRankingEntries(scope, undefined, 10, bucket);

  let topTeams = [];
  let topCoaches = [];
  // Recorte de regiao: o dashboard de confrontos (spotlight.teamRows) preenche esses tops.
  // Sem filtro, a varredura nacional (ate 300 times) permanece.
  if ((bucket === 'merged' || bucket === 'team_match') && !(locationFilter && locationFilter.active)) {
    if (typeof buildTopTeamsByMatchPoints === 'function') {
      topTeams = await buildTopTeamsByMatchPoints(10);
    }
    if (typeof buildTopCoachesByMatchPoints === 'function') {
      topCoaches = await buildTopCoachesByMatchPoints(10);
    }
  }

  return {
    bucket,
    rankings,
    voteAggregates,
    topScorers,
    topTeams,
    topCoaches,
    predictionRankings,
  };
}

// Highlights, dashboards e votacao do evento
Parse.Cloud.define('getMuralHighlightPerformances', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const rawPerformances = await loadMuralPerformanceRows(scope, scopeId);
  return buildHighlightGoalRowsFromRawPerformances(rawPerformances);
});

function filterVoteRowsByEventBucket(voteRows, bucket) {
  if (bucket === 'teamMatch') {
    return voteRows.filter((vote) => Number(vote.scoreWeight || 1) === TEAM_MATCH_MURAL_WEIGHT);
  }
  return voteRows.filter((vote) => Number(vote.scoreWeight || 1) !== TEAM_MATCH_MURAL_WEIGHT);
}

function unweightVoteRows(voteRows) {
  return voteRows.map((vote) => ({
    ...vote,
    scoreWeight: 1,
    weightedScore: Number(vote.score || 0),
  }));
}

function filterPerformanceRowsByEventBucket(performanceRows, bucket) {
  if (bucket === 'teamMatch') {
    return performanceRows.filter((row) => row.eventType === 'team_match');
  }
  return performanceRows.filter((row) => row.eventType !== 'team_match');
}

function normalizePerformanceScoresForBucket(performanceRows, bucket) {
  if (bucket !== 'teamMatch') return performanceRows;
  return performanceRows.map((row) => ({
    ...row,
    score: Number(row.score || 0) / TEAM_MATCH_MURAL_WEIGHT,
  }));
}

function buildMuralVoteAggregatesFromRows(voteRows, rankingVoteRows) {
  const result = {};
  for (const role of MURAL_TARGET_ROLES) {
    result[role] = {};
  }
  const displayRows = dedupeMuralVoteRowsByVoter(voteRows);
  for (const vote of displayRows) {
    if (!vote.targetUserId) continue;
    const role = vote.targetRole;
    if (!result[role]) continue;
    const current = result[role][vote.targetUserId] || {
      totalScore: 0,
      rankingScore: 0,
      voteCount: 0,
      userName: vote.targetUserName || 'Participante',
    };
    current.totalScore += Number(vote.score || 0);
    current.voteCount += 1;
    if (vote.targetUserName && vote.targetUserName !== 'Participante') {
      current.userName = vote.targetUserName;
    }
    result[role][vote.targetUserId] = current;
  }

  const rankSource = rankingVoteRows || voteRows;
  for (const vote of dedupeMuralVoteRowsByVoter(rankSource)) {
    if (!vote.targetUserId) continue;
    const role = vote.targetRole;
    if (!result[role] || !result[role][vote.targetUserId]) continue;
    const weight = Number(vote.scoreWeight || 1) || 1;
    const weighted = Number(
      vote.weightedScore != null ? vote.weightedScore : vote.score * weight
    );
    result[role][vote.targetUserId].rankingScore += weighted;
  }

  // Sem rankingVoteRows separado: rankingScore espelha totalScore (ja raw ou ja ponderado no input).
  if (!rankingVoteRows) {
    for (const role of MURAL_TARGET_ROLES) {
      for (const userId of Object.keys(result[role])) {
        const row = result[role][userId];
        if (!row.rankingScore) row.rankingScore = row.totalScore;
      }
    }
  }

  return result;
}

Parse.Cloud.define('getMuralVoteAggregates', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
  // Quorum e informativo no cliente (nota de integridade); nao esconde agregados.
  return buildMuralVoteAggregatesFromRows(voteRows);
});

Parse.Cloud.define('getMuralRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const limit = Math.min(Number(request.params.limit) || 10, 10000);

  if (scope === 'event' && scopeId) {
    const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
    // Quorum e informativo no cliente; rankings continuam visiveis.
    const rankings = await finalizeEventGoalkeeperRankings(
      await enrichMuralRankingNames(scope, scopeId, buildEventVoteRankings(voteRows, limit))
    );
    return rankings;
  }

  const performanceRows = await mapPerformanceRowsForMural(scope, scopeId, await loadMuralPerformanceRows(scope, scopeId));
  const voteRows = await mapMuralVoteRowsForScope(scope, scopeId);
  let rankings =
    scope === 'app' || (scope === 'pelada' && scopeId)
      ? buildPeladaMuralRankings(performanceRows, voteRows, limit)
      : buildMuralRankingsFromData(performanceRows, voteRows, limit);
  rankings = await finalizeEventGoalkeeperRankings(
    await enrichMuralRankingNames(scope, scopeId, rankings)
  );
  return rankings;
});

Parse.Cloud.define('getMuralLocationTopRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  if (scope !== 'app') {
    return {
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const performanceRows = await mapPerformanceRowsForMural('app', undefined, await loadMuralPerformanceRows('app'));
  const voteRows = await mapMuralVoteRowsForScope('app');
  let fullRankings = buildPeladaMuralRankings(performanceRows, voteRows, 10000);
  fullRankings = await enrichMuralRankingNames('app', undefined, fullRankings);

  const userIds = await collectAppParticipantUserIdsForStats();
  if (!userIds.size) {
    return {
      byState: [],
      byCity: [],
      byNeighborhood: [],
    };
  }

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }

  return buildMuralLocationTopRankingsFromUsers(users, fullRankings, true);
});

async function loadRecentAppParticipantRows(limit, locationFilter) {
  const cap = Math.min(Number(limit) || 500, 500);
  const registrationQuery = new Parse.Query('EventRegistration')
    .descending('createdAt')
    .include('user')
    .limit(cap);
  if (locationFilter && locationFilter.active) {
    registrationQuery.matchesQuery('event', buildMuralLocationEventQuery(locationFilter));
  }
  const registrations = await registrationQuery.find({ useMasterKey: true });

  const byUser = {};
  for (const registration of registrations) {
    const userId = getRegistrationUserId(registration);
    if (!userId) continue;

    const role = registration.get('role') || 'athlete';
    const user = registration.get('user');
    const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
    const userName =
      apelido ||
      (registration.get('userDisplayName') || '').trim() ||
      (registration.get('userFullName') || '').trim() ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      'Participante';
    const avatarUrl = resolveStoredAvatarUrl(user, registration);

    if (!byUser[userId]) {
      byUser[userId] = {
        userId,
        userName,
        apelido,
        fullName:
          (registration.get('userFullName') || '').trim() ||
          (user && user.get ? (user.get('name') || '').trim() : '') ||
          '',
        roles: [role],
        avatarUrl: avatarUrl || undefined,
      };
    } else if (!byUser[userId].roles.includes(role)) {
      byUser[userId].roles.push(role);
      if (!byUser[userId].avatarUrl && avatarUrl) {
        byUser[userId].avatarUrl = avatarUrl;
      }
      if (!byUser[userId].apelido && apelido) {
        byUser[userId].apelido = apelido;
      }
    }
  }

  return Object.values(byUser).sort((a, b) => a.userName.localeCompare(b.userName, 'pt-BR'));
}

async function buildMuralPerformanceAnalyticsPayload(scope, scopeId, performances) {
  let totalShotsOn = 0;
  let totalShotsOff = 0;
  let totalGoals = 0;
  let totalPassesOk = 0;
  let totalPassesMiss = 0;
  let totalFouls = 0;
  const athleteIds = new Set();

  for (const perf of performances) {
    const userId = getPerformanceParticipantId(perf);
    if (userId) athleteIds.add(userId);
    const stats = mapPerformanceToScoutStats(perf);
    totalShotsOn += Number(stats.shotsOnTarget || 0);
    totalShotsOff += Number(stats.shotsOffTarget || 0);
    totalGoals += Number(stats.goals || 0);
    totalPassesOk += Number(stats.passesCompleted || 0);
    totalPassesMiss += Number(stats.passesMissed || 0);
    totalFouls += Number(stats.foulsCommitted || 0);
  }

  const totalShots = totalShotsOn + totalShotsOff;
  const totalPasses = totalPassesOk + totalPassesMiss;

  const analytics = {
    qualitative: {
      shotsOnTarget: buildPerformanceTopEntries(performances, 'shotsOnTarget'),
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      assists: buildPerformanceTopEntries(performances, 'assists'),
    },
    quantitative: {
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      passesCompleted: buildPerformanceTopEntries(performances, 'passesCompleted'),
      foulsSuffered: buildPerformanceTopEntries(performances, 'foulsSuffered'),
      foulsCommitted: buildPerformanceTopEntries(performances, 'foulsCommitted'),
      passesMissed: buildPerformanceTopEntries(performances, 'passesMissed'),
    },
    charts: {
      shotsOnTarget: totalShotsOn,
      shotsOffTarget: totalShotsOff,
      goals: totalGoals,
      totalShots,
      totalPasses,
      passesCompleted: totalPassesOk,
      shotAccuracyPct: totalShots ? Math.round((totalShotsOn / totalShots) * 100) : 0,
      goalConversionPct: totalShotsOn ? Math.round((totalGoals / totalShotsOn) * 100) : 0,
      passAccuracyPct: totalPasses ? Math.round((totalPassesOk / totalPasses) * 100) : 0,
      foulsCommitted: totalFouls,
      athleteCount: athleteIds.size,
    },
  };

  return enrichMuralPerformanceAnalytics(scope, scopeId, analytics);
}

async function computePredictionRankingEntries(scope, scopeId, limit, bucket = 'merged') {
  let events = await loadFinishedEventsForPredictionScope(scope, scopeId);
  if (bucket === 'pelada') {
    events = events.filter((event) => event.get('type') !== 'team_match');
  } else if (bucket === 'team_match') {
    events = events.filter((event) => event.get('type') === 'team_match');
  }
  if (!events.length) {
    return [];
  }

  const actualByEventId = new Map();
  for (const event of events) {
    actualByEventId.set(event.id, await buildEventActualPredictionResults(event));
  }

  const predictions = await new Parse.Query('FanPrediction')
    .containedIn('event', events)
    .include('user')
    .limit(5000)
    .find({ useMasterKey: true });

  const scoresByUser = new Map();
  for (const prediction of predictions) {
    const event = prediction.get('event');
    if (!event || !event.id) continue;
    const actual = actualByEventId.get(event.id);

    const predUser = prediction.get('user');
    if (!predUser || !predUser.id) continue;

    const userId = String(predUser.id);
    const existing = scoresByUser.get(userId) || {
      userId,
      totalScore: 0,
      rankingScore: 0,
      eventsCount: 0,
    };

    if (actual && actual.ready) {
      const points = scoreFanPredictionRecord(prediction, actual, event.get('type'));
      existing.totalScore += points;
      let rankingPoints = points;
      if (bucket === 'merged' && event.get('type') === 'team_match') {
        rankingPoints *= TEAM_MATCH_MURAL_WEIGHT;
      }
      existing.rankingScore += rankingPoints;
    }
    existing.eventsCount += 1;
    scoresByUser.set(userId, existing);
  }

  const entries = Array.from(scoresByUser.values())
    .filter((entry) =>
      scope === 'event' || scope === 'pelada' || scope === 'app'
        ? entry.eventsCount > 0
        : entry.totalScore > 0
    )
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return b.eventsCount - a.eventsCount;
    })
    .slice(0, limit);

  const enriched = await enrichPredictionRankingEntries(entries);
  const ageByUserId = await loadUserAgesForRanking(enriched.map((entry) => entry.userId));
  enriched.sort((a, b) => {
    const aRank = Number(a.rankingScore != null ? a.rankingScore : a.totalScore);
    const bRank = Number(b.rankingScore != null ? b.rankingScore : b.totalScore);
    if (bRank !== aRank) return bRank - aRank;
    if (b.eventsCount !== a.eventsCount) return b.eventsCount - a.eventsCount;
    return (ageByUserId.get(b.userId) || 0) - (ageByUserId.get(a.userId) || 0);
  });
  return enriched.slice(0, limit).map((entry) => {
    const { rankingScore, ...rest } = entry;
    return rest;
  });
}

Parse.Cloud.define('getMuralAppDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const participantLimit = Math.min(Number(request.params.participantLimit) || 500, 500);
  const scope = 'app';
  const locationFilter = normalizeMuralLocationFilter(request.params);

  const [participants, performanceRaw, voteRows] = await Promise.all([
    loadRecentAppParticipantRows(participantLimit, locationFilter),
    loadMuralPerformanceRows(scope, undefined, locationFilter),
    mapMuralVoteRowsForScope(scope, undefined, locationFilter),
  ]);

  const performanceRows = await mapPerformanceRowsForMural(scope, undefined, performanceRaw);

  const [bucketMerged, bucketPelada, bucketTeamMatch] = await Promise.all([
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'merged', locationFilter),
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'pelada', locationFilter),
    buildAppMuralBucketPayload(scope, performanceRows, voteRows, performanceRaw, 'team_match', locationFilter),
  ]);

  const rankings = bucketMerged.rankings;
  const rankingsPelada = bucketPelada.rankings;
  const rankingsTeamMatch = bucketTeamMatch.rankings;

  const voteAggregates = bucketMerged.voteAggregates;
  const voteAggregatesPelada = bucketPelada.voteAggregates;
  const voteAggregatesTeamMatch = bucketTeamMatch.voteAggregates;
  const participantIds = participants.map((row) => row.userId).filter(Boolean);
  // Com recorte de regiao, as estatisticas de local olham so quem aparece nos eventos filtrados.
  const scopedUserIds = locationFilter.active
    ? new Set(
        [
          ...participantIds,
          ...performanceRows.map((row) => String(row.userId || '')),
          ...voteRows.map((row) => String(row.targetUserId || '')),
        ].filter(Boolean)
      )
    : null;
  const statsUserIds =
    scopedUserIds || (await collectMuralStatsUserIds(scope, undefined, participantIds));
  const statsIdList = Array.from(statsUserIds);
  const statsUsers = [];

  for (let i = 0; i < statsIdList.length; i += 100) {
    const batch = statsIdList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    statsUsers.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const locationStats = buildMuralParticipantLocationStats(statsUsers, true);

  let fullRankings = buildPeladaMuralRankings(performanceRows, voteRows, 10000);
  fullRankings = await enrichMuralRankingNames(scope, undefined, fullRankings);
  const locationUserIds = scopedUserIds || (await collectAppParticipantUserIdsForStats());
  const locationUsers = [];
  const locationIdList = Array.from(locationUserIds);

  for (let i = 0; i < locationIdList.length; i += 100) {
    const batch = locationIdList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    locationUsers.push(...(await userQuery.find({ useMasterKey: true })));
  }

  const locationTopRankings = locationUserIds.size
    ? buildMuralLocationTopRankingsFromUsers(locationUsers, fullRankings, true)
    : {
        byState: [],
        byCity: [],
        byNeighborhood: [],
      };

  const performanceAnalytics = await buildMuralPerformanceAnalyticsPayload(
    scope,
    undefined,
    performanceRaw
  );

  return {
    participants,
    rankings,
    rankingsPelada,
    rankingsTeamMatch,
    voteAggregates,
    voteAggregatesPelada,
    voteAggregatesTeamMatch,
    locationStats,
    locationTopRankings,
    performanceAnalytics,
    predictionRankings: bucketMerged.predictionRankings,
    buckets: {
      merged: bucketMerged,
      pelada: bucketPelada,
      team_match: bucketTeamMatch,
    },
    rankingsMeta: {
      tieBreak: 'older_age',
      confrontoWeight: TEAM_MATCH_MURAL_WEIGHT,
    },
    appliedLocation: {
      state: locationFilter.state,
      city: locationFilter.city,
      neighborhood: locationFilter.neighborhood,
    },
  };
});

Parse.Cloud.define('getEventMuralDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const rawVotes = await loadMuralVoteRows('event', eventId);
  await backfillEventMuralVoteSnapshots(rawVotes, eventId);
  const voteRows = await mapMuralVoteRowsForScope('event', eventId);
  const voterIds = new Set();
  for (const vote of voteRows) {
    if (vote.voterId) voterIds.add(vote.voterId);
  }
  const totalParticipants = (await collectEventParticipantUserIds(eventId)).size;
  const voterCount = voterIds.size;
  const votePercentage =
    totalParticipants > 0 ? Math.round((voterCount / totalParticipants) * 1000) / 10 : 0;

  const voterQuorumMet = meetsEventVoterQuorum(voterCount);
  // Sempre retorna rankings reais; o quorum so alimenta a nota de integridade no app.
  const rankings = await finalizeEventGoalkeeperRankings(
    await enrichMuralRankingNames(
      'event',
      eventId,
      buildEventVoteRankings(voteRows)
    )
  );

  const participants = await loadEventMuralParticipantRows(eventId);
  enrichRankingsWithParticipantMeta(rankings, participants);

  const users = [];
  const participantIds = participants.map((row) => row.userId).filter(Boolean);
  for (let i = 0; i < participantIds.length; i += 100) {
    const batch = participantIds.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  let locationStats = buildMuralParticipantLocationStats(users, false);
  if (!locationStats.total) {
    locationStats = buildLocationStatsFromParticipantRows(participants);
  }

  const myVotes = (await listMyEventMuralVoteRows(eventId, request.user.id)).map((vote) =>
    mapMyEventMuralVoteRow(
      vote,
      new Map(participants.map((row) => [row.userId, row]))
    )
  );

  return {
    rankings,
    voteSummary: {
      totalVotes: voteRows.length,
      voterCount,
      totalParticipants,
      votePercentage,
      voterQuorumMet,
      minVoters: INTEGRITY_MIN_EVENT_VOTERS,
    },
    participants,
    locationStats,
    myVotes,
  };
});

Parse.Cloud.define('listMyEventMuralVotes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const participants = await loadEventMuralParticipantRows(eventId);
  const participantById = new Map(participants.map((row) => [row.userId, row]));
  const votes = await listMyEventMuralVoteRows(eventId, request.user.id);
  return votes.map((vote) => mapMyEventMuralVoteRow(vote, participantById));
});

Parse.Cloud.define('getEventMuralVoteSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const votes = dedupeMuralVoteRowsByVoter(
    (await loadMuralVoteRows('event', eventId)).map(mapVoteRow)
  );
  const voterIds = new Set();
  for (const vote of votes) {
    if (vote.voterId) voterIds.add(vote.voterId);
  }

  const totalParticipants = (await collectEventParticipantUserIds(eventId)).size;
  const voterCount = voterIds.size;
  const votePercentage =
    totalParticipants > 0
      ? Math.round((voterCount / totalParticipants) * 1000) / 10
      : 0;

  return {
    totalVotes: votes.length,
    voterCount,
    totalParticipants,
    votePercentage,
    voterQuorumMet: meetsEventVoterQuorum(voterCount),
    minVoters: INTEGRITY_MIN_EVENT_VOTERS,
  };
});

Parse.Cloud.define('listEventMuralParticipants', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  return loadEventMuralParticipantRows(eventId);
});

async function assertConfirmedEventVoter(user, event) {
  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem votar neste evento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(ownRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes com inscricao confirmada podem votar.'
    );
  }

  return ownRegistration;
}

async function voterHasEventMuralVotes(eventId, voterId, period) {
  const voter = Parse.User.createWithoutData(voterId);
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  query.equalTo('scopeId', eventId);
  query.equalTo('voter', voter);
  query.equalTo('period', period);
  query.limit(1);
  return !!(await query.first({ useMasterKey: true }));
}

async function createEventMuralVoteForTarget(user, event, eventId, period, entry) {
  const registrationId = entry.registrationId ? String(entry.registrationId) : '';
  const targetRole = entry.targetRole ? String(entry.targetRole) : '';
  const score = Number(entry.score);

  if (!registrationId || !targetRole) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'registrationId e targetRole sao obrigatorios.'
    );
  }

  if (Number.isNaN(score) || score < 0 || score > 10) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'A nota deve ser entre 0 e 10.');
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .include('user')
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  const resolved = await resolveRegistrationParticipantUserId(registration);
  if (!resolved.userId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nao foi possivel identificar o participante desta inscricao.'
    );
  }

  assertNotSelfMuralVote(user.id, resolved.userId);

  if (resolved.shouldSave) {
    await registration.save(null, { useMasterKey: true });
  }

  const athleteProfileResult = await resolveRegistrationAthleteProfile(registration);
  const athlete = athleteProfileResult.athlete;
  if (athleteProfileResult.shouldSave) {
    await registration.save(null, { useMasterKey: true });
  }

  const registrationRole = registration.get('role') || 'athlete';
  const position =
    registration.get('primaryPosition') ||
    (athlete && athlete.get ? athlete.get('primaryPosition') : '');

  if (!MURAL_TARGET_ROLES.includes(targetRole)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Papel de votacao invalido.');
  }

  let effectiveTargetRole = targetRole;
  if (registrationRole === 'goalkeeper' || isGoalkeeperPosition(position)) {
    effectiveTargetRole = 'goalkeeper';
  } else if (registrationRole === 'athlete') {
    effectiveTargetRole = 'athlete';
  } else if (registrationRole === 'fan' || registrationRole === 'gatekeeper') {
    effectiveTargetRole = registrationRole;
  } else if (MURAL_TARGET_ROLES.includes(registrationRole)) {
    effectiveTargetRole = registrationRole;
  }

  if (effectiveTargetRole !== targetRole && registrationRole !== 'athlete') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'O papel da votacao nao corresponde ao perfil do participante.'
    );
  }

  const voter = Parse.User.createWithoutData(user.id);
  const targetUser = Parse.User.createWithoutData(resolved.userId);

  if (effectiveTargetRole === 'goalkeeper') {
    const legacyAthleteVoteQuery = new Parse.Query('MuralVote');
    legacyAthleteVoteQuery.equalTo('scope', 'event');
    legacyAthleteVoteQuery.equalTo('scopeId', eventId);
    legacyAthleteVoteQuery.equalTo('voter', voter);
    legacyAthleteVoteQuery.equalTo('targetUser', targetUser);
    legacyAthleteVoteQuery.equalTo('targetRole', 'athlete');
    legacyAthleteVoteQuery.equalTo('period', period);
    const legacyAthleteVote = await legacyAthleteVoteQuery.first({ useMasterKey: true });
    if (legacyAthleteVote) {
      await legacyAthleteVote.destroy({ useMasterKey: true });
    }
  }

  const existingQuery = new Parse.Query('MuralVote');
  existingQuery.equalTo('scope', 'event');
  existingQuery.equalTo('scopeId', eventId);
  existingQuery.equalTo('voter', voter);
  existingQuery.equalTo('targetUser', targetUser);
  existingQuery.equalTo('targetRole', effectiveTargetRole);
  existingQuery.equalTo('period', period);
  const existing = await existingQuery.first({ useMasterKey: true });
  if (existing) {
    return {
      objectId: existing.id,
      targetUserId: resolved.userId,
      targetRole: effectiveTargetRole,
      alreadyExisted: true,
    };
  }

  const vote = new Parse.Object('MuralVote');
  vote.set('scope', 'event');
  vote.set('scopeId', eventId);
  vote.set('voter', voter);
  vote.set('targetUser', targetUser);
  vote.set('targetRole', effectiveTargetRole);
  vote.set('score', score);
  vote.set('period', period);
  applyEventMuralVoteSnapshot(vote, registration, resolved.userId);
  vote.setACL(buildMuralVoteACL(user.id));
  await vote.save(null, { useMasterKey: true });
  return {
    objectId: vote.id,
    targetUserId: resolved.userId,
    targetRole: effectiveTargetRole,
    alreadyExisted: false,
  };
}

Parse.Cloud.define('submitEventMuralBallot', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const period = request.params.period ? String(request.params.period) : eventId;
  const entries = Array.isArray(request.params.votes) ? request.params.votes : [];

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  if (!entries.length) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Atribua nota de 0 a 10 para ao menos um participante.'
    );
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  assertEventVotingWindowOpen(event);
  await assertConfirmedEventVoter(user, event);

  if (await voterHasEventMuralVotes(eventId, user.id, period)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Sua votacao ja foi registrada e nao pode ser alterada.'
    );
  }

  const created = [];
  const seenTargets = new Set();
  for (const entry of entries.slice(0, 200)) {
    const result = await createEventMuralVoteForTarget(user, event, eventId, period, entry);
    const dedupeKey = result.targetUserId + ':' + result.targetRole;
    if (seenTargets.has(dedupeKey)) continue;
    seenTargets.add(dedupeKey);
    if (!result.alreadyExisted) created.push(result.objectId);
  }

  return { ok: true, voteCount: created.length, objectIds: created };
});

Parse.Cloud.define('castEventMuralVote', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const period = request.params.period ? String(request.params.period) : eventId;

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  assertEventVotingWindowOpen(event);
  await assertConfirmedEventVoter(user, event);

  if (await voterHasEventMuralVotes(eventId, user.id, period)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Sua votacao ja foi registrada e nao pode ser alterada.'
    );
  }

  const result = await createEventMuralVoteForTarget(user, event, eventId, period, request.params);
  return { ok: true, objectId: result.objectId };
});

// Permissoes de classes e backfills
async function updateClassCLP(className, clp) {
  const schema = new Parse.Schema(className);
  schema.setCLP(clp);
  await schema.update();
}

Parse.Cloud.define('configureMuralClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authReadWrite = { requiresAuthentication: true };
  const authRead = { requiresAuthentication: true };
  const authAddField = { requiresAuthentication: true };

  await updateClassCLP('EventRegistration', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('MuralVote', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('EventPerformance', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('FanPrediction', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('AthleteProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('RoleProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('FanProfile', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('RefereeInvitation', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('Event', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: authReadWrite,
    update: authReadWrite,
    delete: authReadWrite,
    addField: authAddField,
    protectedFields: {},
  });

  await updateClassCLP('_User', {
    find: authRead,
    get: authRead,
    count: authRead,
    create: { '*': true },
    update: { requiresAuthentication: true },
    addField: authAddField,
    protectedFields: {
      email: [],
      authData: [],
    },
  });

  const performanceAclUpdated = await backfillEventPerformanceACLs();
  const roleProfileAclUpdated = await backfillRoleProfileHiringACLs();

  return {
    ok: true,
    performanceAclUpdated,
    roleProfileAclUpdated,
    message:
      'CLP atualizado para mural, contratacoes e busca de perfis (AthleteProfile, RoleProfile, FanProfile, EventRegistration, RefereeInvitation, Event, EventPerformance).',
  };
});

async function backfillRoleProfileHiringACLs() {
  let updated = 0;
  let skip = 0;
  const batchSize = 100;

  while (true) {
    const batch = await new Parse.Query('RoleProfile')
      .skip(skip)
      .limit(batchSize)
      .find({ useMasterKey: true });
    if (!batch.length) break;

    for (const profile of batch) {
      const user = profile.get('user');
      if (user && user.id && !profile.get('userId')) {
        profile.set('userId', user.id);
      }
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(true);
      if (user && user.id) {
        acl.setWriteAccess(user, true);
      }
      profile.setACL(acl);
    }

    await Parse.Object.saveAll(batch, { useMasterKey: true });
    updated += batch.length;
    skip += batch.length;
    if (batch.length < batchSize) break;
  }

  return updated;
}

async function backfillEventPerformanceACLs() {
  let updated = 0;
  let skip = 0;
  const batchSize = 100;

  while (true) {
    const query = new Parse.Query('EventPerformance');
    query.limit(batchSize);
    query.skip(skip);
    const rows = await query.find({ useMasterKey: true });
    if (!rows.length) break;

    const toSave = [];
    for (const perf of rows) {
      ensureEventPerformanceReadACL(perf);
      toSave.push(perf);
    }
    if (toSave.length) {
      await Parse.Object.saveAll(toSave, { useMasterKey: true });
      updated += toSave.length;
    }

    if (rows.length < batchSize) break;
    skip += batchSize;
  }

  return updated;
}

Parse.Cloud.define('backfillEventPerformanceACLs', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const updated = await backfillEventPerformanceACLs();
  return { ok: true, updated };
});

Parse.Cloud.define('backfillEventMuralVoteSnapshots', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const query = new Parse.Query('MuralVote');
  query.equalTo('scope', 'event');
  if (eventId) {
    query.equalTo('scopeId', eventId);
  }
  query.limit(3000);
  const votes = await query.find({ useMasterKey: true });

  const eventIds = eventId
    ? [eventId]
    : [...new Set(votes.map((vote) => vote.get('scopeId')).filter(Boolean))];

  let updated = 0;
  for (const id of eventIds) {
    const scopedVotes = votes.filter((vote) => vote.get('scopeId') === id);
    const before = scopedVotes.filter((vote) => !vote.get('targetDisplayName')).length;
    await backfillEventMuralVoteSnapshots(scopedVotes, id);
    const after = scopedVotes.filter((vote) => !vote.get('targetDisplayName')).length;
    updated += Math.max(0, before - after);
  }

  return {
    ok: true,
    eventsProcessed: eventIds.length,
    votesScanned: votes.length,
    votesUpdated: updated,
  };
});

// Analytics de performance
function buildPerformanceTopEntries(performances, field, topN = 3) {
  const byUser = new Map();
  for (const perf of performances) {
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;
    let value = 0;
    if (field === 'goals') {
      // Reflete sumula do arbitro assim que salva (refereeGoals com prioridade).
      value = resolveEffectiveGoalsForCounting(perf, 'referee');
    } else if (field === 'totalShots') {
      const stats = mapPerformanceToScoutStats(perf);
      value = Number(stats.shotsOnTarget || 0) + Number(stats.shotsOffTarget || 0);
    } else {
      const stats = mapPerformanceToScoutStats(perf);
      value = Number(stats[field] || 0);
    }
    if (!value) continue;
    byUser.set(userId, (byUser.get(userId) || 0) + value);
  }
  return Array.from(byUser.entries())
    .map(([userId, total]) => ({ userId, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

async function enrichMuralPerformanceAnalytics(scope, scopeId, analytics) {
  const userIds = new Set();
  const collectIds = (entries) => {
    for (const entry of entries || []) {
      if (entry && entry.userId) userIds.add(entry.userId);
    }
  };

  collectIds(analytics.qualitative && analytics.qualitative.shotsOnTarget);
  collectIds(analytics.qualitative && analytics.qualitative.totalShots);
  collectIds(analytics.qualitative && analytics.qualitative.assists);
  collectIds(analytics.quantitative && analytics.quantitative.totalShots);
  collectIds(analytics.quantitative && analytics.quantitative.passesCompleted);
  collectIds(analytics.quantitative && analytics.quantitative.foulsSuffered);
  collectIds(analytics.quantitative && analytics.quantitative.foulsCommitted);
  collectIds(analytics.quantitative && analytics.quantitative.passesMissed);

  if (!userIds.size) return analytics;

  const idList = Array.from(userIds);
  const users = [];
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn('objectId', batch);
    userQuery.limit(100);
    users.push(...(await userQuery.find({ useMasterKey: true })));
  }
  const userById = new Map(users.map((user) => [user.id, user]));

  const registrationNames = new Map();
  const registrationAvatars = new Map();

  if (scope === 'event' && scopeId) {
    const event = Parse.Object.extend('Event').createWithoutData(scopeId);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .include('user')
      .limit(500)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
      const displayName =
        apelido ||
        (registration.get('userDisplayName') || '').trim() ||
        (registration.get('userFullName') || '').trim();
      if (displayName) registrationNames.set(resolved.userId, displayName);
      const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
      if (avatarUrl) registrationAvatars.set(resolved.userId, avatarUrl);
    }
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .limit(500)
      .find({ useMasterKey: true });
    for (const event of events) {
      const registrations = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .include('user')
        .limit(500)
        .find({ useMasterKey: true });
      for (const registration of registrations) {
        const resolved = await resolveRegistrationParticipantUserId(registration);
        if (!resolved.userId) continue;
        const apelido = (registration.get('apelido') || registration.get('userApelido') || '').trim();
        const displayName =
          apelido ||
          (registration.get('userDisplayName') || '').trim() ||
          (registration.get('userFullName') || '').trim();
        if (displayName && !registrationNames.has(resolved.userId)) {
          registrationNames.set(resolved.userId, displayName);
        }
        const avatarUrl = resolveStoredAvatarUrl(registration.get('user'), registration);
        if (avatarUrl && !registrationAvatars.has(resolved.userId)) {
          registrationAvatars.set(resolved.userId, avatarUrl);
        }
      }
    }
  }

  const profileByUserId = new Map();
  for (let i = 0; i < idList.length; i += 100) {
    const batch = idList.slice(i, i + 100);
    const profileQuery = new Parse.Query('AthleteProfile');
    profileQuery.containedIn(
      'user',
      batch.map((id) => Parse.User.createWithoutData(id))
    );
    profileQuery.limit(100);
    const profiles = await profileQuery.find({ useMasterKey: true });
    for (const profile of profiles) {
      const user = profile.get('user');
      const userId = user && user.id ? user.id : profile.get('userId');
      if (userId) profileByUserId.set(String(userId), profile);
    }
  }

  const enrichEntry = (entry) => {
    if (!entry || !entry.userId) return entry;
    const user = userById.get(entry.userId);
    const profile = profileByUserId.get(entry.userId);
    const apelido =
      registrationNames.get(entry.userId) ||
      (user && user.get ? (user.get('apelido') || '').trim() : '') ||
      (profile && profile.get ? (profile.get('userApelido') || '').trim() : '') ||
      '';
    const fullName =
      (user && user.get ? (user.get('name') || '').trim() : '') ||
      (profile && profile.get ? (profile.get('userName') || '').trim() : '') ||
      (user && user.getUsername ? user.getUsername() : '') ||
      '';
    const userName = apelido || fullName || entry.userId;
    const avatarUrl =
      registrationAvatars.get(entry.userId) ||
      resolveStoredAvatarUrl(user) ||
      (profile && profile.get ? profile.get('userAvatarUrl') : undefined) ||
      entry.avatarUrl;
    return {
      ...entry,
      userName,
      apelido: apelido || undefined,
      avatarUrl: avatarUrl || undefined,
      primaryPosition: profile && profile.get ? profile.get('primaryPosition') || undefined : undefined,
      footPreference: profile && profile.get ? profile.get('footPreference') || undefined : undefined,
    };
  };

  const enrichList = (entries) => (entries || []).map(enrichEntry);

  return {
    ...analytics,
    qualitative: {
      shotsOnTarget: enrichList(analytics.qualitative && analytics.qualitative.shotsOnTarget),
      totalShots: enrichList(analytics.qualitative && analytics.qualitative.totalShots),
      assists: enrichList(analytics.qualitative && analytics.qualitative.assists),
    },
    quantitative: {
      totalShots: enrichList(analytics.quantitative && analytics.quantitative.totalShots),
      passesCompleted: enrichList(analytics.quantitative && analytics.quantitative.passesCompleted),
      foulsSuffered: enrichList(analytics.quantitative && analytics.quantitative.foulsSuffered),
      foulsCommitted: enrichList(analytics.quantitative && analytics.quantitative.foulsCommitted),
      passesMissed: enrichList(analytics.quantitative && analytics.quantitative.passesMissed),
    },
  };
}

Parse.Cloud.define('getMuralPerformanceAnalytics', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const performances = await loadMuralPerformanceRows(scope, scopeId);

  let totalShotsOn = 0;
  let totalShotsOff = 0;
  let totalGoals = 0;
  let totalPassesOk = 0;
  let totalPassesMiss = 0;
  let totalFouls = 0;
  const athleteIds = new Set();

  for (const perf of performances) {
    const userId = getPerformanceParticipantId(perf);
    if (userId) athleteIds.add(userId);
    const stats = mapPerformanceToScoutStats(perf);
    totalShotsOn += Number(stats.shotsOnTarget || 0);
    totalShotsOff += Number(stats.shotsOffTarget || 0);
    totalGoals += Number(stats.goals || 0);
    totalPassesOk += Number(stats.passesCompleted || 0);
    totalPassesMiss += Number(stats.passesMissed || 0);
    totalFouls += Number(stats.foulsCommitted || 0);
  }

  const totalShots = totalShotsOn + totalShotsOff;
  const totalPasses = totalPassesOk + totalPassesMiss;

  const analytics = {
    qualitative: {
      shotsOnTarget: buildPerformanceTopEntries(performances, 'shotsOnTarget'),
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      assists: buildPerformanceTopEntries(performances, 'assists'),
    },
    quantitative: {
      totalShots: buildPerformanceTopEntries(performances, 'totalShots'),
      passesCompleted: buildPerformanceTopEntries(performances, 'passesCompleted'),
      foulsSuffered: buildPerformanceTopEntries(performances, 'foulsSuffered'),
      foulsCommitted: buildPerformanceTopEntries(performances, 'foulsCommitted'),
      passesMissed: buildPerformanceTopEntries(performances, 'passesMissed'),
    },
    charts: {
      shotsOnTarget: totalShotsOn,
      shotsOffTarget: totalShotsOff,
      goals: totalGoals,
      totalShots,
      totalPasses,
      passesCompleted: totalPassesOk,
      shotAccuracyPct: totalShots ? Math.round((totalShotsOn / totalShots) * 100) : 0,
      goalConversionPct: totalShotsOn ? Math.round((totalGoals / totalShotsOn) * 100) : 0,
      passAccuracyPct: totalPasses ? Math.round((totalPassesOk / totalPasses) * 100) : 0,
      foulsCommitted: totalFouls,
      athleteCount: athleteIds.size,
    },
  };

  return enrichMuralPerformanceAnalytics(scope, scopeId, analytics);
});

// --- 07b-mural-highlight-tenure.js ---

/** Tempo no destaque do mural App (Geral / Peladas / Confrontos). */

const MURAL_TENURE_BUCKETS = new Set(['merged', 'pelada', 'team_match']);

const MURAL_SINGLE_HIGHLIGHT_KEYS = new Set([
  'craque',
  'melhor_goleiro',
  'melhor_juiz',
  'time_mais_amado',
  'promessa',
  'master',
]);

function normalizeMuralTenureHolderKey(value) {
  return String(value || '').trim();
}

function muralTenureRowIdentity(highlightKey, holderKey) {
  return `${highlightKey}::${holderKey}`;
}

Parse.Cloud.define('syncMuralHighlightTenures', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Faca login para sincronizar destaques.');
  }

  const bucket = String(request.params.bucket || '').trim();
  if (!MURAL_TENURE_BUCKETS.has(bucket)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'bucket invalido.');
  }

  const holders = request.params.holders;
  if (!holders || typeof holders !== 'object') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'holders obrigatorio.');
  }

  const now = new Date();
  const Tenure = Parse.Object.extend('MuralHighlightTenure');

  const existingQuery = new Parse.Query(Tenure);
  existingQuery.equalTo('bucket', bucket);
  existingQuery.limit(1000);
  const existingRows = await existingQuery.find({ useMasterKey: true });

  const existingByIdentity = new Map();
  for (const row of existingRows) {
    const highlightKey = String(row.get('highlightKey') || '').trim();
    const holderKey = normalizeMuralTenureHolderKey(row.get('holderKey'));
    if (!highlightKey || !holderKey) continue;
    existingByIdentity.set(muralTenureRowIdentity(highlightKey, holderKey), row);
  }

  const holderKeysSent = Object.keys(holders);
  const desiredIdentities = new Set();
  const tenures = {};

  for (const highlightKey of holderKeysSent) {
    const hk = String(highlightKey || '').trim();
    if (!hk) continue;
    const rawHolder = holders[hk];
    const holderKey = normalizeMuralTenureHolderKey(rawHolder);

    if (!holderKey) {
      for (const row of existingRows) {
        if (String(row.get('highlightKey') || '').trim() !== hk) continue;
        await row.destroy({ useMasterKey: true });
        const rowHolder = normalizeMuralTenureHolderKey(row.get('holderKey'));
        existingByIdentity.delete(muralTenureRowIdentity(hk, rowHolder));
      }
      continue;
    }

    desiredIdentities.add(muralTenureRowIdentity(hk, holderKey));

    if (MURAL_SINGLE_HIGHLIGHT_KEYS.has(hk)) {
      for (const row of existingRows) {
        const rowHk = String(row.get('highlightKey') || '').trim();
        if (rowHk !== hk) continue;
        const rowHolder = normalizeMuralTenureHolderKey(row.get('holderKey'));
        if (rowHolder === holderKey) continue;
        await row.destroy({ useMasterKey: true });
        existingByIdentity.delete(muralTenureRowIdentity(hk, rowHolder));
      }
    }

    let row = existingByIdentity.get(muralTenureRowIdentity(hk, holderKey));
    if (!row) {
      row = new Tenure();
      row.set('bucket', bucket);
      row.set('highlightKey', hk);
      row.set('holderKey', holderKey);
      row.set('sinceAt', now);
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(false);
      acl.setPublicWriteAccess(false);
      row.setACL(acl);
      await row.save(null, { useMasterKey: true });
      existingByIdentity.set(muralTenureRowIdentity(hk, holderKey), row);
    }

    const sinceAt = row.get('sinceAt');
    if (sinceAt instanceof Date) {
      tenures[hk] = { sinceAt: sinceAt.toISOString(), holderKey };
    }
  }

  for (const row of existingRows) {
    const highlightKey = String(row.get('highlightKey') || '').trim();
    const holderKey = normalizeMuralTenureHolderKey(row.get('holderKey'));
    if (!highlightKey || !holderKey) continue;
    const identity = muralTenureRowIdentity(highlightKey, holderKey);
    if (desiredIdentities.has(identity)) continue;

    if (highlightKey.startsWith('goleador:')) {
      if (!Object.prototype.hasOwnProperty.call(holders, highlightKey)) {
        await row.destroy({ useMasterKey: true });
      }
    }
  }

  return { tenures };
});

Parse.Cloud.define('configureMuralHighlightTenurePermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const className = 'MuralHighlightTenure';
  const schema = new Parse.Schema(className);
  schema.addString('bucket');
  schema.addString('highlightKey');
  schema.addString('holderKey');
  schema.addDate('sinceAt');
  schema.setCLP({
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: {},
    protectedFields: {},
  });

  let created = false;
  try {
    await schema.update();
  } catch {
    await schema.save();
    created = true;
  }

  return { ok: true, className, created, updated: !created };
});

// --- 08-scout-referee-performance.js ---

/** Scout, sumula do juiz, predicoes e dashboard de performance */

/** Scout, sumula do juiz, predicoes e dashboard de performance */

// Janela de apontamento e sumula
function isEventEndedForTools(event, now = new Date()) {
  if (event.get('isFinished')) return true;
  const endTime = event.get('endTime');
  return endTime instanceof Date && !Number.isNaN(endTime.getTime()) && now > endTime;
}

function isWithinApontamentoWindow(event, fieldPrefix, now = new Date()) {
  const opensAt = event.get(`${fieldPrefix}OpensAt`);
  const closesAt = event.get(`${fieldPrefix}ClosesAt`);
  if (!opensAt && !closesAt) return true;
  if (opensAt && now < opensAt) return false;
  if (closesAt && now > closesAt) return false;
  return true;
}

function assertWithinApontamentoWindow(event, fieldPrefix, label) {
  const opensAt = event.get(`${fieldPrefix}OpensAt`);
  const closesAt = event.get(`${fieldPrefix}ClosesAt`);
  if (!opensAt && !closesAt) return;
  const now = new Date();
  if (opensAt && now < opensAt) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `${label} ainda nao esta disponivel.`
    );
  }
  if (closesAt && now > closesAt) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      `Periodo de ${label} encerrado.`
    );
  }
}

// ACL e persistencia de EventPerformance
function buildEventPerformanceReadACL() {
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setPublicWriteAccess(false);
  return acl;
}

function ensureEventPerformanceReadACL(perf) {
  if (!perf || !perf.setACL) return;
  perf.setACL(buildEventPerformanceReadACL());
}

async function saveEventPerformance(perf) {
  ensureEventPerformanceReadACL(perf);
  return perf.save(null, { useMasterKey: true });
}

// Scout, sumula, predicoes e dashboard do atleta
const SCOUT_APONTAMENTO_FIELDS = [
  'shotsOffTarget',
  'shotsOnTarget',
  'foulsCommitted',
  'foulsCommittedGame',
  'foulsCommittedPenalty',
  'foulsSuffered',
  'foulsSufferedGame',
  'foulsSufferedPenalty',
  'goals',
  'ownGoals',
  'assists',
  'passesCompleted',
  'passesMissed',
  'yellowCards',
  'redCards',
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
  'penaltiesCommitted',
  'penaltiesSuffered',
  'saves',
  'savesPenalty',
  'savesFreeKick',
  'savesOpenPlay',
  'goalsConceded',
  'goalsConcededPenalty',
  'goalsConcededFreeKick',
  'goalsConcededOpenPlay',
  'gkAssistsHand',
  'gkAssistsFeet',
];

const SCOUT_DERIVED_TOTAL_FIELDS = [
  'goals',
  'foulsCommitted',
  'foulsSuffered',
  'saves',
  'goalsConceded',
];

const SCOUT_GOAL_TYPE_FIELDS = [
  'goalsHeader',
  'goalsFreeKick',
  'goalsRightFoot',
  'goalsLeftFoot',
  'goalsOlympic',
  'goalsCrazy',
  'goalsPenalty',
];

const SCOUT_OVERLAP_STORAGE_FIELDS = {
  goals: 'scoutGoals',
  foulsCommitted: 'scoutFoulsCommitted',
  yellowCards: 'scoutYellowCards',
  redCards: 'scoutRedCards',
};

const REFEREE_OVERLAP_STORAGE_FIELDS = {
  goals: 'refereeGoals',
  foulsCommitted: 'refereeFoulsCommitted',
  yellowCards: 'refereeYellowCards',
  redCards: 'refereeRedCards',
};

function normalizeStatsConflictSource(value) {
  return value === 'scout' ? 'scout' : 'referee';
}

async function loadPeladaStatsConflictSource(peladaId) {
  if (!peladaId) return 'referee';
  try {
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    return normalizeStatsConflictSource(pelada.get('statsConflictSource'));
  } catch {
    return 'referee';
  }
}

async function buildPeladaStatsConflictMapFromPerformances(performances) {
  const peladaIds = new Set();
  for (const perf of performances) {
    const pelada = perf.get('pelada');
    if (pelada && pelada.id) {
      peladaIds.add(pelada.id);
    }
  }
  if (!peladaIds.size) {
    return new Map();
  }

  const query = new Parse.Query('Pelada');
  query.containedIn('objectId', Array.from(peladaIds));
  const peladas = await query.find({ useMasterKey: true });
  const map = new Map();
  for (const pelada of peladas) {
    map.set(pelada.id, normalizeStatsConflictSource(pelada.get('statsConflictSource')));
  }
  return map;
}

function collectPerformanceParticipantKeys(perf) {
  const keys = [];
  const participantId = perf.get('participantUserId');
  if (participantId) {
    keys.push(String(participantId));
  }
  const user = perf.get('user');
  if (user && user.id) {
    keys.push(String(user.id));
  }
  return keys;
}

function hasSplitScoutRefereeStats(perf) {
  if (!perf) return false;
  return (
    perf.get('scoutGoals') !== undefined ||
    perf.get('refereeGoals') !== undefined ||
    perf.get('scoutFoulsCommitted') !== undefined ||
    perf.get('refereeFoulsCommitted') !== undefined
  );
}

function readScoutOverlapStat(perf, field) {
  const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    return Number(perf.get(field) || 0);
  }
  const explicit = perf.get(storageField);
  if (explicit !== undefined && explicit !== null) {
    return Number(explicit) || 0;
  }
  return Number(perf.get(field) || 0);
}

function readRefereeOverlapStat(perf, field) {
  const storageField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    return 0;
  }
  const explicit = perf.get(storageField);
  if (explicit !== undefined && explicit !== null) {
    return Number(explicit) || 0;
  }
  if (field === 'foulsCommitted') {
    return Number(perf.get('fouls') || perf.get('foulsCommitted') || 0);
  }
  return Number(perf.get(field) || 0);
}

function resolveEffectivePerformanceStats(perf, priority) {
  if (!perf) {
    return {
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      foulsCommitted: 0,
    };
  }

  const useReferee = normalizeStatsConflictSource(priority) === 'referee';

  function pickOverlap(field) {
    const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field];
    const refereeField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
    const hasScoutExplicit =
      storageField &&
      perf.get(storageField) !== undefined &&
      perf.get(storageField) !== null;
    const hasRefereeExplicit =
      refereeField &&
      perf.get(refereeField) !== undefined &&
      perf.get(refereeField) !== null;

    if (hasScoutExplicit || hasRefereeExplicit) {
      return useReferee ? readRefereeOverlapStat(perf, field) : readScoutOverlapStat(perf, field);
    }
    return Number(perf.get(field) || 0);
  }

  return {
    goals: pickOverlap('goals'),
    assists: Number(perf.get('assists') || 0),
    saves: Number(perf.get('saves') || 0),
    yellowCards: pickOverlap('yellowCards'),
    redCards: pickOverlap('redCards'),
    foulsCommitted: pickOverlap('foulsCommitted'),
  };
}

function resolvePerformanceStatsPriority(perf, conflictMap, scopeDefaultPriority) {
  if (scopeDefaultPriority) {
    return normalizeStatsConflictSource(scopeDefaultPriority);
  }
  const pelada = perf.get('pelada');
  const peladaId = pelada && pelada.id ? pelada.id : '';
  if (peladaId && conflictMap.has(peladaId)) {
    return conflictMap.get(peladaId);
  }
  return 'referee';
}

function computeEffectivePerformanceScore(perf, priority) {
  const effective = resolveEffectivePerformanceStats(perf, priority);
  const points = Number(perf.get('points') || 0);
  return (
    points +
    effective.goals * 3 +
    effective.assists * 2 +
    effective.saves * 2 -
    effective.yellowCards -
    effective.redCards * 3
  );
}

function mergeScoutApontamentoStatObjects(base, incoming) {
  const result = { ...base };
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    result[field] = Math.max(Number(base[field] || 0), Number(incoming[field] || 0));
  }
  return result;
}

function buildMergedScoutStatsByParticipantId(performances) {
  const byId = new Map();
  for (const perf of performances) {
    const stats = mapPerformanceToScoutStats(perf);
    const keys = collectPerformanceParticipantKeys(perf);
    for (const key of keys) {
      const existing = byId.get(key);
      byId.set(key, existing ? mergeScoutApontamentoStatObjects(existing, stats) : stats);
    }
  }
  return byId;
}

function mergeRefereeSumulaStatObjects(base, incoming) {
  return {
    goals: Math.max(Number(base.goals || 0), Number(incoming.goals || 0)),
    goalsConceded: Math.max(Number(base.goalsConceded || 0), Number(incoming.goalsConceded || 0)),
    fouls: Math.max(Number(base.fouls || 0), Number(incoming.fouls || 0)),
    yellowCards: Math.max(Number(base.yellowCards || 0), Number(incoming.yellowCards || 0)),
    redCards: Math.max(Number(base.redCards || 0), Number(incoming.redCards || 0)),
    penaltiesCommitted: Math.max(
      Number(base.penaltiesCommitted || 0),
      Number(incoming.penaltiesCommitted || 0)
    ),
    penaltiesSuffered: Math.max(
      Number(base.penaltiesSuffered || 0),
      Number(incoming.penaltiesSuffered || 0)
    ),
    observation: base.observation || incoming.observation || '',
  };
}

function performanceHasRefereeSumulaData(perf) {
  if (!perf) return false;
  if (perf.get('refereeSumulaSaved')) return true;
  return (
    readRefereeOverlapStat(perf, 'goals') > 0 ||
    Number(perf.get('refereeGoalsConceded') || 0) > 0 ||
    readRefereeOverlapStat(perf, 'foulsCommitted') > 0 ||
    readRefereeOverlapStat(perf, 'yellowCards') > 0 ||
    readRefereeOverlapStat(perf, 'redCards') > 0 ||
    Number(perf.get('penaltiesCommitted') || 0) > 0 ||
    Number(perf.get('penaltiesSuffered') || 0) > 0 ||
    !!String(perf.get('refereeObservation') || '').trim()
  );
}

function buildMergedRefereeStatsByParticipantId(performances) {
  const byId = new Map();
  for (const perf of performances) {
    if (!performanceHasRefereeSumulaData(perf)) continue;
    const stats = mapPerformanceToRefereeSumula(perf);
    const keys = collectPerformanceParticipantKeys(perf);
    for (const key of keys) {
      const existing = byId.get(key);
      byId.set(key, existing ? mergeRefereeSumulaStatObjects(existing, stats) : stats);
    }
  }
  return byId;
}

function performanceStatTotal(perf) {
  if (!perf) return 0;
  const stats = mapPerformanceToScoutStats(perf);
  let total = 0;
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals' || SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
      continue;
    }
    total += Number(stats[field] || 0);
  }
  total += Number(stats.goals || 0);
  total += Number(perf.get('saves') || 0);
  return total;
}

function mergePerformanceParseObjects(target, source) {
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    target.set(field, Math.max(Number(target.get(field) || 0), Number(source.get(field) || 0)));
  }
  for (const storageField of Object.values(SCOUT_OVERLAP_STORAGE_FIELDS)) {
    target.set(
      storageField,
      Math.max(Number(target.get(storageField) || 0), Number(source.get(storageField) || 0))
    );
  }
  for (const storageField of Object.values(REFEREE_OVERLAP_STORAGE_FIELDS)) {
    target.set(
      storageField,
      Math.max(Number(target.get(storageField) || 0), Number(source.get(storageField) || 0))
    );
  }
  target.set('saves', Math.max(Number(target.get('saves') || 0), Number(source.get('saves') || 0)));
  target.set('assists', Math.max(Number(target.get('assists') || 0), Number(source.get('assists') || 0)));

  const observation = source.get('refereeObservation');
  if (observation && !target.get('refereeObservation')) {
    target.set('refereeObservation', observation);
  }
}

async function findAllEventPerformancesForParticipant(event, athleteUserId) {
  const matches = new Map();

  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('event', event);
  byParticipant.equalTo('participantUserId', athleteUserId);
  const byParticipantRows = await byParticipant.find({ useMasterKey: true });
  for (const perf of byParticipantRows) {
    matches.set(perf.id, perf);
  }

  if (!String(athleteUserId).startsWith('anon_')) {
    const byUser = new Parse.Query('EventPerformance');
    byUser.equalTo('event', event);
    byUser.equalTo('user', Parse.User.createWithoutData(athleteUserId));
    const byUserRows = await byUser.find({ useMasterKey: true });
    for (const perf of byUserRows) {
      matches.set(perf.id, perf);
    }
  }

  return Array.from(matches.values());
}

function emptyScoutApontamentoStats() {
  const stats = {};
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    stats[field] = 0;
  }
  return stats;
}

function syncScoutGoalsFromTypes(perf) {
  if (!perf || !perf.set) return 0;
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(perf.get(field) || 0);
  }
  perf.set('goals', total);
  perf.set('scoutGoals', total);
  return total;
}

function syncScoutDerivedStats(perf) {
  if (!perf || !perf.set) return;
  const foulsCommitted =
    Number(perf.get('foulsCommittedGame') || 0) + Number(perf.get('foulsCommittedPenalty') || 0);
  const foulsSuffered =
    Number(perf.get('foulsSufferedGame') || 0) + Number(perf.get('foulsSufferedPenalty') || 0);
  perf.set('foulsCommitted', foulsCommitted);
  perf.set('scoutFoulsCommitted', foulsCommitted);
  perf.set('foulsSuffered', foulsSuffered);

  const saves =
    Number(perf.get('savesPenalty') || 0) +
    Number(perf.get('savesFreeKick') || 0) +
    Number(perf.get('savesOpenPlay') || 0);
  perf.set('saves', saves);

  const goalsConceded =
    Number(perf.get('goalsConcededPenalty') || 0) +
    Number(perf.get('goalsConcededFreeKick') || 0) +
    Number(perf.get('goalsConcededOpenPlay') || 0);
  perf.set('goalsConceded', goalsConceded);

  const gkAssists = Number(perf.get('gkAssistsHand') || 0) + Number(perf.get('gkAssistsFeet') || 0);
  if (gkAssists > 0) {
    perf.set('assists', Math.max(Number(perf.get('assists') || 0), gkAssists));
  }
}

/** Soma stats sem contar gols duas vezes (goals ja e a soma dos tipos). */
function accumulateScoutStatsTotals(totals, stats) {
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals' || SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
      continue;
    }
    totals[field] += Number(stats[field] || 0);
  }
  totals.goals += Number(stats.goals || 0);
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    totals[field] += Number(stats[field] || 0);
  }
}

function mapPerformanceToScoutStats(perf) {
  if (!perf) {
    return emptyScoutApontamentoStats();
  }
  const stats = {};
  for (const field of SCOUT_APONTAMENTO_FIELDS) {
    if (field === 'goals') continue;
    if (SCOUT_OVERLAP_STORAGE_FIELDS[field]) {
      stats[field] = readScoutOverlapStat(perf, field);
    } else {
      stats[field] = Number(perf.get(field) || 0);
    }
  }
  stats.goals = sumScoutTypedGoals(stats);
  stats.saves = Number(perf.get('saves') || 0);
  stats.goalsConceded = Number(perf.get('goalsConceded') || 0);
  return stats;
}

function computeScoutGoalsTotalFromPerformance(perf) {
  if (!perf || !perf.get) return 0;
  let total = 0;
  for (const field of SCOUT_GOAL_TYPE_FIELDS) {
    total += Number(perf.get(field) || 0);
  }
  return total;
}

function computeStoredPerformancePoints(perf) {
  const goals = computeScoutGoalsTotalFromPerformance(perf);
  const assists = Number(perf.get('assists') || 0);
  const saves = Number(perf.get('saves') || 0);
  return goals * 3 + assists * 2 + saves * 2;
}

async function assertConfirmedScoutForEvent(user, eventId, allowFinished = false) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const scoutRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'scout')
    .first({ useMasterKey: true });

  if (!scoutRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o scout confirmado neste evento pode registrar apontamento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(scoutRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o scout confirmado neste evento pode registrar apontamento.'
    );
  }

  if (!allowFinished && event.get('isFinished')) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'O evento ja foi encerrado. Apontamento indisponivel.'
    );
  }

  assertWithinApontamentoWindow(event, 'scoutApontamento', 'Apontamento scout');

  return { event, scoutRegistration };
}

function getPerformanceParticipantId(perf) {
  const explicit = perf.get('participantUserId');
  if (explicit) return String(explicit);
  const user = perf.get('user');
  return user && user.id ? String(user.id) : '';
}

async function findEventPerformanceForParticipant(event, athleteUserId, pelada) {
  const matches = await findAllEventPerformancesForParticipant(event, athleteUserId);

  if (!matches.length) {
    const perf = new Parse.Object('EventPerformance');
    perf.set('event', event);
    perf.set('participantUserId', athleteUserId);
    if (!String(athleteUserId).startsWith('anon_')) {
      perf.set('user', Parse.User.createWithoutData(athleteUserId));
    }
    if (pelada) perf.set('pelada', pelada);
    perf.set('role', 'athlete');
    return perf;
  }

  if (matches.length === 1) {
    const perf = matches[0];
    if (!perf.get('participantUserId')) {
      perf.set('participantUserId', athleteUserId);
    }
    if (!perf.get('user') && !String(athleteUserId).startsWith('anon_')) {
      perf.set('user', Parse.User.createWithoutData(athleteUserId));
    }
    if (pelada && !perf.get('pelada')) {
      perf.set('pelada', pelada);
    }
    return perf;
  }

  matches.sort((a, b) => performanceStatTotal(b) - performanceStatTotal(a));
  const canonical = matches[0];
  const duplicates = matches.slice(1);
  for (const duplicate of duplicates) {
    mergePerformanceParseObjects(canonical, duplicate);
  }
  if (!canonical.get('participantUserId')) {
    canonical.set('participantUserId', athleteUserId);
  }
  if (!canonical.get('user') && !String(athleteUserId).startsWith('anon_')) {
    canonical.set('user', Parse.User.createWithoutData(athleteUserId));
  }
  if (pelada && !canonical.get('pelada')) {
    canonical.set('pelada', pelada);
  }
  await saveEventPerformance(canonical);
  for (const duplicate of duplicates) {
    await duplicate.destroy({ useMasterKey: true });
  }
  return canonical;
}

async function assertScoutAthleteAssignment(scoutRegistration, event, athleteUserId) {
  const assigned = scoutRegistration.get('scoutAssignedAthleteUserId');
  if (!assigned) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Selecione um atleta antes de registrar apontamento.'
    );
  }
  if (String(assigned) !== String(athleteUserId)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce so pode apontar o atleta atribuido a voce neste evento.'
    );
  }

  const conflictQuery = new Parse.Query('EventRegistration');
  conflictQuery.equalTo('event', event);
  conflictQuery.equalTo('role', 'scout');
  conflictQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  conflictQuery.notEqualTo('objectId', scoutRegistration.id);
  const conflict = await conflictQuery.first({ useMasterKey: true });
  if (conflict) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }
}

async function assertConfirmedAthleteInEvent(event, athleteUserId) {
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .containedIn('role', ['athlete', 'goalkeeper'])
    .include('user')
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (resolved.userId !== athleteUserId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Atleta ainda nao confirmado neste evento.'
      );
    }
    return registration;
  }

  throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Atleta nao encontrado neste evento.');
}

async function assertCanAccessScoutApontamento(user, eventId) {
  try {
    const result = await assertConfirmedScoutForEvent(user, eventId, true);
    return { ...result, viewOnly: false };
  } catch (scoutError) {
    const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
    const participationFee = Number(event.get('participationFee') || 0);

    const registration = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('user', user)
      .first({ useMasterKey: true });

    if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      throw scoutError;
    }

    const savedPerf = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .equalTo('scoutApontamentoSaved', true)
      .first({ useMasterKey: true });

    if (!savedPerf) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apontamento scout ainda nao disponivel para consulta.'
      );
    }

    return { event, scoutRegistration: null, viewOnly: true };
  }
}

Parse.Cloud.define('eventHasScoutApontamento', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const savedPerf = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .equalTo('scoutApontamentoSaved', true)
    .first({ useMasterKey: true });

  return { hasScoutApontamento: !!savedPerf };
});

Parse.Cloud.define('getScoutApontamentoBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event, scoutRegistration, viewOnly } = await assertCanAccessScoutApontamento(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);
  const locked = !!event.get('isFinished') || viewOnly;
  const assignedAthleteUserId =
    !viewOnly && scoutRegistration && scoutRegistration.get('scoutAssignedAthleteUserId')
      ? String(scoutRegistration.get('scoutAssignedAthleteUserId'))
      : '';

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  const perfStatsByParticipantId = buildMergedScoutStatsByParticipantId(performances);

  const assignedScouts = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'scout')
    .exists('scoutAssignedAthleteUserId')
    .limit(200)
    .find({ useMasterKey: true });
  const assignedAthleteIds = new Set(
    assignedScouts
      .map((row) => row.get('scoutAssignedAthleteUserId'))
      .filter(Boolean)
      .map((value) => String(value))
  );

  const athletes = [];
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;

    const row = mapRegistrationForEventListItem(registration, eventId, participationFee);
    const stats =
      perfStatsByParticipantId.get(resolved.userId) || emptyScoutApontamentoStats();

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: row.avatarUrl || undefined,
      primaryPosition: row.primaryPosition || undefined,
      isAssignedToAnotherScout:
        assignedAthleteIds.has(resolved.userId) && resolved.userId !== assignedAthleteUserId,
      stats,
    });
  }

  athletes.sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));

  const boardAthletes = viewOnly
    ? athletes
    : assignedAthleteUserId
      ? athletes.filter((athlete) => athlete.userId === assignedAthleteUserId)
      : athletes.filter((athlete) => !athlete.isAssignedToAnotherScout);

  return {
    eventId,
    eventName: event.get('name') || 'Evento',
    locked,
    viewOnly,
    assignedAthleteUserId: assignedAthleteUserId || undefined,
    canAssign: !locked && !assignedAthleteUserId && !viewOnly,
    athletes: boardAthletes,
    allAthletes: athletes,
    selectableAthletes: viewOnly || assignedAthleteUserId
      ? []
      : athletes.filter((athlete) => !athlete.isAssignedToAnotherScout),
  };
});

Parse.Cloud.define('assignScoutApontamentoAthlete', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  if (!eventId || !athleteUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e athleteUserId sao obrigatorios.'
    );
  }

  const { event, scoutRegistration } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const existingAssignment = scoutRegistration.get('scoutAssignedAthleteUserId');
  if (existingAssignment && String(existingAssignment) !== athleteUserId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Voce ja esta apontando outro atleta neste evento.'
    );
  }

  const conflictQuery = new Parse.Query('EventRegistration');
  conflictQuery.equalTo('event', event);
  conflictQuery.equalTo('role', 'scout');
  conflictQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  conflictQuery.notEqualTo('objectId', scoutRegistration.id);
  const conflict = await conflictQuery.first({ useMasterKey: true });
  if (conflict) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }

  scoutRegistration.set('scoutAssignedAthleteUserId', athleteUserId);
  await scoutRegistration.save(null, { useMasterKey: true });

  return { ok: true, athleteUserId };
});

Parse.Cloud.define('incrementScoutApontamento', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const field = request.params.field ? String(request.params.field) : '';
  const delta = Number(request.params.delta);

  if (!eventId || !athleteUserId || !field) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, athleteUserId e field sao obrigatorios.'
    );
  }

  if (!SCOUT_APONTAMENTO_FIELDS.includes(field)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de apontamento invalido.');
  }

  if (field === 'goals') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Gol a favor e calculado automaticamente pelos tipos de gol.'
    );
  }

  if (SCOUT_DERIVED_TOTAL_FIELDS.includes(field)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este total e calculado automaticamente pelos subitens.'
    );
  }

  if (delta !== 1 && delta !== -1) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'delta deve ser 1 ou -1.');
  }

  const { event, scoutRegistration } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  // Exclusividade: nao editar atleta ja atribuido a OUTRO scout.
  // Quem tem atleta individual ainda pode usar o modo Geral nos demais livres.
  const exclusiveOwnerQuery = new Parse.Query('EventRegistration');
  exclusiveOwnerQuery.equalTo('event', event);
  exclusiveOwnerQuery.equalTo('role', 'scout');
  exclusiveOwnerQuery.equalTo('scoutAssignedAthleteUserId', athleteUserId);
  exclusiveOwnerQuery.notEqualTo('objectId', scoutRegistration.id);
  const exclusiveOwner = await exclusiveOwnerQuery.first({ useMasterKey: true });
  if (exclusiveOwner) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Outro scout ja esta apontando este atleta neste evento.'
    );
  }

  const pelada = event.get('pelada');
  let perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);

  const storageField = SCOUT_OVERLAP_STORAGE_FIELDS[field] || field;
  let current = Number(perf.get(storageField));
  if (perf.get(storageField) === undefined) {
    current = SCOUT_OVERLAP_STORAGE_FIELDS[field]
      ? readScoutOverlapStat(perf, field)
      : Number(perf.get(field) || 0);
  }
  const next = Math.max(0, current + delta);
  perf.set(storageField, next);
  if (SCOUT_OVERLAP_STORAGE_FIELDS[field]) {
    perf.set(field, next);
  }
  if (SCOUT_GOAL_TYPE_FIELDS.includes(field)) {
    syncScoutGoalsFromTypes(perf);
  }
  syncScoutDerivedStats(perf);
  perf.set('points', computeStoredPerformancePoints(perf));
  perf.set('scoutApontamentoSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToScoutStats(perf),
  };
});

async function loadFinishedEventsForPredictionScope(scope, scopeId) {
  if (scope === 'event' && scopeId) {
    const event = await new Parse.Query('Event').get(scopeId, { useMasterKey: true });
    const ended =
      !!event.get('isFinished') ||
      (event.get('endTime') instanceof Date && event.get('endTime') < new Date());
    return ended ? [event] : [];
  }

  const peladaFilter = scope === 'pelada' && scopeId
    ? Parse.Object.extend('Pelada').createWithoutData(scopeId)
    : null;
  const byId = new Map();

  const finishedQuery = new Parse.Query('Event');
  finishedQuery.equalTo('isFinished', true);
  if (peladaFilter) {
    finishedQuery.equalTo('pelada', peladaFilter);
  }
  finishedQuery.limit(500);
  for (const event of await finishedQuery.find({ useMasterKey: true })) {
    byId.set(event.id, event);
  }

  const endedQuery = new Parse.Query('Event');
  endedQuery.notEqualTo('isFinished', true);
  endedQuery.lessThan('endTime', new Date());
  if (peladaFilter) {
    endedQuery.equalTo('pelada', peladaFilter);
  }
  endedQuery.limit(500);
  for (const event of await endedQuery.find({ useMasterKey: true })) {
    byId.set(event.id, event);
  }

  return Array.from(byId.values());
}

async function buildEventActualPredictionResults(event) {
  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  if (!performances.length) {
    return { ready: false };
  }

  const statsByUser = new Map();
  for (const perf of performances) {
    const participantId = getPerformanceParticipantId(perf);
    if (!participantId) continue;
    const stats = mapPerformanceToScoutStats(perf);
    const refereeStats = mapPerformanceToRefereeSumula(perf);
    const mergedGoals = Math.max(
      Number(stats.goals || 0),
      Number(refereeStats.goals || 0),
      Number(perf.get('goals') || 0)
    );
    const mergedYellow = Math.max(
      Number(stats.yellowCards || 0),
      Number(refereeStats.yellowCards || 0)
    );
    const mergedRed = Math.max(Number(stats.redCards || 0), Number(refereeStats.redCards || 0));
    const existing = statsByUser.get(participantId);
    const next = {
      goals: mergedGoals,
      saves: Math.max(Number(stats.saves || 0), Number(existing?.saves || 0)),
      yellowCards: mergedYellow,
      redCards: mergedRed,
      role: perf.get('role') || 'athlete',
    };
    if (existing) {
      next.goals = Math.max(existing.goals, next.goals);
      next.yellowCards = Math.max(existing.yellowCards, next.yellowCards);
      next.redCards = Math.max(existing.redCards, next.redCards);
      next.saves = Math.max(existing.saves, next.saves);
    }
    statsByUser.set(participantId, next);
  }

  let hasMeaningfulStats = false;
  for (const stats of statsByUser.values()) {
    if (stats.goals || stats.saves || stats.yellowCards || stats.redCards) {
      hasMeaningfulStats = true;
      break;
    }
  }
  if (!hasMeaningfulStats) {
    return { ready: false };
  }

  let topScorerUserId = null;
  let maxGoals = -1;
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.role !== 'goalkeeper' && stats.goals > maxGoals) {
      maxGoals = stats.goals;
      topScorerUserId = participantId;
    }
  }

  let leastConcededKeeperUserId = null;
  let maxSaves = -1;
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.role === 'goalkeeper' && stats.saves > maxSaves) {
      maxSaves = stats.saves;
      leastConcededKeeperUserId = participantId;
    }
  }

  const goalScorers = {};
  const yellowCardUserIds = [];
  const redCardUserIds = [];
  for (const [participantId, stats] of statsByUser.entries()) {
    if (stats.goals > 0) {
      goalScorers[participantId] = stats.goals;
    }
    if (stats.yellowCards > 0) {
      yellowCardUserIds.push(participantId);
    }
    if (stats.redCards > 0) {
      redCardUserIds.push(participantId);
    }
  }

  let homeScore = 0;
  let awayScore = 0;
  if (event.get('type') === 'team_match') {
    const participationFee = Number(event.get('participationFee') || 0);
    // Confronto: placar = soma dos gols anotados pelo arbitro (refereeGoals) por time.
    const athleteRegs = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .containedIn('role', ['athlete', 'goalkeeper'])
      .limit(500)
      .find({ useMasterKey: true });

    const homeIds = new Set();
    const awayIds = new Set();
    for (const registration of athleteRegs) {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      if (!resolved.userId) continue;
      if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
      const side = registration.get('teamSide');
      if (side === 'home') homeIds.add(resolved.userId);
      else if (side === 'away') awayIds.add(resolved.userId);
    }

    // Placar = apenas gols marcados (refereeGoals). Gols sofridos de goleiro nao entram.
    for (const perf of performances) {
      const participantId = getPerformanceParticipantId(perf);
      if (!participantId) continue;
      const refereeGoals = Number(mapPerformanceToRefereeSumula(perf).goals || 0);
      if (!refereeGoals) continue;
      if (homeIds.has(participantId)) homeScore += refereeGoals;
      else if (awayIds.has(participantId)) awayScore += refereeGoals;
    }
  }

  return {
    ready: true,
    topScorerUserId,
    leastConcededKeeperUserId,
    homeScore,
    awayScore,
    goalScorers,
    yellowCardUserIds,
    redCardUserIds,
  };
}

function scoreFanPredictionRecord(prediction, actual, eventType) {
  let score = 0;

  if (
    actual.topScorerUserId &&
    String(prediction.get('topScorerUserId') || '') === String(actual.topScorerUserId)
  ) {
    score += 3;
  }

  if (
    actual.leastConcededKeeperUserId &&
    String(prediction.get('leastConcededKeeperUserId') || '') ===
      String(actual.leastConcededKeeperUserId)
  ) {
    score += 3;
  }

  if (eventType === 'team_match') {
    const predictedHome = prediction.get('homeScore');
    const predictedAway = prediction.get('awayScore');
    const homeExact = predictedHome != null && Number(predictedHome) === Number(actual.homeScore);
    const awayExact = predictedAway != null && Number(predictedAway) === Number(actual.awayScore);
    if (homeExact) score += 2;
    if (awayExact) score += 2;
    if (homeExact && awayExact) score += 1;
  }

  const predictedScorers = prediction.get('goalScorers') || [];
  for (const row of predictedScorers) {
    const userId = row && row.userId ? String(row.userId) : '';
    const goals = row && row.goals != null ? Number(row.goals) : 0;
    if (!userId) continue;
    if (actual.goalScorers[userId] != null && Number(actual.goalScorers[userId]) === goals) {
      score += 1;
    }
  }

  const predictedYellow = new Set((prediction.get('yellowCardUserIds') || []).map(String));
  for (const userId of actual.yellowCardUserIds) {
    if (predictedYellow.has(String(userId))) score += 1;
  }

  const predictedRed = new Set((prediction.get('expelledUserIds') || []).map(String));
  for (const userId of actual.redCardUserIds) {
    if (predictedRed.has(String(userId))) score += 2;
  }

  return score;
}

async function enrichPredictionRankingEntries(entries) {
  const enriched = [];
  for (const entry of entries) {
    let userName = entry.userName || 'Participante';
    let avatarUrl = entry.avatarUrl;
    try {
      const user = await new Parse.Query(Parse.User).get(entry.userId, { useMasterKey: true });
      userName =
        user.get('apelido') ||
        user.get('name') ||
        user.getUsername() ||
        userName;
      avatarUrl = user.get('avatarUrl') || avatarUrl;
    } catch {
      // mantem fallback
    }
    enriched.push({
      userId: entry.userId,
      userName,
      avatarUrl: avatarUrl || undefined,
      totalScore: entry.totalScore,
      eventsCount: entry.eventsCount,
    });
  }
  return enriched;
}

Parse.Cloud.define('getPredictionRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : undefined;
  const limit = Math.min(Number(request.params.limit) || 10, 50);

  const events = await loadFinishedEventsForPredictionScope(scope, scopeId);
  if (!events.length) {
    return { entries: [] };
  }

  const actualByEventId = new Map();
  for (const event of events) {
    actualByEventId.set(event.id, await buildEventActualPredictionResults(event));
  }

  const predictions = await new Parse.Query('FanPrediction')
    .containedIn('event', events)
    .include('user')
    .limit(5000)
    .find({ useMasterKey: true });

  const scoresByUser = new Map();
  for (const prediction of predictions) {
    const event = prediction.get('event');
    if (!event || !event.id) continue;
    const actual = actualByEventId.get(event.id);

    const predUser = prediction.get('user');
    if (!predUser || !predUser.id) continue;

    const userId = String(predUser.id);
    const existing = scoresByUser.get(userId) || {
      userId,
      totalScore: 0,
      eventsCount: 0,
    };

    if (actual && actual.ready) {
      existing.totalScore += scoreFanPredictionRecord(prediction, actual, event.get('type'));
    }
    existing.eventsCount += 1;
    scoresByUser.set(userId, existing);
  }

  const entries = Array.from(scoresByUser.values())
    .filter((entry) =>
      scope === 'event' || scope === 'pelada' || scope === 'app'
        ? entry.eventsCount > 0
        : entry.totalScore > 0
    )
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.eventsCount - a.eventsCount;
    })
    .slice(0, limit);

  return { entries: await enrichPredictionRankingEntries(entries) };
});

Parse.Cloud.define('getAthleteScoutPerformanceSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const athleteUserId = request.params.athleteUserId
    ? String(request.params.athleteUserId)
    : String(request.user.id);

  const byUser = new Parse.Query('EventPerformance');
  byUser.equalTo('user', Parse.User.createWithoutData(athleteUserId));
  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('participantUserId', athleteUserId);
  const performances = await Parse.Query.or(byUser, byParticipant)
    .include('event')
    .descending('updatedAt')
    .limit(200)
    .find({ useMasterKey: true });

  const totals = emptyScoutApontamentoStats();
  const events = [];

  for (const perf of performances) {
    const stats = mapPerformanceToScoutStats(perf);
    accumulateScoutStatsTotals(totals, stats);

    const event = perf.get('event');
    if (!event) continue;
    events.push({
      eventId: event.id,
      eventName: event.get('name') || 'Evento',
      eventDate: event.get('startTime') ? event.get('startTime').toISOString() : undefined,
      stats,
    });
  }

  return {
    athleteUserId,
    totals,
    events,
  };
});

const REFEREE_SUMULA_FIELDS = [
  'goals',
  'foulsCommitted',
  'yellowCards',
  'redCards',
  'penaltiesCommitted',
  'penaltiesSuffered',
];

function emptyRefereeSumulaStats() {
  return {
    goals: 0,
    goalsConceded: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesCommitted: 0,
    penaltiesSuffered: 0,
    observation: '',
  };
}

function mapPerformanceToRefereeSumula(perf) {
  if (!perf) {
    return emptyRefereeSumulaStats();
  }
  return {
    goals: readRefereeOverlapStat(perf, 'goals'),
    goalsConceded: Math.max(
      0,
      Number(perf.get('refereeGoalsConceded') != null ? perf.get('refereeGoalsConceded') : perf.get('goalsConceded') || 0)
    ),
    fouls: readRefereeOverlapStat(perf, 'foulsCommitted'),
    yellowCards: readRefereeOverlapStat(perf, 'yellowCards'),
    redCards: readRefereeOverlapStat(perf, 'redCards'),
    penaltiesCommitted: Number(perf.get('penaltiesCommitted') || 0),
    penaltiesSuffered: Number(perf.get('penaltiesSuffered') || 0),
    observation: perf.get('refereeObservation') ? String(perf.get('refereeObservation')) : '',
  };
}

async function assertCanViewRefereeSumula(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);
  // Sumula: bloqueio de edicao so com isFinished. A faixa sumulaOpensAt/ClosesAt
  // pode ser aberta pelo admin apos o horario do jogo.
  const finished = !!event.get('isFinished');
  const withinSumulaWindow = isWithinApontamentoWindow(event, 'sumula');
  const locked = finished;
  const isTeamMatch = event.get('type') === 'team_match';

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  const isReferee =
    !!registration &&
    registration.get('role') === 'referee' &&
    computeRegistrationEffectiveConfirmation(registration, participationFee);

  const canEdit = isReferee && !finished && withinSumulaWindow;

  // Confronto: qualquer usuario logado consulta; so o arbitro edita na janela.
  if (isTeamMatch) {
    return { event, locked, canEdit };
  }

  const eventAdmin = event.get('admin');
  if (eventAdmin && eventAdmin.id === user.id) {
    return { event, locked, canEdit: false };
  }

  const pelada = event.get('pelada');
  if (pelada && pelada.id) {
    const peladaObj = await new Parse.Query('Pelada').get(pelada.id, { useMasterKey: true });
    const peladaAdmin = peladaObj.get('admin');
    if (peladaAdmin && peladaAdmin.id === user.id) {
      return { event, locked, canEdit: false };
    }
  }

  if (!registration || !computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao tem permissao para consultar a sumula deste evento.'
    );
  }

  if (!finished && !isReferee) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A sumula fica disponivel para consulta apos o encerramento do evento.'
    );
  }

  return { event, locked, canEdit };
}

/**
 * Confronto: gols sofridos dos goleiros de um time nao podem ultrapassar
 * a soma de gols marcados pelo time adversario.
 */
async function assertTeamMatchGoalkeeperConcededCap(event, entriesByUserId) {
  if (event.get('type') !== 'team_match') return;

  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .containedIn('role', ['athlete', 'goalkeeper'])
    .limit(500)
    .find({ useMasterKey: true });

  const sideByUserId = new Map();
  const roleByUserId = new Map();
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
    const side = registration.get('teamSide');
    if (side !== 'home' && side !== 'away') continue;
    sideByUserId.set(resolved.userId, side);
    roleByUserId.set(resolved.userId, registration.get('role') || 'athlete');
  }

  let homeGoals = 0;
  let awayGoals = 0;
  let homeConceded = 0;
  let awayConceded = 0;

  for (const [userId, stats] of entriesByUserId.entries()) {
    const side = sideByUserId.get(userId);
    if (!side) continue;
    const goals = Math.max(0, Number(stats.goals || 0));
    const conceded = Math.max(0, Number(stats.goalsConceded || 0));
    if (side === 'home') {
      homeGoals += goals;
      if (roleByUserId.get(userId) === 'goalkeeper') homeConceded += conceded;
    } else {
      awayGoals += goals;
      if (roleByUserId.get(userId) === 'goalkeeper') awayConceded += conceded;
    }
  }

  if (homeConceded > awayGoals) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Gols sofridos dos goleiros mandantes (${homeConceded}) nao podem ultrapassar os gols do visitante (${awayGoals}).`
    );
  }
  if (awayConceded > homeGoals) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Gols sofridos dos goleiros visitantes (${awayConceded}) nao podem ultrapassar os gols do mandante (${homeGoals}).`
    );
  }
}

async function assertConfirmedRefereeForEvent(user, eventId, allowFinished = false) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const refereeRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'referee')
    .first({ useMasterKey: true });

  if (!refereeRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o juiz confirmado neste evento pode registrar a sumula.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(refereeRegistration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o juiz confirmado neste evento pode registrar a sumula.'
    );
  }

  if (!allowFinished && !!event.get('isFinished')) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'O evento ja foi encerrado. Sumula indisponivel.'
    );
  }

  assertWithinApontamentoWindow(event, 'sumula', 'Sumula');

  return { event, refereeRegistration };
}

Parse.Cloud.define('getRefereeSumulaBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event, locked, canEdit } = await assertCanViewRefereeSumula(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);
  const isTeamMatch = event.get('type') === 'team_match';
  const homeTeamName = event.get('homeTeamName') || 'Mandante';
  const awayTeamName = event.get('awayTeamName') || 'Visitante';

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .containedIn('role', ['athlete', 'goalkeeper'])
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });

  const eventPerformances = performances.filter((perf) => {
    const perfEvent = perf.get('event');
    return perfEvent && String(perfEvent.id) === String(event.id);
  });

  const perfStatsByParticipantId = buildMergedRefereeStatsByParticipantId(eventPerformances);

  const athletes = [];
  let homeScore = 0;
  let awayScore = 0;
  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;

    const row = mapRegistrationForEventListItem(registration, eventId, participationFee);
    const stats =
      perfStatsByParticipantId.get(resolved.userId) || emptyRefereeSumulaStats();
    const teamSide =
      registration.get('teamSide') === 'home' || registration.get('teamSide') === 'away'
        ? registration.get('teamSide')
        : '';
    const teamName =
      teamSide === 'home' ? homeTeamName : teamSide === 'away' ? awayTeamName : '';

    // Placar = apenas gols marcados. Gols sofridos (goleiro) nao somam.
    if (isTeamMatch) {
      const goals = Number(stats.goals || 0);
      if (teamSide === 'home') homeScore += goals;
      else if (teamSide === 'away') awayScore += goals;
    }

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: row.avatarUrl || undefined,
      primaryPosition: row.primaryPosition || undefined,
      role: registration.get('role') || 'athlete',
      teamSide,
      teamName,
      stats,
    });
  }

  athletes.sort((a, b) => {
    const sideRank = (side) => (side === 'home' ? 0 : side === 'away' ? 1 : 2);
    const diff = sideRank(a.teamSide) - sideRank(b.teamSide);
    if (diff !== 0) return diff;
    return String(a.apelido || '').localeCompare(String(b.apelido || ''), 'pt-BR');
  });

  return {
    eventId,
    eventName: event.get('name') || 'Evento',
    eventType: event.get('type') || 'pelada',
    homeTeamName: isTeamMatch ? homeTeamName : undefined,
    awayTeamName: isTeamMatch ? awayTeamName : undefined,
    homeScore: isTeamMatch ? homeScore : undefined,
    awayScore: isTeamMatch ? awayScore : undefined,
    locked,
    canEdit,
    athletes,
  };
});

Parse.Cloud.define('incrementRefereeSumula', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const field = request.params.field ? String(request.params.field) : '';
  const delta = Number(request.params.delta);

  if (!eventId || !athleteUserId || !field) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, athleteUserId e field sao obrigatorios.'
    );
  }

  if (!REFEREE_SUMULA_FIELDS.includes(field)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de sumula invalido.');
  }

  if (delta !== 1 && delta !== -1) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'delta deve ser 1 ou -1.');
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const pelada = event.get('pelada');
  let perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);

  const storageField = REFEREE_OVERLAP_STORAGE_FIELDS[field];
  if (!storageField) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Campo de sumula invalido.');
  }
  const current = Number(perf.get(storageField) || 0);
  const next = Math.max(0, current + delta);
  perf.set(storageField, next);
  perf.set('points', computeStoredPerformancePoints(perf));
  perf.set('refereeSumulaSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToRefereeSumula(perf),
  };
});

function applyRefereeSumulaStatsToPerformance(perf, stats) {
  perf.set('refereeGoals', Math.max(0, Number(stats.goals || 0)));
  if (stats.goalsConceded != null) {
    const conceded = Math.max(0, Number(stats.goalsConceded || 0));
    perf.set('refereeGoalsConceded', conceded);
    // Espelha no campo agregado para murais/dashboards de goleiro.
    perf.set('goalsConceded', conceded);
  }
  perf.set('refereeFoulsCommitted', Math.max(0, Number(stats.fouls || 0)));
  perf.set('refereeYellowCards', Math.max(0, Number(stats.yellowCards || 0)));
  perf.set('refereeRedCards', Math.max(0, Number(stats.redCards || 0)));
  perf.set('penaltiesCommitted', Math.max(0, Number(stats.penaltiesCommitted || 0)));
  perf.set('penaltiesSuffered', Math.max(0, Number(stats.penaltiesSuffered || 0)));
  if (stats.observation != null) {
    perf.set('refereeObservation', String(stats.observation || '').trim());
  }
  perf.set('refereeSumulaSaved', true);
  perf.set('points', computeStoredPerformancePoints(perf));
}

Parse.Cloud.define('saveRefereeSumulaBoard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const entries = Array.isArray(request.params.entries) ? request.params.entries : [];

  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  const pelada = event.get('pelada');

  const entriesByUserId = new Map();
  for (const entry of entries) {
    const athleteUserId = entry && entry.athleteUserId ? String(entry.athleteUserId) : '';
    if (!athleteUserId) continue;
    entriesByUserId.set(athleteUserId, entry.stats || {});
  }
  await assertTeamMatchGoalkeeperConcededCap(event, entriesByUserId);

  for (const entry of entries) {
    const athleteUserId = entry && entry.athleteUserId ? String(entry.athleteUserId) : '';
    if (!athleteUserId) continue;

    await assertConfirmedAthleteInEvent(event, athleteUserId);
    const stats = entry.stats || {};
    const perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);
    applyRefereeSumulaStatsToPerformance(perf, stats);
    await saveEventPerformance(perf);
  }

  return { ok: true, saved: entries.length };
});

Parse.Cloud.define('saveRefereeSumulaObservation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const athleteUserId = request.params.athleteUserId ? String(request.params.athleteUserId) : '';
  const observation =
    request.params.observation != null ? String(request.params.observation).trim() : '';

  if (!eventId || !athleteUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e athleteUserId sao obrigatorios.'
    );
  }

  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, athleteUserId);

  const pelada = event.get('pelada');
  const perf = await findEventPerformanceForParticipant(event, athleteUserId, pelada);
  perf.set('refereeObservation', observation);
  perf.set('refereeSumulaSaved', true);
  await saveEventPerformance(perf);

  return {
    ok: true,
    athleteUserId,
    stats: mapPerformanceToRefereeSumula(perf),
  };
});

async function registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId) {
  const committedPerf = await findEventPerformanceForParticipant(event, committedUserId, pelada);
  const sufferedPerf = await findEventPerformanceForParticipant(event, sufferedUserId, pelada);
  committedPerf.set(
    'penaltiesCommitted',
    Math.max(0, Number(committedPerf.get('penaltiesCommitted') || 0) + 1)
  );
  sufferedPerf.set(
    'penaltiesSuffered',
    Math.max(0, Number(sufferedPerf.get('penaltiesSuffered') || 0) + 1)
  );
  await saveEventPerformance(committedPerf);
  await saveEventPerformance(sufferedPerf);
  return {
    committedUserId,
    sufferedUserId,
    committedStats: mapPerformanceToScoutStats(committedPerf),
    sufferedStats: mapPerformanceToScoutStats(sufferedPerf),
  };
}

Parse.Cloud.define('registerScoutPenalty', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const committedUserId = request.params.committedUserId ? String(request.params.committedUserId) : '';
  const sufferedUserId = request.params.sufferedUserId ? String(request.params.sufferedUserId) : '';
  if (!eventId || !committedUserId || !sufferedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, committedUserId e sufferedUserId sao obrigatorios.'
    );
  }
  if (committedUserId === sufferedUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione atletas diferentes.');
  }
  const { event } = await assertConfirmedScoutForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, committedUserId);
  await assertConfirmedAthleteInEvent(event, sufferedUserId);
  const pelada = event.get('pelada');
  return registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId);
});

Parse.Cloud.define('registerRefereePenalty', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const committedUserId = request.params.committedUserId ? String(request.params.committedUserId) : '';
  const sufferedUserId = request.params.sufferedUserId ? String(request.params.sufferedUserId) : '';
  if (!eventId || !committedUserId || !sufferedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId, committedUserId e sufferedUserId sao obrigatorios.'
    );
  }
  if (committedUserId === sufferedUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione atletas diferentes.');
  }
  const { event } = await assertConfirmedRefereeForEvent(user, eventId);
  await assertConfirmedAthleteInEvent(event, committedUserId);
  await assertConfirmedAthleteInEvent(event, sufferedUserId);
  const pelada = event.get('pelada');
  return registerPenaltyForEvent(event, pelada, committedUserId, sufferedUserId);
});

function aggregatePerformanceStatsFromRows(performances, priority) {
  const totals = emptyScoutApontamentoStats();
  for (const perf of performances) {
    const row = mapPerformanceToScoutStats(perf);
    if (priority === 'referee') {
      row.goals = readRefereeOverlapStat(perf, 'goals') || row.goals;
      row.foulsCommitted = readRefereeOverlapStat(perf, 'foulsCommitted') || row.foulsCommitted;
      row.yellowCards = readRefereeOverlapStat(perf, 'yellowCards') || row.yellowCards;
      row.redCards = readRefereeOverlapStat(perf, 'redCards') || row.redCards;
    }
    accumulateScoutStatsTotals(totals, row);
  }
  return totals;
}

Parse.Cloud.define('getAthletePerformanceDashboard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app');
  const scopeId = request.params.scopeId ? String(request.params.scopeId) : '';
  const athleteUserId = request.params.athleteUserId
    ? String(request.params.athleteUserId)
    : user.id;

  let performances = [];
  if (scope === 'event' && scopeId) {
    const event = await new Parse.Query('Event').get(scopeId, { useMasterKey: true });
    performances = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .equalTo('participantUserId', athleteUserId)
      .find({ useMasterKey: true });
  } else if (scope === 'pelada' && scopeId) {
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    performances = await new Parse.Query('EventPerformance')
      .equalTo('pelada', pelada)
      .equalTo('participantUserId', athleteUserId)
      .limit(500)
      .find({ useMasterKey: true });
  } else {
    performances = await new Parse.Query('EventPerformance')
      .equalTo('participantUserId', athleteUserId)
      .limit(500)
      .find({ useMasterKey: true });
  }

  const totals = aggregatePerformanceStatsFromRows(performances, 'scout');
  const totalShots = totals.shotsOffTarget + totals.shotsOnTarget;
  const totalPasses = totals.passesCompleted + totals.passesMissed;

  return {
    athleteUserId,
    scope,
    scopeId: scopeId || undefined,
    totals,
    charts: {
      shotsOnTarget: totals.shotsOnTarget,
      shotsOffTarget: totals.shotsOffTarget,
      goals: totals.goals,
      shotAccuracyPct: totalShots ? Math.round((totals.shotsOnTarget / totalShots) * 100) : 0,
      goalConversionPct: totals.shotsOnTarget
        ? Math.round((totals.goals / totals.shotsOnTarget) * 100)
        : 0,
      passAccuracyPct: totalPasses ? Math.round((totals.passesCompleted / totalPasses) * 100) : 0,
      foulsCommitted: totals.foulsCommitted,
      foulsSuffered: totals.foulsSuffered,
      assists: totals.assists,
    },
  };
});

// --- 09-events-registrations.js ---

/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */

/** Eventos — inscricoes, chegada, pagamento e contratacao suplementar */

// Inscricoes, chegada e separacao de times
function isSocioMembershipType(membershipType) {
  return String(membershipType || 'convidado') === 'socio';
}

function getRegistrationUserId(registration) {
  const explicit = registration.get('participantUserId');
  if (explicit) {
    return String(explicit);
  }
  const user = registration.get('user');
  return user && user.id ? String(user.id) : '';
}

async function loadActiveSocioUserIdsForEvent(event) {
  const pelada = event.get('pelada');
  if (!pelada || !pelada.id) {
    return new Set();
  }

  const memberships = await new Parse.Query('PeladaMembership')
    .equalTo('pelada', pelada)
    .equalTo('status', 'active')
    .limit(1000)
    .find({ useMasterKey: true });

  const ids = new Set();
  for (const membership of memberships) {
    const memberUserId = membership.get('memberUserId');
    if (memberUserId) {
      ids.add(String(memberUserId));
      continue;
    }
    const user = membership.get('user');
    if (user && user.id) {
      ids.add(String(user.id));
    }
  }
  return ids;
}

function isEffectiveSocioRegistration(registration, activeSocioUserIds) {
  const userId = getRegistrationUserId(registration);
  if (userId && activeSocioUserIds.has(userId)) {
    return true;
  }
  return isSocioMembershipType(registration.get('membershipType'));
}

function isEventAdminRegistration(registration, eventAdminId) {
  if (!eventAdminId) {
    return false;
  }
  const userId = getRegistrationUserId(registration);
  if (userId && userId === eventAdminId) {
    return true;
  }
  const user = registration.get('user');
  return !!(user && user.id && String(user.id) === eventAdminId);
}

function isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds) {
  if (isEventAdminRegistration(registration, eventAdminId)) {
    return false;
  }
  return isEffectiveSocioRegistration(registration, activeSocioUserIds);
}

function compareArrivedAt(a, b) {
  const aTime = a.get('arrivedAt') ? a.get('arrivedAt').getTime() : 0;
  const bTime = b.get('arrivedAt') ? b.get('arrivedAt').getTime() : 0;
  return aTime - bTime;
}

function buildArrivalOrderList(arrived, eventAdminId, activeSocioUserIds) {
  const adminArrived = [];
  const sociosArrived = [];
  const convidadosArrived = [];

  for (const registration of arrived) {
    if (isEventAdminRegistration(registration, eventAdminId)) {
      adminArrived.push(registration);
      continue;
    }
    if (isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds)) {
      sociosArrived.push(registration);
      continue;
    }
    convidadosArrived.push(registration);
  }

  adminArrived.sort(compareArrivedAt);
  sociosArrived.sort(compareArrivedAt);
  convidadosArrived.sort(compareArrivedAt);

  return [...adminArrived, ...sociosArrived, ...convidadosArrived];
}

function getArrivalPriorityTier(registration, eventAdminId, activeSocioUserIds) {
  if (isEventAdminRegistration(registration, eventAdminId)) {
    return 0;
  }
  if (isRegularSocioRegistration(registration, eventAdminId, activeSocioUserIds)) {
    return 1;
  }
  return 2;
}

function compareArrivalPriority(a, b, eventAdminId, activeSocioUserIds) {
  const tierA = getArrivalPriorityTier(a, eventAdminId, activeSocioUserIds);
  const tierB = getArrivalPriorityTier(b, eventAdminId, activeSocioUserIds);
  if (tierA !== tierB) {
    return tierA - tierB;
  }
  return compareArrivedAt(a, b);
}

async function recalculateEventArrivalOrders(eventId) {
  const event = await new Parse.Query('Event')
    .include('admin')
    .include('pelada')
    .get(eventId, { useMasterKey: true });

  const eventAdminId = event.get('admin') && event.get('admin').id ? String(event.get('admin').id) : '';
  const activeSocioUserIds = await loadActiveSocioUserIdsForEvent(event);
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const allQuery = new Parse.Query('EventRegistration');
  allQuery.equalTo('event', eventPtr);
  allQuery.equalTo('role', 'athlete');
  allQuery.limit(500);
  const allAthletes = await allQuery.find({ useMasterKey: true });

  const arrived = allAthletes.filter((registration) => registration.get('arrivedAt'));
  const ordered = buildArrivalOrderList(arrived, eventAdminId, activeSocioUserIds);

  const orderById = new Map();
  ordered.forEach((registration, index) => {
    orderById.set(registration.id, index + 1);
  });

  const toSave = [];
  for (const registration of allAthletes) {
    const order = orderById.get(registration.id);
    if (order != null) {
      if (registration.get('arrivalOrder') !== order) {
        registration.set('arrivalOrder', order);
        toSave.push(registration);
      }
    } else if (registration.get('arrivalOrder') != null) {
      registration.unset('arrivalOrder');
      toSave.push(registration);
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }
}

Parse.Cloud.define('registerEventAthleteArrival', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const registrationId = request.params.registrationId
    ? String(request.params.registrationId)
    : '';
  const action = String(request.params.action || 'check_in');

  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId obrigatorios.');
  }
  if (action !== 'check_in' && action !== 'undo') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Acao invalida.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const eventType = event.get('type');
  if (eventType !== 'pelada' && eventType !== 'racha') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada aplica-se apenas a eventos Pelada e Racha.'
    );
  }

  if (!event.get('useArrivalOrderForTeams')) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada nao esta ativa neste evento.'
    );
  }

  const readOnlyAt = event.get('readOnlyAt');
  if (readOnlyAt && new Date() >= readOnlyAt) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Evento encerrado.');
  }

  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode registrar chegada.'
    );
  }

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  if (registration.get('role') !== 'athlete') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ordem de chegada aplica-se apenas a atletas.'
    );
  }

  if (action === 'check_in') {
    if (registration.get('arrivedAt')) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Chegada ja registrada para este atleta.');
    }
    registration.set('arrivedAt', new Date());
    await registration.save(null, { useMasterKey: true });
  } else {
    if (!registration.get('arrivedAt')) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este atleta ainda nao registrou chegada.');
    }
    registration.unset('arrivedAt');
    await registration.save(null, { useMasterKey: true });
  }

  await recalculateEventArrivalOrders(eventId);
  return { ok: true };
});

Parse.Cloud.define('ensureEventArrivalOrders', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode recalcular ordem de chegada.'
    );
  }

  if (!event.get('useArrivalOrderForTeams')) {
    return { ok: true, skipped: true };
  }

  await recalculateEventArrivalOrders(eventId);
  return { ok: true };
});

function computeRegistrationEffectiveConfirmation(registration, participationFee) {
  const presentationStatus = registration.get('profilePresentationStatus');
  if (presentationStatus === 'pending' || presentationStatus === 'rejected') {
    return false;
  }
  const paymentConfirmed = !!registration.get('paymentConfirmed');
  const paymentExempt = !!registration.get('paymentExempt');
  if (registration.get('invitedByContract') || registration.get('invitedAsReferee')) {
    return true;
  }
  if (registration.get('isAnonymous')) {
    return true;
  }
  if (participationFee <= 0) return true;
  if (paymentExempt) return true;
  return paymentConfirmed;
}

async function resolveRegistrationParticipantUserId(registration) {
  const existing = registration.get('participantUserId');
  if (existing) {
    return { userId: String(existing), shouldSave: false };
  }

  const userPtr = registration.get('user');
  if (!userPtr) {
    return { userId: '', shouldSave: false };
  }

  let user = userPtr;
  try {
    if (!user.get || typeof user.get !== 'function') {
      user = await new Parse.Query(Parse.User).get(userPtr.id, { useMasterKey: true });
    } else if (!user.get('apelido') && !user.get('name') && user.id) {
      user = await user.fetch({ useMasterKey: true });
    }
  } catch {
    return { userId: userPtr.id ? String(userPtr.id) : '', shouldSave: false };
  }

  if (!user || !user.id) {
    return { userId: '', shouldSave: false };
  }

  registration.set('participantUserId', user.id);
  applyRegistrationUserDisplayFields(registration, user);
  return { userId: String(user.id), shouldSave: true };
}

function mapRegistrationForEventListItem(registration, eventId, participationFee, athleteProfile) {
  const athlete = athleteProfile || registration.get('athlete');
  const arrivedAt = registration.get('arrivedAt');
  const paymentConfirmed = !!registration.get('paymentConfirmed');
  const paymentExempt = !!registration.get('paymentExempt');
  const profilePresentationStatus = registration.get('profilePresentationStatus') || null;
  const userPtr = registration.get('user');
  const birthDate = userPtr && userPtr.get ? userPtr.get('birthDate') : null;
  const age =
    typeof calcAgeFromBirthDate === 'function' ? calcAgeFromBirthDate(birthDate) : null;

  return {
    objectId: registration.id,
    eventId,
    userId: String(registration.get('participantUserId') || ''),
    userName:
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      registration.get('userApelido') ||
      'Participante',
    apelido: registration.get('apelido') || '',
    role: registration.get('role') || 'athlete',
    committed: !!registration.get('committed'),
    membershipType: registration.get('membershipType') || 'convidado',
    attendance: registration.get('attendance') || 'pending',
    paymentConfirmed,
    paymentExempt,
    isEffectivelyConfirmed: computeRegistrationEffectiveConfirmation(
      registration,
      participationFee
    ),
    invitedByContract: !!registration.get('invitedByContract'),
    invitedAsReferee: !!registration.get('invitedAsReferee'),
    contractOfferedAmount:
      registration.get('contractOfferedAmount') != null
        ? Number(registration.get('contractOfferedAmount'))
        : undefined,
    profilePresentationStatus,
    arrivalOrder:
      registration.get('arrivalOrder') != null ? Number(registration.get('arrivalOrder')) : undefined,
    arrivedAt: arrivedAt ? arrivedAt.toISOString() : undefined,
    avatarUrl: registration.get('avatarUrl') || undefined,
    primaryPosition:
      athlete && athlete.get ? athlete.get('primaryPosition') || undefined : undefined,
    isAnonymous: !!registration.get('isAnonymous'),
    gateTicketActive:
      !!registration.get('gateTicketToken') && !registration.get('gateTicketCancelledAt'),
    teamSide:
      registration.get('teamSide') === 'home' || registration.get('teamSide') === 'away'
        ? registration.get('teamSide')
        : undefined,
    age: age != null && !Number.isNaN(age) ? age : null,
    appAverageScore: null,
    teamName: undefined,
  };
}

async function buildAppAverageVoteScores(userIds) {
  const scores = new Map();
  if (!userIds || !userIds.size) return scores;
  for (const userId of userIds) {
    scores.set(userId, null);
  }

  const idList = Array.from(userIds);
  const chunkSize = 50;
  const voteAgg = new Map();

  for (let i = 0; i < idList.length; i += chunkSize) {
    const chunk = idList.slice(i, i + chunkSize);
    const votes = await new Parse.Query('MuralVote')
      .containedIn('targetUserId', chunk)
      .limit(5000)
      .find({ useMasterKey: true });

    const eventIds = [
      ...new Set(
        votes
          .map((vote) => String(vote.get('scopeId') || '').trim())
          .filter(Boolean)
      ),
    ];
    const typeById = new Map();
    for (let j = 0; j < eventIds.length; j += 50) {
      const eventChunk = eventIds.slice(j, j + 50);
      if (!eventChunk.length) continue;
      const events = await new Parse.Query('Event')
        .containedIn('objectId', eventChunk)
        .select(['type'])
        .limit(eventChunk.length)
        .find({ useMasterKey: true });
      for (const event of events) {
        typeById.set(event.id, event.get('type') || '');
      }
    }

    for (const vote of votes) {
      const targetUserId = String(
        vote.get('targetUserId') ||
          (vote.get('targetUser') && vote.get('targetUser').id ? vote.get('targetUser').id : '')
      );
      if (!targetUserId || !userIds.has(targetUserId)) continue;
      const scopeId = String(vote.get('scopeId') || '');
      const weight = typeById.get(scopeId) === 'team_match' ? 3 : 1;
      const score = Number(vote.get('score') || 0);
      const current = voteAgg.get(targetUserId) || { weighted: 0, weightSum: 0 };
      current.weighted += score * weight;
      current.weightSum += weight;
      voteAgg.set(targetUserId, current);
    }
  }

  for (const [userId, data] of voteAgg.entries()) {
    if (data.weightSum > 0) {
      scores.set(userId, Math.round((data.weighted / data.weightSum) * 10) / 10);
    }
  }
  return scores;
}

async function enrichEventRegistrationListRows(rows, event) {
  if (!rows.length) return rows;
  const userIds = new Set(rows.map((row) => String(row.userId || '')).filter(Boolean));
  const averages = await buildAppAverageVoteScores(userIds);
  const homeName = event.get('homeTeamName') || 'Mandante';
  const awayName = event.get('awayTeamName') || 'Visitante';
  const isTeamMatch = event.get('type') === 'team_match';

  for (const row of rows) {
    const avg = averages.get(String(row.userId || ''));
    row.appAverageScore = avg != null ? avg : null;
    if (isTeamMatch && (row.role === 'athlete' || row.role === 'goalkeeper')) {
      if (row.teamSide === 'home') row.teamName = homeName;
      else if (row.teamSide === 'away') row.teamName = awayName;
      else row.teamName = undefined;
    }
  }
  return rows;
}

function sortTeamMatchRegistrationRows(rows, event) {
  if (!event || event.get('type') !== 'team_match' || !Array.isArray(rows)) {
    return rows;
  }
  const sideRank = (side) => (side === 'home' ? 0 : side === 'away' ? 1 : 2);
  rows.sort((a, b) => {
    const sideDiff = sideRank(a.teamSide) - sideRank(b.teamSide);
    if (sideDiff !== 0) return sideDiff;
    return String(a.apelido || a.userName || '').localeCompare(
      String(b.apelido || b.userName || ''),
      'pt-BR'
    );
  });
  return rows;
}

async function resolveRegistrationAthleteProfile(registration) {
  let athlete = registration.get('athlete');
  if (athlete && !athlete.get && athlete.id) {
    try {
      athlete = await new Parse.Query('AthleteProfile').get(athlete.id, { useMasterKey: true });
    } catch {
      athlete = null;
    }
  }

  if (athlete && athlete.get && athlete.get('primaryPosition')) {
    return { athlete, shouldSave: false };
  }

  const role = registration.get('role');
  if (role !== 'athlete' && role !== 'goalkeeper') {
    return { athlete: athlete || null, shouldSave: false };
  }

  const userPtr = registration.get('user');
  if (!userPtr || !userPtr.id) {
    return { athlete: athlete || null, shouldSave: false };
  }

  const profile = await new Parse.Query('AthleteProfile')
    .equalTo('user', userPtr)
    .first({ useMasterKey: true });
  if (!profile) {
    return { athlete: athlete || null, shouldSave: false };
  }

  registration.set('athlete', profile);
  return { athlete: profile, shouldSave: true };
}

Parse.Cloud.define('listEventParticipantsForVoting', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);

  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem ver a lista para votacao.'
    );
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .ascending('arrivalOrder')
    .addAscending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const rows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) {
      continue;
    }

    rows.push(row);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  rows.sort((a, b) => a.apelido.localeCompare(b.apelido, 'pt-BR'));
  return sortTeamMatchRegistrationRows(
    await enrichEventRegistrationListRows(rows, event),
    event
  );
});

Parse.Cloud.define('listEventRegistrationsForAdmin', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador do evento pode ver a lista completa de participantes.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .ascending('arrivalOrder')
    .addAscending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const rows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    row.userId = resolved.userId;
    rows.push(row);
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  rows.sort((a, b) => {
    const orderDiff = (a.arrivalOrder ?? 9999) - (b.arrivalOrder ?? 9999);
    if (orderDiff !== 0) return orderDiff;
    return (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR');
  });

  return sortTeamMatchRegistrationRows(
    await enrichEventRegistrationListRows(rows, event),
    event
  );
});

function athletePositionsFromProfile(athlete) {
  if (!athlete || !athlete.get) {
    return {
      primaryPosition: undefined,
      secondaryPosition: undefined,
      thirdPosition: undefined,
    };
  }
  return {
    primaryPosition: athlete.get('primaryPosition') || undefined,
    secondaryPosition: athlete.get('secondaryPosition') || undefined,
    thirdPosition: athlete.get('thirdPosition') || undefined,
  };
}

Parse.Cloud.define('listEventAthletesForPredictions', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const participationFee = Number(event.get('participationFee') || 0);

  const ownRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });

  if (!ownRegistration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas participantes inscritos podem fazer palpites.'
    );
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .ascending('apelido')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const athletes = [];
  const seen = new Set();

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId || seen.has(resolved.userId)) {
      continue;
    }

    if (resolved.shouldSave) {
      toSave.push(registration);
    }

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) {
      continue;
    }

    seen.add(resolved.userId);
    const user = registration.get('user');
    athletes.push({
      userId: resolved.userId,
      userName: row.userName,
      apelido: row.apelido || row.userName,
      avatarUrl: resolveStoredAvatarUrl(user, registration),
      teamSide: row.teamSide,
      ...athletePositionsFromProfile(athleteResolved.athlete),
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  athletes.sort((a, b) => (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR'));
  return athletes;
});

async function buildPeladaAthleteAverageVoteScores(peladaId, userIds) {
  const scores = new Map();
  if (!peladaId || !userIds || !userIds.size) {
    return scores;
  }

  for (const userId of userIds) {
    scores.set(userId, 0);
  }

  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', pelada)
    .limit(500)
    .find({ useMasterKey: true });

  const eventIds = events.map((event) => event.id).filter(Boolean);
  if (!eventIds.length) {
    return scores;
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const eventPtrs = eventIds.map((id) => Parse.Object.extend('Event').createWithoutData(id));

  const registrations = await new Parse.Query('EventRegistration')
    .containedIn('event', eventPtrs)
    .equalTo('role', 'athlete')
    .include('user')
    .limit(5000)
    .find({ useMasterKey: true });

  const participationByUser = new Map();
  for (const registration of registrations) {
    const userId = getRegistrationUserId(registration);
    if (!userId || !userIds.has(userId)) continue;

    const event = registration.get('event');
    const eventId = event && event.id ? event.id : null;
    if (!eventId) continue;

    const eventObj = eventById.get(eventId);
    const participationFee = Number((eventObj && eventObj.get('participationFee')) || 0);
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }

    if (!participationByUser.has(userId)) {
      participationByUser.set(userId, new Set());
    }
    participationByUser.get(userId).add(eventId);
  }

  const eventVoteQuery = new Parse.Query('MuralVote');
  eventVoteQuery.equalTo('scope', 'event');
  eventVoteQuery.containedIn('scopeId', eventIds);
  eventVoteQuery.equalTo('targetRole', 'athlete');
  eventVoteQuery.limit(5000);
  const votes = await eventVoteQuery.find({ useMasterKey: true });

  const voteSumByUser = new Map();
  for (const userId of userIds) {
    voteSumByUser.set(userId, 0);
  }

  for (const vote of votes) {
    const targetUser = vote.get('targetUser');
    const targetUserId = String(
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '')
    );
    if (!targetUserId || !userIds.has(targetUserId)) continue;

    const scopeId = String(vote.get('scopeId') || '');
    const userEvents = participationByUser.get(targetUserId);
    if (!userEvents || !userEvents.has(scopeId)) continue;

    const score = Number(vote.get('score') || 0);
    voteSumByUser.set(targetUserId, (voteSumByUser.get(targetUserId) || 0) + score);
  }

  for (const userId of userIds) {
    const eventCount = participationByUser.get(userId)?.size || 0;
    if (eventCount <= 0) {
      scores.set(userId, 0);
      continue;
    }
    const totalVotes = voteSumByUser.get(userId) || 0;
    scores.set(userId, totalVotes / eventCount);
  }

  return scores;
}

Parse.Cloud.define('listEventAthletesForTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const ended = isEventEndedForTeamSplit(event);
  if (!ended) {
    const admin = event.get('admin');
    if (!admin || admin.id !== user.id) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apenas o administrador pode separar times.'
      );
    }
  } else {
    const admin = event.get('admin');
    const isAdmin = !!(admin && admin.id === user.id);
    if (!isAdmin && !hasSavedTeamSplit(event)) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'A separacao de times ainda nao foi registrada para este evento.'
      );
    }
  }

  const pelada = event.get('pelada');
  const peladaId = pelada && pelada.id ? pelada.id : null;
  const participationFee = Number(event.get('participationFee') || 0);
  const activeSocioIds = await loadActiveSocioUserIdsForEvent(event);

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .limit(500)
    .find({ useMasterKey: true });

  const toSave = [];
  const pendingRows = [];

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId) continue;

    if (resolved.shouldSave) toSave.push(registration);

    const athleteResolved = await resolveRegistrationAthleteProfile(registration);
    if (athleteResolved.shouldSave && !toSave.includes(registration)) {
      toSave.push(registration);
    }

    const row = mapRegistrationForEventListItem(
      registration,
      eventId,
      participationFee,
      athleteResolved.athlete
    );
    if (!row.isEffectivelyConfirmed) continue;

    pendingRows.push({
      registration,
      resolved,
      row,
      athleteResolved,
    });
  }

  const userIds = new Set(pendingRows.map((item) => item.resolved.userId));
  const averageVoteScores = peladaId
    ? await buildPeladaAthleteAverageVoteScores(peladaId, userIds)
    : new Map();

  const athletes = [];

  for (const item of pendingRows) {
    const { registration, resolved, row, athleteResolved } = item;
    const userPtr = registration.get('user');
    const birthDate = userPtr && userPtr.get ? userPtr.get('birthDate') : null;
    const athleteProfile = athleteResolved.athlete;
    const address = userPtr && userPtr.get ? userPtr.get('address') || {} : {};
    const neighborhood = normalizeLocationLabel(address.neighborhood);

    athletes.push({
      userId: resolved.userId,
      registrationId: registration.id,
      apelido: row.apelido || row.userName,
      userName: row.userName,
      avatarUrl: resolveStoredAvatarUrl(userPtr, registration),
      primaryPosition:
        athleteProfile && athleteProfile.get
          ? athleteProfile.get('primaryPosition') || undefined
          : undefined,
      age: calcAgeFromBirthDate(birthDate),
      accumulatedPoints: averageVoteScores.get(resolved.userId) || 0,
      membershipType: registration.get('membershipType') || 'convidado',
      isSocio: isEffectiveSocioRegistration(registration, activeSocioIds),
      maritalStatus:
        athleteProfile && athleteProfile.get ? athleteProfile.get('maritalStatus') || undefined : undefined,
      footPreference:
        athleteProfile && athleteProfile.get ? athleteProfile.get('footPreference') || undefined : undefined,
      favoriteProTeam: readUserFavoriteProTeam(
        userPtr,
        athleteProfile && athleteProfile.get ? athleteProfile.get('favoriteProTeam') : undefined
      ),
      neighborhood: neighborhood || undefined,
      arrivalOrder:
        row.arrivalOrder != null ? Number(row.arrivalOrder) : undefined,
      arrivedAt: row.arrivedAt || undefined,
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  athletes.sort((a, b) => {
    const orderDiff = (a.arrivalOrder ?? 9999) - (b.arrivalOrder ?? 9999);
    if (orderDiff !== 0) return orderDiff;
    return (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR');
  });

  return athletes;
});

function normalizeEventTeamSplitState(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const athletesPerTeam = Number(raw.athletesPerTeam);
  const teamCount = Number(raw.teamCount);
  const splitMode = String(raw.splitMode || 'manual');
  const randomStrategy = String(raw.randomStrategy || 'default');
  const teamsRaw = raw.teams;

  if (!Array.isArray(teamsRaw) || !athletesPerTeam || !teamCount) {
    return null;
  }

  const teams = teamsRaw
    .map((team) =>
      Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
    )
    .slice(0, 8);

  return {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam)),
    teamCount: Math.max(1, Math.min(8, teamCount)),
    splitMode: splitMode === 'random' ? 'random' : 'manual',
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: raw.savedAt ? String(raw.savedAt) : undefined,
  };
}

async function assertEventAdmin(event, user) {
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador pode gerenciar a separacao de times.'
    );
  }
}

function isEventEndedForTeamSplit(event) {
  return (
    !!event.get('isFinished') ||
    (event.get('endTime') instanceof Date && event.get('endTime') < new Date())
  );
}

async function loadPeladaForEvent(event) {
  const peladaRef = event.get('pelada');
  const peladaId = peladaRef && peladaRef.id ? peladaRef.id : null;
  if (!peladaId) return null;

  if (
    peladaRef.get &&
    typeof peladaRef.get('allowTeamSplitAfterEventEnd') === 'boolean'
  ) {
    return peladaRef;
  }

  return new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
}

async function isTeamSplitAfterEventEndAllowed(event) {
  if (!isEventEndedForTeamSplit(event)) return true;

  const pelada = await loadPeladaForEvent(event);
  return !!(pelada && pelada.get('allowTeamSplitAfterEventEnd'));
}

function hasSavedTeamSplit(event) {
  const existing = normalizeEventTeamSplitState(event.get('teamSplit'));
  return !!(existing && existing.teams.some((team) => team.length > 0));
}

async function assertCanManageTeamSplit(event, user) {
  await assertEventAdmin(event, user);

  if (!isEventEndedForTeamSplit(event)) return;

  const allowed = await isTeamSplitAfterEventEndAllowed(event);
  if (!allowed) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A separacao de times apos o termino do evento nao esta permitida nesta pelada.'
    );
  }
}

Parse.Cloud.define('getEventTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const ended = isEventEndedForTeamSplit(event);
  if (!ended) {
    await assertEventAdmin(event, user);
  } else {
    const admin = event.get('admin');
    const isAdmin = !!(admin && admin.id === user.id);
    if (!isAdmin && !hasSavedTeamSplit(event)) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'A separacao de times ainda nao foi registrada para este evento.'
      );
    }
  }

  return normalizeEventTeamSplitState(event.get('teamSplit'));
});

Parse.Cloud.define('saveEventTeamSplit', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  await assertCanManageTeamSplit(event, user);

  const athletesPerTeam = Number(request.params.athletesPerTeam);
  const teamCount = Number(request.params.teamCount);
  const splitMode = String(request.params.splitMode || 'manual');
  const randomStrategy = request.params.randomStrategy
    ? String(request.params.randomStrategy)
    : 'default';
  const teamsRaw = request.params.teams;

  if (!Array.isArray(teamsRaw)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'teams invalido.');
  }

  const teams = teamsRaw
    .map((team) =>
      Array.isArray(team) ? team.map((userId) => String(userId || '')).filter(Boolean) : []
    )
    .slice(0, 8);

  const payload = {
    athletesPerTeam: Math.max(1, Math.min(20, athletesPerTeam || 1)),
    teamCount: Math.max(1, Math.min(8, teamCount || 1)),
    splitMode: splitMode === 'random' ? 'random' : 'manual',
    randomStrategy: ['default', 'marital', 'favoriteTeam', 'neighborhood'].includes(randomStrategy)
      ? randomStrategy
      : 'default',
    teams,
    savedAt: new Date().toISOString(),
  };

  event.set('teamSplit', payload);
  await event.save(null, { useMasterKey: true });

  return normalizeEventTeamSplitState(payload);
});

// Pagamento e inscricao anonima
async function assertEventAdmin(user, eventId) {
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  if (!admin || !user || admin.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o administrador do evento.');
  }
  return event;
}

Parse.Cloud.define('updateEventRegistrationPayment', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const registrationId = request.params.registrationId ? String(request.params.registrationId) : '';
  const mode = request.params.mode ? String(request.params.mode) : 'confirmed';
  const value = !!request.params.value;

  if (!eventId || !registrationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId e registrationId sao obrigatorios.');
  }

  const event = await assertEventAdmin(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);

  const registration = await new Parse.Query('EventRegistration')
    .equalTo('objectId', registrationId)
    .equalTo('event', event)
    .include('user')
    .include('athlete')
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada.');
  }

  if (mode === 'exempt') {
    registration.set('paymentExempt', value);
    if (value) {
      registration.set('paymentConfirmed', false);
    }
  } else {
    registration.set('paymentConfirmed', value);
    if (value) {
      registration.set('paymentExempt', false);
    }
  }

  const isEffectivelyConfirmed = computeRegistrationEffectiveConfirmation(
    registration,
    participationFee
  );
  registration.set('isEffectivelyConfirmed', isEffectivelyConfirmed);
  await registration.save(null, { useMasterKey: true });
  await maybeIssueGateTicketForRegistration(registration, event, user);

  return mapRegistrationForEventListItem(registration, eventId, participationFee);
});

Parse.Cloud.define('createAnonymousEventRegistration', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const apelido = String(request.params.apelido || '').trim();
  const role = String(request.params.role || 'athlete').trim();

  if (!eventId || apelido.length < 2) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe eventId e apelido (min. 2 caracteres).');
  }

  const event = await assertEventAdmin(user, eventId);
  const participationFee = Number(event.get('participationFee') || 0);

  const duplicateQuery = new Parse.Query('EventRegistration');
  duplicateQuery.equalTo('event', event);
  duplicateQuery.equalTo('apelido', apelido);
  const duplicate = await duplicateQuery.first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Apelido ja utilizado neste evento.');
  }

  const participantUserId = `anon_${new Date().getTime()}_${Math.random().toString(36).slice(2, 10)}`;
  const registration = new Parse.Object('EventRegistration');
  registration.set('event', event);
  registration.set('role', role);
  registration.set('apelido', apelido);
  registration.set('userDisplayName', apelido);
  registration.set('participantUserId', participantUserId);
  registration.set('isAnonymous', true);
  registration.set('committed', true);
  registration.set('membershipType', 'convidado');
  registration.set('attendance', 'pending');
  registration.set('paymentConfirmed', false);
  registration.set('paymentExempt', true);
  registration.set('isEffectivelyConfirmed', true);

  const pelada = event.get('pelada');
  if (pelada) {
    registration.set('pelada', pelada);
  }

  await registration.save(null, { useMasterKey: true });
  return mapRegistrationForEventListItem(registration, eventId, participationFee);
});

Parse.Cloud.define('setEventRegistrationTeamSide', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const registrationId = String(request.params.registrationId || '').trim();
  const teamSide = request.params.teamSide === 'away' ? 'away' : request.params.teamSide === 'home' ? 'home' : '';
  if (!registrationId || !teamSide) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a inscricao e o time (mandante ou visitante).');
  }

  const registration = await new Parse.Query('EventRegistration').get(registrationId, {
    useMasterKey: true,
  });
  const event = registration.get('event');
  if (!event || !event.id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Inscricao sem evento.');
  }

  const eventObj = await assertEventAdmin(user, event.id);
  if (eventObj.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'So confrontos entre times usam lado mandante/visitante.');
  }
  if (registration.get('role') !== 'athlete') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'So atletas entram no confronto por time.');
  }

  registration.set('teamSide', teamSide);
  await registration.save(null, { useMasterKey: true });
  const participationFee = Number(eventObj.get('participationFee') || 0);
  const athleteResolved = await resolveRegistrationAthleteProfile(registration);
  return mapRegistrationForEventListItem(
    registration,
    eventObj.id,
    participationFee,
    athleteResolved.athlete
  );
});

// Contratacao suplementar
Parse.Cloud.define('createSupplementaryEventInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const invitedUserId = request.params.invitedUserId ? String(request.params.invitedUserId) : '';
  const offeredAmount = Number(request.params.offeredAmount ?? 0);
  const responseDeadlineRaw = request.params.responseDeadline;
  const kind =
    request.params.kind === 'marking_assistant' ? 'marking_assistant' : 'flag_assistant';

  if (!eventId || !invitedUserId) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'eventId e invitedUserId sao obrigatorios.'
    );
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um valor valido.');
  }
  const responseDeadline = responseDeadlineRaw ? new Date(responseDeadlineRaw) : null;
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe prazo valido para resposta.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Evento ja encerrado.');
  }

  const requiredRole = kind === 'marking_assistant' ? 'scout' : 'referee';
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', requiredRole)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce precisa estar confirmado neste evento.'
    );
  }

  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Inscricao nao confirmada neste evento.'
    );
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const duplicateQuery = new Parse.Query('RefereeInvitation');
  duplicateQuery.equalTo('event', event);
  duplicateQuery.equalTo('invitedUser', invitedUser);
  duplicateQuery.equalTo('role', requiredRole);
  duplicateQuery.containedIn('status', ['pending', 'accepted']);
  const duplicate = await duplicateQuery.first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este usuario ja possui convite ativo para este evento.'
    );
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', invitedUser)
    .first({ useMasterKey: true });
  if (existingReg) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este usuario ja esta inscrito neste evento.'
    );
  }

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  invitation.set('pelada', event.get('pelada'));
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', user);
  invitation.set('role', requiredRole);
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', offeredAmount);
  invitation.set('responseDeadline', responseDeadline);
  invitation.set('supplementaryKind', kind);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);

  if (request.params.invitedUserApelido) {
    invitation.set('invitedUserApelido', String(request.params.invitedUserApelido));
  }
  if (request.params.invitedUserFullName) {
    invitation.set('invitedUserFullName', String(request.params.invitedUserFullName));
  }
  if (request.params.invitedUserAvatarUrl) {
    invitation.set('invitedUserAvatarUrl', String(request.params.invitedUserAvatarUrl));
  }

  const inviterApelido = (user.get('apelido') || '').trim();
  const inviterFullName = (user.get('name') || '').trim();
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);
  invitation.set(
    'invitedByName',
    inviterApelido || inviterFullName || user.getUsername() || 'Convidante'
  );

  const saved = await invitation.save(null, { useMasterKey: true });
  return { objectId: saved.id };
});

Parse.Cloud.define('completeSupplementaryHiring', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = request.params.eventId ? String(request.params.eventId) : '';
  const role = request.params.role === 'scout' ? 'scout' : 'referee';
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', role)
    .first({ useMasterKey: true });

  if (!registration) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Inscricao nao encontrada neste evento.'
    );
  }

  registration.set('supplementaryHiringCompleted', true);
  await registration.save(null, { useMasterKey: true });
  return { ok: true };
});

Parse.Cloud.define('checkInviteeScheduleConflict', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const invitedUserId = request.params.invitedUserId
    ? String(request.params.invitedUserId)
    : '';
  const excludeEventId = request.params.excludeEventId
    ? String(request.params.excludeEventId)
    : '';
  if (!invitedUserId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'invitedUserId obrigatorio.');
  }

  const startTime = request.params.startTime ? new Date(request.params.startTime) : null;
  const endTime = request.params.endTime ? new Date(request.params.endTime) : null;
  if (
    !startTime ||
    Number.isNaN(startTime.getTime()) ||
    !endTime ||
    Number.isNaN(endTime.getTime())
  ) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um periodo valido.');
  }

  const includePending = !!request.params.includePending;
  return findUserScheduleConflictDetail(
    invitedUserId,
    startTime,
    endTime,
    excludeEventId,
    { includePending }
  );
});

function timesOverlap(startA, endA, startB, endB) {
  return !!startA && !!endA && !!startB && !!endB && startA < endB && startB < endA;
}

function resolveUserAvatarUrl(user) {
  if (!user || !user.get) return '';
  const direct = String(user.get('avatarUrl') || '').trim();
  if (direct) return direct;
  const file = user.get('avatar');
  if (file && typeof file.url === 'function') {
    try {
      return String(file.url() || '').trim();
    } catch {
      return '';
    }
  }
  if (file && file._url) return String(file._url).trim();
  return '';
}

async function findUserScheduleConflictDetail(
  userId,
  startTime,
  endTime,
  excludeEventId,
  options = {}
) {
  const includePending = !!(options && options.includePending);
  const invitedUser = Parse.User.createWithoutData(userId);
  const statuses = includePending ? ['pending', 'accepted'] : ['accepted'];

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedUser', invitedUser)
    .containedIn('status', statuses)
    .include('event')
    .limit(200)
    .find({ useMasterKey: true });

  for (const invitation of invitations) {
    const event = invitation.get('event');
    if (!event || !event.id || event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: invitation.get('status') === 'pending' ? 'pending_invitation' : 'invitation',
        invitationId: invitation.id,
        invitationStatus: invitation.get('status') || '',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart ? otherStart.toISOString() : null,
        endTime: otherEnd ? otherEnd.toISOString() : null,
      };
    }
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', invitedUser)
    .include('event')
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (!registration.get('isEffectivelyConfirmed')) continue;
    const event = registration.get('event');
    if (!event || !event.id || event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'registration',
        invitationId: null,
        invitationStatus: '',
        eventId: event.id,
        eventName: event.get('name') || 'Outro evento',
        startTime: otherStart ? otherStart.toISOString() : null,
        endTime: otherEnd ? otherEnd.toISOString() : null,
      };
    }
  }

  return { conflict: false };
}

Parse.Cloud.define('getInvitationAcceptConflicts', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const invitationId = String(request.params.invitationId || '').trim();
  if (!invitationId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'invitationId obrigatorio.');
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .include('event')
    .include('invitedUser')
    .get(invitationId, { useMasterKey: true });
  const invited = invitation.get('invitedUser');
  if (!invited || invited.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Este convite nao pertence a voce.');
  }
  const event = invitation.get('event');
  if (!event || !event.id) {
    return { conflicts: [] };
  }
  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  const conflicts = [];

  // Outro lado do mesmo confronto (pending/accepted).
  const sameEventOthers = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invited)
    .containedIn('status', ['pending', 'accepted'])
    .notEqualTo('objectId', invitationId)
    .limit(20)
    .find({ useMasterKey: true });
  for (const other of sameEventOthers) {
    conflicts.push({
      invitationId: other.id,
      invitationStatus: other.get('status') || '',
      source: 'same_event',
      eventId: event.id,
      eventName: event.get('name') || 'Confronto',
      teamSide: other.get('teamSide') || '',
      startTime: startTime ? startTime.toISOString() : null,
      endTime: endTime ? endTime.toISOString() : null,
      canDecline: other.get('status') === 'pending',
      hardBlock: other.get('status') === 'accepted',
    });
  }

  if (startTime && endTime) {
    const schedule = await findUserScheduleConflictDetail(
      invited.id,
      startTime,
      endTime,
      event.id,
      { includePending: true }
    );
    if (schedule && schedule.conflict) {
      const alreadyListed =
        schedule.invitationId &&
        conflicts.some((row) => row.invitationId === schedule.invitationId);
      if (!alreadyListed) {
        conflicts.push({
          invitationId: schedule.invitationId || null,
          invitationStatus: schedule.invitationStatus || '',
          source: schedule.source || 'invitation',
          eventId: schedule.eventId,
          eventName: schedule.eventName,
          teamSide: '',
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          canDecline: schedule.source === 'pending_invitation' && !!schedule.invitationId,
          hardBlock: schedule.source === 'invitation' || schedule.source === 'registration',
        });
      }
    }
  }

  return { conflicts };
});

async function findAmateurTeamScheduleConflict(teamId, startTime, endTime, opts = {}) {
  const excludeEventId = String(opts.excludeEventId || '').trim();
  const excludeChallengeId = String(opts.excludeChallengeId || '').trim();
  const teamPtr = Parse.Object.createWithoutData('AmateurTeam', teamId);

  const homeQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('homeTeam', teamPtr)
    .notEqualTo('isFinished', true);
  const awayQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('awayTeam', teamPtr)
    .notEqualTo('isFinished', true);
  const events = await Parse.Query.or(homeQ, awayQ).limit(100).find({ useMasterKey: true });
  for (const event of events) {
    if (event.id === excludeEventId) continue;
    const otherStart = event.get('startTime');
    const otherEnd = event.get('endTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'team_event',
        eventId: event.id,
        eventName: event.get('name') || 'Outro confronto',
        startTime: otherStart,
        endTime: otherEnd,
        teamId,
      };
    }
  }

  const asChallenger = new Parse.Query('MatchChallenge')
    .equalTo('challengerTeam', teamPtr)
    .containedIn('status', ['pending', 'accepted']);
  const asChallenged = new Parse.Query('MatchChallenge')
    .equalTo('challengedTeam', teamPtr)
    .containedIn('status', ['pending', 'accepted']);
  const challenges = await Parse.Query.or(asChallenger, asChallenged)
    .limit(50)
    .find({ useMasterKey: true });
  for (const challenge of challenges) {
    if (challenge.id === excludeChallengeId) continue;
    const otherStart = challenge.get('proposedStartTime');
    const otherEnd = challenge.get('proposedEndTime');
    if (timesOverlap(startTime, endTime, otherStart, otherEnd)) {
      return {
        conflict: true,
        source: 'challenge',
        challengeId: challenge.id,
        eventName:
          `${challenge.get('challengerTeamName') || 'Time'} x ${
            challenge.get('challengedTeamName') || 'Adversario'
          }`,
        startTime: otherStart,
        endTime: otherEnd,
        teamId,
      };
    }
  }

  return { conflict: false };
}

async function assertTeamsFreeForProposedMatch(
  challengerTeam,
  challengedTeam,
  startTime,
  endTime,
  opts = {}
) {
  const teams = [challengerTeam, challengedTeam].filter(Boolean);
  for (const team of teams) {
    const teamConflict = await findAmateurTeamScheduleConflict(team.id, startTime, endTime, opts);
    if (teamConflict.conflict) {
      const teamName = team.get('name') || 'Time';
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `${teamName} ja tem compromisso em "${teamConflict.eventName}" neste horario.`
      );
    }
    let president = team.get('president');
    if (president && president.id && !president.get) {
      president = await new Parse.Query(Parse.User).get(president.id, { useMasterKey: true });
    } else if (president && president.id && typeof president.fetch === 'function') {
      try {
        await president.fetch({ useMasterKey: true });
      } catch {
        /* usa pointer */
      }
    }
    if (president && president.id) {
      const userConflict = await findUserScheduleConflictDetail(
        president.id,
        startTime,
        endTime,
        opts.excludeEventId
      );
      if (userConflict.conflict) {
        const teamName = team.get('name') || 'Time';
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          `Presidente de ${teamName} ja tem compromisso em "${userConflict.eventName}" neste horario.`
        );
      }
    }
  }
}

function mapTeamMatchEventRow(event) {
  const homeTeam = event.get('homeTeam');
  const awayTeam = event.get('awayTeam');
  const admin = event.get('admin');
  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  const returnOf = event.get('returnOf');
  const homeShield = homeTeam && homeTeam.get ? homeTeam.get('shieldImage') : null;
  const awayShield = awayTeam && awayTeam.get ? awayTeam.get('shieldImage') : null;
  return {
    objectId: event.id,
    name: event.get('name') || '',
    type: 'team_match',
    startTime: startTime ? startTime.toISOString() : null,
    endTime: endTime ? endTime.toISOString() : null,
    homeTeamId: homeTeam && homeTeam.id ? homeTeam.id : undefined,
    awayTeamId: awayTeam && awayTeam.id ? awayTeam.id : undefined,
    homeTeamName:
      event.get('homeTeamName') || (homeTeam && homeTeam.get ? homeTeam.get('name') : '') || '',
    awayTeamName:
      event.get('awayTeamName') || (awayTeam && awayTeam.get ? awayTeam.get('name') : '') || '',
    homeTeamShieldUrl: homeShield && homeShield.url ? homeShield.url() : undefined,
    awayTeamShieldUrl: awayShield && awayShield.url ? awayShield.url() : undefined,
    adminId: admin && admin.id ? admin.id : '',
    hasReturnLeg: !!event.get('hasReturnLeg'),
    returnOfEventId: returnOf && returnOf.id ? returnOf.id : undefined,
    address: event.get('address') || {},
    locationComplement: event.get('locationComplement') || '',
    isFinished: !!event.get('isFinished'),
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
  };
}

async function loadUserAmateurTeams(user) {
  return new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(20)
    .find({ useMasterKey: true });
}

async function createTeamMatchInvitation(event, invitedUserId, invitedBy, teamSide, deadline, offeredAmount) {
  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  // Duplicata so no mesmo lado — outro time pode convocar o mesmo atleta (ele escolhe).
  const duplicateSameSide = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (duplicateSameSide) return duplicateSameSide;

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', invitedUser)
    .first({ useMasterKey: true });
  if (existingReg) return null;

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  if (event.get('pelada')) invitation.set('pelada', event.get('pelada'));
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', invitedBy);
  invitation.set('role', 'athlete');
  invitation.set('teamSide', teamSide);
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', Number(offeredAmount || 0));
  invitation.set('responseDeadline', deadline);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);
  const inviterApelido = (invitedBy.get('apelido') || '').trim();
  const inviterFullName = (invitedBy.get('name') || '').trim();
  invitation.set('invitedByName', inviterApelido || inviterFullName || invitedBy.getUsername() || 'Mandante');
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);
  const inviterAvatar = resolveUserAvatarUrl(invitedBy);
  if (inviterAvatar) invitation.set('invitedByAvatarUrl', inviterAvatar);
  await invitation.save(null, { useMasterKey: true });
  return invitation;
}

async function saveTeamMatchEvent(adminUser, payload) {
  if (!adminUser || !adminUser.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Administrador do confronto invalido.');
  }
  const event = new Parse.Object('Event');
  event.set('name', payload.name);
  event.set('type', 'team_match');
  event.set('startTime', payload.startTime);
  event.set('endTime', payload.endTime);
  event.set('address', payload.address || {});
  event.set('locationComplement', payload.locationComplement || '');
  // Admin = presidente do mandante desta perna (ida ou volta).
  event.set('admin', adminUser);
  event.set('readOnlyAt', new Date(payload.endTime.getTime() + 2 * 60 * 60 * 1000));
  event.set('registrationOpensAt', new Date());
  event.set('registrationClosesAt', payload.startTime);
  event.set('useArrivalOrderForTeams', false);
  event.set('participationFee', 0);
  event.set('isFinished', false);
  event.set('homeTeam', payload.homeTeam);
  event.set('awayTeam', payload.awayTeam);
  event.set('homeTeamName', payload.homeTeam.get('name') || payload.name);
  event.set('awayTeamName', payload.awayTeam.get('name') || '');
  event.set('homeAcceptsUninvitedAthletes', false);
  event.set('awayAcceptsUninvitedAthletes', false);
  event.set('athleteConvocationBy', 'president');
  if (payload.hasReturnLeg) event.set('hasReturnLeg', true);
  if (payload.returnOf) event.set('returnOf', payload.returnOf);
  if (payload.challengeConditions) {
    event.set('challengeConditions', String(payload.challengeConditions).trim().slice(0, 2000));
  }
  if (payload.matchChallenge) event.set('matchChallenge', payload.matchChallenge);
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setWriteAccess(adminUser.id, true);
  event.setACL(acl);
  await event.save(null, { useMasterKey: true });
  return event;
}

function teamMatchAddressHasContent(value) {
  if (!value || typeof value !== 'object') return false;
  return ['street', 'neighborhood', 'city', 'state', 'zipCode'].some((key) =>
    String(value[key] || '').trim()
  );
}

Parse.Cloud.define('createTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const challengeId = String(request.params.challengeId || '').trim();
  if (!challengeId) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Aceite um desafio antes de marcar o confronto.'
    );
  }
  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerTeam')
    .include('challengedTeam')
    .include('challengerUser')
    .get(challengeId, { useMasterKey: true });
  if (challenge.get('status') !== 'accepted') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O desafio precisa estar aceito.');
  }
  const challengerUser = challenge.get('challengerUser');
  if (!challengerUser || challengerUser.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas quem enviou o desafio pode marcar o confronto apos o aceite.'
    );
  }
  if (challenge.get('eventId')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este desafio ja gerou um confronto.');
  }

  const homeTeamId = String(
    request.params.homeTeamId || (challenge.get('challengerTeam') && challenge.get('challengerTeam').id) || ''
  ).trim();
  const awayTeamId = String(
    request.params.awayTeamId || (challenge.get('challengedTeam') && challenge.get('challengedTeam').id) || ''
  ).trim();
  if (!homeTeamId || !awayTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time mandante e o visitante.');
  }
  if (homeTeamId === awayTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Mandante e visitante precisam ser times diferentes.');
  }

  const startTime = request.params.startTime
    ? new Date(request.params.startTime)
    : challenge.get('proposedStartTime')
      ? new Date(challenge.get('proposedStartTime'))
      : null;
  const endTime = request.params.endTime
    ? new Date(request.params.endTime)
    : challenge.get('proposedEndTime')
      ? new Date(challenge.get('proposedEndTime'))
      : null;
  if (!startTime || Number.isNaN(startTime.getTime()) || !endTime || Number.isNaN(endTime.getTime())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do confronto.');
  }
  if (endTime <= startTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }

  const homeTeam = await new Parse.Query('AmateurTeam').include('president').get(homeTeamId, {
    useMasterKey: true,
  });
  const awayTeam = await new Parse.Query('AmateurTeam').include('president').get(awayTeamId, {
    useMasterKey: true,
  });
  const homePresident = homeTeam.get('president');
  if (!homePresident || homePresident.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'So o presidente do time mandante pode marcar o confronto.'
    );
  }

  await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, startTime, endTime, {
    excludeChallengeId: challenge.id,
  });

  const homeName = String(homeTeam.get('name') || 'Mandante').trim();
  const awayName = String(awayTeam.get('name') || 'Visitante').trim();
  const name = String(request.params.name || '').trim() || `${homeName} x ${awayName}`;
  const addressFromChallenge =
    challenge.get('proposedAddress') && typeof challenge.get('proposedAddress') === 'object'
      ? challenge.get('proposedAddress')
      : {};
  const address =
    request.params.address && typeof request.params.address === 'object'
      ? request.params.address
      : addressFromChallenge;
  const locationComplement = String(
    request.params.locationComplement || challenge.get('proposedLocationComplement') || ''
  ).trim();

  const athleteInvitesRaw = Array.isArray(request.params.athleteInvites)
    ? request.params.athleteInvites
    : [];
  const athleteInvites = [];
  const seenAthleteIds = new Set();
  for (const row of athleteInvitesRaw) {
    const userId = String((row && row.userId) || '').trim();
    if (!userId || seenAthleteIds.has(userId) || userId === user.id) continue;
    seenAthleteIds.add(userId);
    athleteInvites.push({
      userId,
      offeredAmount: Math.max(0, Number((row && row.offeredAmount) || 0)),
    });
  }
  if (!athleteInvites.length && Array.isArray(request.params.athleteUserIds)) {
    const defaultOffer = Math.max(0, Number(request.params.offeredAmount || 0));
    for (const id of request.params.athleteUserIds) {
      const userId = String(id || '').trim();
      if (!userId || seenAthleteIds.has(userId) || userId === user.id) continue;
      seenAthleteIds.add(userId);
      athleteInvites.push({ userId, offeredAmount: defaultOffer });
    }
  }
  athleteInvites.splice(40);

  const deadlineRaw = request.params.responseDeadline
    ? new Date(request.params.responseDeadline)
    : new Date(Date.now() + 48 * 60 * 60 * 1000);
  const deadline =
    deadlineRaw && !Number.isNaN(deadlineRaw.getTime()) && deadlineRaw > new Date()
      ? deadlineRaw
      : new Date(Date.now() + 2 * 60 * 60 * 1000);

  for (const invite of athleteInvites) {
    const athleteConflict = await findUserScheduleConflictDetail(
      invite.userId,
      startTime,
      endTime,
      ''
    );
    if (athleteConflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Atleta ja tem compromisso em "${athleteConflict.eventName}" neste horario (ida).`
      );
    }
  }

  let returnStart = null;
  let returnEnd = null;
  let returnAddressForLeg = null;
  let returnComplementForLeg = '';
  const forceReturnLeg = !!challenge.get('hasReturnLeg') || !!request.params.returnLeg;
  if (forceReturnLeg) {
    returnStart = request.params.returnStartTime ? new Date(request.params.returnStartTime) : null;
    returnEnd = request.params.returnEndTime ? new Date(request.params.returnEndTime) : null;
    if (!returnStart || Number.isNaN(returnStart.getTime())) {
      const storedStart = challenge.get('returnStartTime');
      returnStart = storedStart ? new Date(storedStart) : null;
    }
    if (!returnEnd || Number.isNaN(returnEnd.getTime())) {
      const storedEnd = challenge.get('returnEndTime');
      returnEnd = storedEnd ? new Date(storedEnd) : null;
    }
    if (!returnStart || Number.isNaN(returnStart.getTime()) || !returnEnd || Number.isNaN(returnEnd.getTime())) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do jogo da volta.');
    }
    const requestedReturnAddress =
      request.params.returnAddress && typeof request.params.returnAddress === 'object'
        ? request.params.returnAddress
        : null;
    const storedReturnAddress = challenge.get('returnAddress');
    returnAddressForLeg = teamMatchAddressHasContent(requestedReturnAddress)
      ? requestedReturnAddress
      : teamMatchAddressHasContent(storedReturnAddress)
        ? storedReturnAddress
        : address;
    const requestedComplement = String(request.params.returnLocationComplement || '').trim();
    returnComplementForLeg = (
      requestedComplement ||
      String(challenge.get('returnLocationComplement') || '').trim() ||
      String(locationComplement || '')
    ).trim();
    if (returnEnd <= returnStart) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino da volta deve ser apos o inicio.');
    }
    await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, returnStart, returnEnd, {
      excludeChallengeId: challenge.id,
    });
    for (const invite of athleteInvites) {
      const athleteConflict = await findUserScheduleConflictDetail(
        invite.userId,
        returnStart,
        returnEnd,
        ''
      );
      if (athleteConflict.conflict) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          `Atleta ja tem compromisso em "${athleteConflict.eventName}" neste horario (volta).`
        );
      }
    }
  }

  const challengeConditions = String(
    request.params.challengeConditions ||
      challenge.get('challengeConditions') ||
      ''
  )
    .trim()
    .slice(0, 2000);
  const returnChallengeConditions = String(
    request.params.returnChallengeConditions ||
      challenge.get('returnChallengeConditions') ||
      challengeConditions
  )
    .trim()
    .slice(0, 2000);

  // Garante campos de avatar do presidente no convite.
  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* segue com sessao atual */
  }

  const first = await saveTeamMatchEvent(homePresident, {
    name,
    startTime,
    endTime,
    address,
    locationComplement,
    homeTeam,
    awayTeam,
    hasReturnLeg: forceReturnLeg,
    challengeConditions,
    matchChallenge: challenge,
  });

  let second = null;
  if (forceReturnLeg) {
    const awayPresident = awayTeam.get('president');
    if (!awayPresident || !awayPresident.id) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Time visitante sem presidente para administrar a volta.'
      );
    }
    second = await saveTeamMatchEvent(awayPresident, {
      name: `${awayName} x ${homeName}`,
      startTime: returnStart,
      endTime: returnEnd,
      address: returnAddressForLeg || address,
      locationComplement: returnComplementForLeg,
      homeTeam: awayTeam,
      awayTeam: homeTeam,
      returnOf: first,
      challengeConditions: returnChallengeConditions,
      matchChallenge: challenge,
    });
  }

  challenge.set('eventId', first.id);
  if (second && second.id) challenge.set('returnEventId', second.id);
  challenge.set('status', 'scheduled');
  await challenge.save(null, { useMasterKey: true });

  // Convite por data: ida e, se houver, volta (cada um com seu evento).
  for (const invite of athleteInvites) {
    await createTeamMatchInvitation(
      first,
      invite.userId,
      user,
      'home',
      deadline,
      invite.offeredAmount
    );
    if (second) {
      await createTeamMatchInvitation(
        second,
        invite.userId,
        user,
        'away',
        deadline,
        invite.offeredAmount
      );
    }
  }

  let audienceIds = [];
  try {
    if (typeof collectTeamMatchNotifyUserIds === 'function') {
      audienceIds = await collectTeamMatchNotifyUserIds(first);
    } else {
      const awayPresident = awayTeam.get('president');
      if (awayPresident && awayPresident.id) audienceIds.push(awayPresident.id);
    }
  } catch (error) {
    console.error('collectTeamMatchNotifyUserIds failed', error);
    const awayPresident = awayTeam.get('president');
    if (awayPresident && awayPresident.id) audienceIds = [awayPresident.id];
  }

  let push = { audience: 0, devicesMatched: 0 };
  try {
    push = await notifyTeamMatchStakeholders(first, audienceIds, user.id);
  } catch (error) {
    console.error('notifyTeamMatchStakeholders failed', error);
  }

  // Mesmo publico do push: elenco, presidentes, confirmados e contratados aceitos.
  if (typeof createAppMessages === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(first.get('startTime')) : '';
    await createAppMessages(audienceIds, {
      senderId: user.id,
      kind: 'team_match_created',
      title: `Novo confronto: ${homeName} x ${awayName}`,
      body:
        `O confronto ${homeName} x ${awayName} foi marcado` +
        (dateLabel ? ` para ${dateLabel}.` : '.') +
        ' Abra o confronto para ver os detalhes.',
      relatedClass: 'Event',
      relatedId: first.id,
      actionRoute: `/event/${first.id}`,
    });
  }

  return {
    event: mapTeamMatchEventRow(first),
    returnEvent: second ? mapTeamMatchEventRow(second) : null,
    invitedAthletes: athleteInvites.length,
    push,
  };
});

async function mergeTeamMatchEventsById(byId, eventIds) {
  const missing = [...new Set(eventIds.map((id) => String(id || '').trim()).filter(Boolean))].filter(
    (id) => !byId.has(id)
  );
  if (!missing.length) return;
  const extraQuery = new Parse.Query('Event');
  extraQuery.equalTo('type', 'team_match');
  extraQuery.containedIn('objectId', missing);
  extraQuery.include('homeTeam');
  extraQuery.include('awayTeam');
  extraQuery.limit(100);
  const extraRows = await extraQuery.find({ useMasterKey: true });
  for (const row of extraRows) {
    byId.set(row.id, row);
  }
}

async function attachReturnLegsForTeamMatches(byId) {
  const roots = Array.from(byId.values()).filter((event) => !event.get('returnOf'));
  if (!roots.length) return;
  const returnQuery = new Parse.Query('Event');
  returnQuery.equalTo('type', 'team_match');
  returnQuery.containedIn('returnOf', roots);
  returnQuery.include('homeTeam');
  returnQuery.include('awayTeam');
  returnQuery.limit(100);
  const returnRows = await returnQuery.find({ useMasterKey: true });
  for (const row of returnRows) {
    byId.set(row.id, row);
  }
}

function sortTeamMatchEventsDesc(merged) {
  merged.sort((a, b) => {
    const ta = a.get('startTime') ? a.get('startTime').getTime() : 0;
    const tb = b.get('startTime') ? b.get('startTime').getTime() : 0;
    return tb - ta;
  });
  return merged;
}

Parse.Cloud.define('listMyTeamMatches', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await loadUserAmateurTeams(user);
  const teamPointers = teams.map((team) =>
    Parse.Object.createWithoutData('AmateurTeam', team.id)
  );
  const adminQuery = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('admin', user);
  const queries = [adminQuery];
  if (teamPointers.length) {
    queries.push(
      new Parse.Query('Event').equalTo('type', 'team_match').containedIn('homeTeam', teamPointers)
    );
    queries.push(
      new Parse.Query('Event').equalTo('type', 'team_match').containedIn('awayTeam', teamPointers)
    );
  }
  const query = queries.length === 1 ? adminQuery : Parse.Query.or(...queries);
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('startTime');
  query.limit(80);
  const rows = await query.find({ useMasterKey: true });
  const byId = new Map();
  for (const row of rows) {
    byId.set(row.id, row);
  }

  const asChallenger = new Parse.Query('MatchChallenge').equalTo('challengerUser', user);
  const asChallenged = new Parse.Query('MatchChallenge').equalTo('challengedUser', user);
  const linkedChallenges = await Parse.Query.or(asChallenger, asChallenged)
    .exists('eventId')
    .limit(80)
    .find({ useMasterKey: true });
  const linkedEventIds = [];
  for (const challenge of linkedChallenges) {
    linkedEventIds.push(String(challenge.get('eventId') || '').trim());
    linkedEventIds.push(String(challenge.get('returnEventId') || '').trim());
  }
  await mergeTeamMatchEventsById(byId, linkedEventIds);
  await attachReturnLegsForTeamMatches(byId);

  return sortTeamMatchEventsDesc(Array.from(byId.values()))
    .slice(0, 80)
    .map(mapTeamMatchEventRow);
});

/** Feed publico de confrontos (todos os usuarios), semelhante a listPeladasForFeed. */
Parse.Cloud.define('listTeamMatchesForFeed', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const query = new Parse.Query('Event');
  query.equalTo('type', 'team_match');
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('startTime');
  query.limit(100);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapTeamMatchEventRow);
});

/**
 * Desanexa confrontos de pelada e ajusta admin = presidente do mandante.
 * Idempotente; chamada pelo app no feed de confrontos.
 */
Parse.Cloud.define('repairTeamMatchOwnership', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const query = new Parse.Query('Event');
  query.equalTo('type', 'team_match');
  query.include('homeTeam');
  query.include('homeTeam.president');
  query.include('admin');
  query.limit(200);
  const rows = await query.find({ useMasterKey: true });
  let detachedPelada = 0;
  let fixedAdmin = 0;
  for (const event of rows) {
    let dirty = false;
    if (event.get('pelada')) {
      event.unset('pelada');
      dirty = true;
      detachedPelada += 1;
    }
    const homeTeam = event.get('homeTeam');
    let president = homeTeam && homeTeam.get ? homeTeam.get('president') : null;
    if (homeTeam && homeTeam.id && (!president || !president.id)) {
      try {
        const team = await new Parse.Query('AmateurTeam')
          .include('president')
          .get(homeTeam.id, { useMasterKey: true });
        president = team.get('president');
      } catch {
        president = null;
      }
    }
    if (president && president.id) {
      const currentAdmin = event.get('admin');
      if (!currentAdmin || currentAdmin.id !== president.id) {
        event.set('admin', president);
        dirty = true;
        fixedAdmin += 1;
      }
      const acl = new Parse.ACL();
      acl.setPublicReadAccess(true);
      acl.setWriteAccess(president.id, true);
      event.setACL(acl);
      dirty = true;
    }
    if (dirty) {
      await event.save(null, { useMasterKey: true });
    }
  }
  return { scanned: rows.length, detachedPelada, fixedAdmin };
});

Parse.Cloud.define('listTeamMatchInboxNotices', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await loadUserAmateurTeams(user);
  if (!teams.length) return [];
  const teamPointers = teams.map((team) =>
    Parse.Object.createWithoutData('AmateurTeam', team.id)
  );
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const asAway = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .containedIn('awayTeam', teamPointers);
  const asHome = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .containedIn('homeTeam', teamPointers);
  const query = Parse.Query.or(asAway, asHome);
  query.notEqualTo('admin', user);
  query.greaterThan('createdAt', since);
  query.notEqualTo('isFinished', true);
  query.include('homeTeam');
  query.include('awayTeam');
  query.descending('createdAt');
  query.limit(30);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapTeamMatchEventRow);
});

// --- 10-pelada.js ---

/** Pelada — socios, participantes e apresentacao de perfil */

// Participantes da pelada
Parse.Cloud.define('listPeladaEventParticipants', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }

  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode listar participantes.'
    );
  }

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (!events.length) {
    return [];
  }

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.containedIn('event', events);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });

  const byUser = {};

  for (const row of registrations) {
    const userPtr = row.get('user');
    const userId =
      row.get('participantUserId') || (userPtr && userPtr.id ? userPtr.id : null);
    if (!userId) continue;

    const role = row.get('role') || 'athlete';
    const apelido =
      row.get('apelido') ||
      row.get('userApelido') ||
      '';
    const fullName = row.get('userFullName') || '';
    const displayName =
      apelido ||
      row.get('userDisplayName') ||
      fullName ||
      'Participante';
    const avatarUrl = row.get('avatarUrl') || '';

    if (!byUser[userId]) {
      byUser[userId] = {
        userId,
        userName: displayName,
        apelido: apelido || '',
        fullName: fullName || undefined,
        roles: [role],
        avatarUrl: avatarUrl || undefined,
      };
    } else {
      if (!byUser[userId].roles.includes(role)) {
        byUser[userId].roles.push(role);
      }
      if (!byUser[userId].apelido && apelido) {
        byUser[userId].apelido = apelido;
      }
      if (!byUser[userId].fullName && fullName) {
        byUser[userId].fullName = fullName;
      }
      if (!byUser[userId].avatarUrl && avatarUrl) {
        byUser[userId].avatarUrl = avatarUrl;
      }
    }
  }

  return Object.values(byUser).sort((a, b) =>
    a.userName.localeCompare(b.userName, 'pt-BR')
  );
});

// Socios e exibicao da pelada
function buildMemberDisplay(user, membership) {
  const apelido = membership.get('memberApelido') || user.get('apelido') || '';
  const fullName = membership.get('memberFullName') || user.get('name') || '';
  const displayName =
    membership.get('memberDisplayName') ||
    apelido ||
    fullName ||
    user.getUsername() ||
    'Socio';
  const avatarUrl = membership.get('memberAvatarUrl') || user.get('avatarUrl') || '';

  if (!membership.get('memberDisplayName')) {
    membership.set('memberApelido', apelido);
    membership.set('memberFullName', fullName);
    membership.set('memberDisplayName', displayName);
    if (avatarUrl) membership.set('memberAvatarUrl', avatarUrl);
  }
  if (!membership.get('memberUserId') && user.id) {
    membership.set('memberUserId', user.id);
  }

  return { apelido, fullName, displayName, avatarUrl };
}

/** Resolve e corrige campos de exibicao do admin a partir do ponteiro real. */
async function resolvePeladaAdminDisplay(pelada, { persist = true } = {}) {
  const adminPtr = pelada.get('admin');
  if (!adminPtr || !adminPtr.id) {
    return {
      adminId: '',
      adminApelido: pelada.get('adminApelido') || undefined,
      adminName: pelada.get('adminName') || 'Administrador',
      adminAvatarUrl: pelada.get('adminAvatarUrl') || undefined,
    };
  }

  const admin = await adminPtr.fetch({ useMasterKey: true });
  const apelido = (admin.get('apelido') || '').trim();
  const fullName = (admin.get('name') || '').trim();
  const adminName = apelido || fullName || admin.getUsername() || 'Administrador';
  const adminAvatarUrl = (admin.get('avatarUrl') || '').trim();

  const storedApelido = (pelada.get('adminApelido') || '').trim();
  const storedName = (pelada.get('adminName') || '').trim();
  const storedUserId = (pelada.get('adminUserId') || '').trim();
  const storedAvatar = (pelada.get('adminAvatarUrl') || '').trim();
  const needsHeal =
    storedUserId !== admin.id ||
    storedApelido !== apelido ||
    storedName !== adminName ||
    (adminAvatarUrl && storedAvatar !== adminAvatarUrl);

  if (persist && needsHeal) {
    pelada.set('adminUserId', admin.id);
    pelada.set('adminApelido', apelido);
    pelada.set('adminName', adminName);
    if (adminAvatarUrl) {
      pelada.set('adminAvatarUrl', adminAvatarUrl);
    }
    await pelada.save(null, { useMasterKey: true });
  }

  return {
    adminId: admin.id,
    adminApelido: apelido || undefined,
    adminName,
    adminAvatarUrl: adminAvatarUrl || undefined,
  };
}

Parse.Cloud.define('getPeladaDisplayInfo', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const display = await resolvePeladaAdminDisplay(pelada, { persist: true });
  return {
    adminId: display.adminId || undefined,
    adminApelido: display.adminApelido,
    adminName: display.adminName,
    adminAvatarUrl: display.adminAvatarUrl,
  };
});

/** Lista peladas do feed com admin resolvido via Master Key (evita nome/admin errados por cache desnormalizado). */
Parse.Cloud.define('listPeladasForFeed', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const query = new Parse.Query('Pelada');
  query.limit(100);
  query.ascending('name');
  const results = await query.find({ useMasterKey: true });
  const currentUserId = request.user.id;
  const rows = [];
  const toHeal = [];

  for (const pelada of results) {
    const adminPtr = pelada.get('admin');
    let adminId = String(
      (adminPtr && adminPtr.id ? adminPtr.id : '') || pelada.get('adminUserId') || ''
    ).trim();
    let adminApelido = (pelada.get('adminApelido') || '').trim();
    let adminName = (pelada.get('adminName') || '').trim();
    let adminAvatarUrl = (pelada.get('adminAvatarUrl') || '').trim();

    if (adminPtr && adminPtr.id) {
      adminId = String(adminPtr.id);
      try {
        const admin = await adminPtr.fetch({ useMasterKey: true });
        adminId = String(admin.id || adminId);
        const apelido = (admin.get('apelido') || '').trim();
        const fullName = (admin.get('name') || '').trim();
        const displayName = apelido || fullName || admin.getUsername() || 'Administrador';
        const avatarUrl = (admin.get('avatarUrl') || '').trim();

        const needsHeal =
          String(pelada.get('adminUserId') || '') !== adminId ||
          adminApelido !== apelido ||
          adminName !== displayName ||
          (avatarUrl && adminAvatarUrl !== avatarUrl);

        if (needsHeal) {
          pelada.set('adminUserId', adminId);
          pelada.set('adminApelido', apelido);
          pelada.set('adminName', displayName);
          if (avatarUrl) {
            pelada.set('adminAvatarUrl', avatarUrl);
          }
          toHeal.push(pelada);
        }

        adminApelido = apelido;
        adminName = displayName;
        adminAvatarUrl = avatarUrl || adminAvatarUrl;
      } catch (error) {
        // Mantem ponteiro/adminUserId mesmo se o User nao puder ser lido.
      }
    }

    // Fallback: membership role=admin quando ponteiro/adminUserId estiverem ausentes.
    if (!adminId) {
      try {
        const adminMembership = await new Parse.Query('PeladaMembership')
          .equalTo('pelada', pelada)
          .equalTo('role', 'admin')
          .equalTo('status', 'active')
          .first({ useMasterKey: true });
        const memberUser = adminMembership ? adminMembership.get('user') : null;
        if (memberUser && memberUser.id) {
          adminId = String(memberUser.id);
        }
      } catch {
        // ignora
      }
    }

    const address = pelada.get('address') || {};
    rows.push({
      objectId: pelada.id,
      name: pelada.get('name') || '',
      sport: pelada.get('sport') || 'campo',
      adminId: adminId || '',
      adminName: adminName || adminApelido || 'Administrador',
      adminApelido: adminApelido || undefined,
      adminAvatarUrl: adminAvatarUrl || undefined,
      adminPhotoUrl: pelada.get('adminPhoto') ? pelada.get('adminPhoto').url() : undefined,
      address,
      locationPhotoUrl: pelada.get('locationPhoto')
        ? pelada.get('locationPhoto').url()
        : undefined,
      memberCount: Number(pelada.get('memberCount') || 0),
      foundedAt: pelada.get('foundedAt') || undefined,
      monthlyFee: Number(pelada.get('monthlyFee') || 0),
      socioGoodStandingPaymentExempt: !!pelada.get('socioGoodStandingPaymentExempt'),
      expulsionBanEventCount: Number(pelada.get('expulsionBanEventCount') || 0),
      caixaMembersOnly: pelada.get('caixaMembersOnly') !== false,
      maxSocios: Number(pelada.get('maxSocios') || 0),
      maxAthletesPerEvent: Number(pelada.get('maxAthletesPerEvent') || 0),
      statsConflictSource: pelada.get('statsConflictSource') === 'scout' ? 'scout' : 'referee',
      requireProfilePresentationOnFirstEvent: !!pelada.get(
        'requireProfilePresentationOnFirstEvent'
      ),
      allowTeamSplitAfterEventEnd: !!pelada.get('allowTeamSplitAfterEventEnd'),
      isCurrentUserAdmin: !!adminId && adminId === currentUserId,
    });
  }

  if (toHeal.length) {
    await Parse.Object.saveAll(toHeal, { useMasterKey: true });
  }

  const heldEventCountByPelada = {};
  const heldParticipantSumByPelada = {};
  if (results.length) {
    const eventQuery = new Parse.Query('Event');
    eventQuery.containedIn('pelada', results);
    eventQuery.select(['pelada', 'teamSplit', 'participationFee']);
    eventQuery.limit(10000);
    const events = await eventQuery.find({ useMasterKey: true });
    const heldEvents = [];
    const feeByEventId = new Map();
    for (const event of events) {
      const peladaPtr = event.get('pelada');
      const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
      if (!peladaId) continue;
      // Evento realizado: no minimo houve separacao de times salva.
      if (typeof hasSavedTeamSplit === 'function') {
        if (!hasSavedTeamSplit(event)) continue;
      } else {
        const split = event.get('teamSplit');
        const teams = split && Array.isArray(split.teams) ? split.teams : null;
        if (!teams || !teams.some((team) => Array.isArray(team) && team.length > 0)) {
          continue;
        }
      }
      heldEventCountByPelada[peladaId] = (heldEventCountByPelada[peladaId] || 0) + 1;
      feeByEventId.set(event.id, Number(event.get('participationFee') || 0));
      heldEvents.push(event);
    }

    if (heldEvents.length) {
      const regQuery = new Parse.Query('EventRegistration');
      regQuery.containedIn('event', heldEvents);
      regQuery.containedIn('role', ['athlete', 'goalkeeper']);
      regQuery.limit(10000);
      const regs = await regQuery.find({ useMasterKey: true });
      const countByEvent = new Map();
      for (const reg of regs) {
        const eventPtr = reg.get('event');
        const eventId = eventPtr && eventPtr.id ? eventPtr.id : '';
        if (!eventId) continue;
        const fee = feeByEventId.get(eventId) || 0;
        const confirmed =
          typeof computeRegistrationEffectiveConfirmation === 'function'
            ? computeRegistrationEffectiveConfirmation(reg, fee)
            : !!reg.get('paymentConfirmed') ||
              !!reg.get('invitedByContract') ||
              fee <= 0;
        if (!confirmed) continue;
        countByEvent.set(eventId, (countByEvent.get(eventId) || 0) + 1);
      }
      for (const event of heldEvents) {
        const peladaPtr = event.get('pelada');
        const peladaId = peladaPtr && peladaPtr.id ? peladaPtr.id : '';
        if (!peladaId) continue;
        const n = countByEvent.get(event.id) || 0;
        heldParticipantSumByPelada[peladaId] =
          (heldParticipantSumByPelada[peladaId] || 0) + n;
      }
    }
  }

  for (const row of rows) {
    const held = heldEventCountByPelada[row.objectId] || 0;
    row.heldEventCount = held;
    const sum = heldParticipantSumByPelada[row.objectId] || 0;
    row.avgParticipantsPerEvent = held > 0 ? Math.round((sum / held) * 10) / 10 : 0;
  }

  return rows;
});

Parse.Cloud.define('listPeladaActiveSocios', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const query = new Parse.Query('PeladaMembership');
  query.equalTo('pelada', pelada);
  query.equalTo('status', 'active');
  query.ascending('joinedAt');
  query.limit(500);
  const memberships = await query.find({ useMasterKey: true });

  const rows = [];
  const toSave = [];

  for (const membership of memberships) {
    const user = await membership.get('user').fetch({ useMasterKey: true });
    const display = buildMemberDisplay(user, membership);
    if (!membership.get('memberDisplayName')) {
      toSave.push(membership);
    }

    rows.push({
      membershipId: membership.id,
      userId: membership.get('memberUserId') || user.id,
      displayName: display.displayName,
      userName: display.displayName,
      apelido: display.apelido || undefined,
      fullName: display.fullName || undefined,
      avatarUrl: display.avatarUrl || undefined,
      role: membership.get('role') || 'socio',
      joinedAt: membership.get('joinedAt'),
    });
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
});

const MEMBERSHIP_STATUS_PRIORITY = { active: 3, pending: 2, inactive: 1 };

Parse.Cloud.define('listPeladaMembershipsForAdmin', async (request) => {
  const peladaId = request.params.peladaId;
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== request.user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode listar socios.'
    );
  }

  const memberships = await new Parse.Query('PeladaMembership')
    .equalTo('pelada', pelada)
    .limit(1000)
    .find({ useMasterKey: true });

  const byUser = {};
  const toSave = [];

  for (const membership of memberships) {
    const userPtr = membership.get('user');
    if (!userPtr) continue;

    const user = await userPtr.fetch({ useMasterKey: true });
    const userId = membership.get('memberUserId') || user.id;
    if (!userId) continue;

    if (!membership.get('memberUserId')) {
      membership.set('memberUserId', userId);
      toSave.push(membership);
    }

    const display = buildMemberDisplay(user, membership);
    const status = membership.get('status') || 'pending';
    const row = {
      objectId: membership.id,
      userId,
      status,
      role: membership.get('role') || 'socio',
      joinedAt: membership.get('joinedAt'),
      displayName: display.displayName,
      apelido: display.apelido || undefined,
      fullName: display.fullName || undefined,
      avatarUrl: display.avatarUrl || undefined,
    };

    const existing = byUser[userId];
    if (
      !existing ||
      MEMBERSHIP_STATUS_PRIORITY[status] > MEMBERSHIP_STATUS_PRIORITY[existing.status]
    ) {
      byUser[userId] = row;
    }
  }

  if (toSave.length) {
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
  }

  return Object.values(byUser);
});

// Coleta de participantes por escopo
async function collectPeladaPreviousEventParticipantUserIds(peladaId, excludeEventId) {
  const ids = new Set();
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  if (excludeEventId) {
    eventQuery.notEqualTo('objectId', String(excludeEventId));
  }
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (!events.length) {
    return ids;
  }

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.containedIn('event', events);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });
  for (const row of registrations) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }

  return ids;
}

async function collectPeladaParticipantUserIds(peladaId) {
  const ids = new Set();
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);

  const byPeladaReg = new Parse.Query('EventRegistration');
  byPeladaReg.equalTo('peladaId', peladaId);
  byPeladaReg.limit(2000);
  const peladaRegs = await byPeladaReg.find({ useMasterKey: true });
  for (const row of peladaRegs) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }

  const eventQuery = new Parse.Query('Event');
  eventQuery.equalTo('pelada', pelada);
  eventQuery.limit(500);
  const events = await eventQuery.find({ useMasterKey: true });
  if (events.length) {
    const regQuery = new Parse.Query('EventRegistration');
    regQuery.containedIn('event', events);
    regQuery.limit(2000);
    const registrations = await regQuery.find({ useMasterKey: true });
    for (const row of registrations) {
      const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
      if (userId) ids.add(String(userId));
    }
  }

  const membershipQuery = new Parse.Query('PeladaMembership');
  membershipQuery.equalTo('pelada', pelada);
  membershipQuery.equalTo('status', 'active');
  membershipQuery.limit(2000);
  const memberships = await membershipQuery.find({ useMasterKey: true });
  for (const row of memberships) {
    const userPtr = row.get('user');
    if (userPtr && userPtr.id) ids.add(String(userPtr.id));
  }

  return ids;
}

async function collectEventParticipantUserIds(eventId) {
  const ids = new Set();
  const event = Parse.Object.extend('Event').createWithoutData(eventId);

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.equalTo('event', event);
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });
  for (const row of registrations) {
    const userId = row.get('participantUserId') || (row.get('user') && row.get('user').id);
    if (userId) ids.add(String(userId));
  }
  return ids;
}

// Helpers de administracao da pelada
async function assertPeladaAdminUser(peladaId, user) {
  const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
  const admin = pelada.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador da pelada pode realizar esta acao.'
    );
  }
  return pelada;
}

async function getPeladaFromEvent(event) {
  const peladaPtr = event.get('pelada');
  if (!peladaPtr || !peladaPtr.id) {
    return null;
  }
  try {
    return await new Parse.Query('Pelada').get(peladaPtr.id, { useMasterKey: true });
  } catch {
    return null;
  }
}

function registrationCountsAsApprovedParticipation(registration) {
  const status = registration.get('profilePresentationStatus');
  if (status === 'approved') {
    return true;
  }
  if (status === 'pending' || status === 'rejected') {
    return false;
  }
  // Inscricoes antigas (sem status) contam como ja aprovadas.
  return true;
}

async function userHasApprovedPeladaParticipation(peladaId, userId) {
  const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', peladaPtr)
    .limit(500)
    .find({ useMasterKey: true });
  if (!events.length) {
    return false;
  }

  const userPtr = Parse.User.createWithoutData(userId);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .containedIn('event', events)
    .limit(500)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    if (registrationCountsAsApprovedParticipation(registration)) {
      return true;
    }
  }
  return false;
}

Parse.Cloud.define('checkProfilePresentationRequired', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.get('requireProfilePresentationOnFirstEvent')) {
    return { required: false };
  }

  const hasPrior = await userHasApprovedPeladaParticipation(pelada.id, user.id);
  return { required: !hasPrior };
});

// Revisao de participacao
async function getAppWideAthleteCombinedScore(userId) {
  const performances = await loadMuralPerformanceRows('app');
  let performanceScore = 0;
  for (const perf of performances) {
    const role = perf.get('role');
    if (role !== 'athlete' && role !== 'goalkeeper') continue;
    const perfUserId = getPerformanceParticipantId(perf);
    if (perfUserId !== userId) continue;
    performanceScore += computePerformanceScore(perf);
  }

  const votes = await loadMuralVoteRows('app');
  let total = 0;
  let count = 0;
  for (const vote of votes) {
    if (vote.get('targetRole') !== 'athlete') continue;
    const targetUser = vote.get('targetUser');
    const targetUserId =
      vote.get('targetUserId') || (targetUser && targetUser.id ? targetUser.id : '');
    if (targetUserId !== userId) continue;
    total += Number(vote.get('score') || 0);
    count += 1;
  }

  const averageScore = count > 0 ? total / count : 0;
  return performanceScore + averageScore * 10;
}

async function collectRefereeObservationsForUser(userId) {
  const userPtr = Parse.User.createWithoutData(userId);
  const byUser = new Parse.Query('EventPerformance');
  byUser.equalTo('user', userPtr);
  const byParticipant = new Parse.Query('EventPerformance');
  byParticipant.equalTo('participantUserId', userId);
  const performances = await Parse.Query.or(byUser, byParticipant)
    .include('event')
    .include('event.pelada')
    .descending('updatedAt')
    .limit(200)
    .find({ useMasterKey: true });

  const rows = [];
  for (const perf of performances) {
    const observation = String(perf.get('refereeObservation') || '').trim();
    if (!observation) continue;
    const event = perf.get('event');
    const pelada = event && event.get ? event.get('pelada') : null;
    const startTime = event && event.get ? event.get('startTime') : null;
    rows.push({
      eventId: event && event.id ? event.id : '',
      eventName: (event && event.get && event.get('name')) || 'Evento',
      peladaName: pelada && pelada.get ? pelada.get('name') : undefined,
      eventDate: startTime ? startTime.toISOString() : undefined,
      observation,
      yellowCards: Number(perf.get('yellowCards') || 0),
      redCards: Number(perf.get('redCards') || 0),
    });
  }
  return rows;
}

// Apresentacao de perfil na pelada
Parse.Cloud.beforeSave('EventRegistration', async (request) => {
  const registration = request.object;
  if (!registration.isNew()) {
    return;
  }

  const user = registration.get('user');
  const eventPtr = registration.get('event');
  if (!user || !eventPtr || !eventPtr.id) {
    return;
  }

  let event;
  try {
    event = await new Parse.Query('Event')
      .include('pelada')
      .get(eventPtr.id, { useMasterKey: true });
  } catch {
    return;
  }

  if (
    event.get('type') === 'team_match' &&
    registration.get('role') === 'athlete' &&
    !registration.get('invitedByContract') &&
    !request.master
  ) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Em confrontos, atletas entram por convocacao ou solicitacao ao presidente.'
    );
  }

  const pelada = await getPeladaFromEvent(event);
  if (!pelada || !pelada.get('requireProfilePresentationOnFirstEvent')) {
    return;
  }

  const userId = user.id || user.objectId;
  if (!userId) {
    return;
  }

  if (registration.get('invitedByContract') || registration.get('invitedAsReferee')) {
    return;
  }

  const hasPrior = await userHasApprovedPeladaParticipation(pelada.id, String(userId));
  if (hasPrior) {
    return;
  }

  registration.set('profilePresentationStatus', 'pending');
  registration.set('isEffectivelyConfirmed', false);
});

Parse.Cloud.define('listPeladaProfilePresentationRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }

  await assertPeladaAdminUser(peladaId, user);

  const peladaPtr = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const events = await new Parse.Query('Event')
    .equalTo('pelada', peladaPtr)
    .limit(500)
    .find({ useMasterKey: true });
  if (!events.length) {
    return [];
  }

  const registrations = await new Parse.Query('EventRegistration')
    .containedIn('event', events)
    .equalTo('profilePresentationStatus', 'pending')
    .include('user')
    .include('event')
    .descending('createdAt')
    .limit(100)
    .find({ useMasterKey: true });

  return registrations.map((registration) => {
    const event = registration.get('event');
    const startTime = event && event.get ? event.get('startTime') : null;
    return {
      registrationId: registration.id,
      eventId: event && event.id ? event.id : '',
      eventName: (event && event.get && event.get('name')) || 'Evento',
      eventStartTime: startTime ? startTime.toISOString() : undefined,
      userId: String(
        registration.get('participantUserId') ||
          (registration.get('user') && registration.get('user').id) ||
          ''
      ),
      userDisplayName:
        registration.get('userDisplayName') ||
        registration.get('apelido') ||
        'Participante',
      apelido: registration.get('apelido') || '',
      role: registration.get('role') || 'athlete',
      membershipType: registration.get('membershipType') || 'convidado',
      createdAt: registration.get('createdAt')
        ? registration.get('createdAt').toISOString()
        : undefined,
    };
  });
});

Parse.Cloud.define('resolveProfilePresentationRequest', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  const registrationId = String(request.params.registrationId || '').trim();
  const action = String(request.params.action || '').trim();
  if (!peladaId || !registrationId || !action) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Parametros invalidos.');
  }
  if (action !== 'approve' && action !== 'reject') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Acao invalida.');
  }

  await assertPeladaAdminUser(peladaId, user);

  const registration = await new Parse.Query('EventRegistration')
    .include('event')
    .include('event.pelada')
    .get(registrationId, { useMasterKey: true });

  const event = registration.get('event');
  const pelada = event && event.get ? event.get('pelada') : null;
  if (!pelada || pelada.id !== peladaId) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Inscricao nao encontrada nesta pelada.');
  }

  if (registration.get('profilePresentationStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao ja foi processada.');
  }

  if (action === 'reject') {
    registration.set('profilePresentationStatus', 'rejected');
    registration.set('isEffectivelyConfirmed', false);
    await registration.save(null, { useMasterKey: true });
    await notifyProfilePresentationDecision(registration, event, peladaId, 'rejected');
    return { ok: true, status: 'rejected' };
  }

  registration.set('profilePresentationStatus', 'approved');
  const participationFee = Number(event.get('participationFee') || 0);
  const isEffectivelyConfirmed = computeRegistrationEffectiveConfirmation(
    registration,
    participationFee
  );
  registration.set('isEffectivelyConfirmed', isEffectivelyConfirmed);
  await registration.save(null, { useMasterKey: true });
  await notifyProfilePresentationDecision(registration, event, peladaId, 'approved');
  return { ok: true, status: 'approved' };
});

// Perfil para revisao de participacao
Parse.Cloud.define('getParticipationReviewProfile', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const peladaId = String(request.params.peladaId || '').trim();
  const userId = String(request.params.userId || '').trim();
  if (!peladaId || !userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId e userId obrigatorios.');
  }

  await assertPeladaAdminUser(peladaId, user);

  let targetUser;
  try {
    targetUser = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (error && error.code === Parse.Error.OBJECT_NOT_FOUND) {
      return null;
    }
    throw error;
  }

  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.equalTo('user', targetUser);
  const athleteProfile = await athleteQuery.first({ useMasterKey: true });

  const apelido = targetUser.get('apelido') || '';
  const fullName = targetUser.get('name') || '';
  const displayName = apelido || fullName || targetUser.getUsername() || 'Participante';
  const address = targetUser.get('address') || {};
  const birthDate = targetUser.get('birthDate');

  let goals = 0;
  let yellowCards = 0;
  let redCards = 0;
  let appScore = 0;
  const isAthlete = !!athleteProfile;

  if (isAthlete) {
    const perfQuery = new Parse.Query('EventPerformance');
    perfQuery.equalTo('user', targetUser);
    perfQuery.limit(2000);
    const performances = await perfQuery.find({ useMasterKey: true });
    for (const perf of performances) {
      goals += Number(perf.get('goals') || 0);
      yellowCards += Number(perf.get('yellowCards') || 0);
      redCards += Number(perf.get('redCards') || 0);
    }
    appScore = await getAppWideAthleteCombinedScore(userId);
  }

  const sumulaObservations = await collectRefereeObservationsForUser(userId);

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      (athleteProfile && athleteProfile.get('userAvatarUrl')) ||
      targetUser.get('avatarUrl') ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    phone: targetUser.get('phone') || undefined,
    email: targetUser.get('email') || undefined,
    primaryPosition: athleteProfile ? athleteProfile.get('primaryPosition') || '' : undefined,
    favoriteProTeam: readUserFavoriteProTeam(
      targetUser,
      athleteProfile ? athleteProfile.get('favoriteProTeam') : undefined
    ),
    goals,
    yellowCards,
    redCards,
    appScore,
    isAthlete,
    sumulaObservations,
  };
});

/**
 * Socio de pelada: uma linha AppMessage (entrada do destinatario, saida de quem agiu).
 * Ignora o vinculo do proprio administrador na criacao da pelada e saves que nao mudam status.
 */
Parse.Cloud.afterSave('PeladaMembership', async (request) => {
  try {
    const membership = request.object;
    if (!membership || typeof createAppMessage !== 'function') return;

    const original = request.original;
    const status = String(membership.get('status') || '');
    const prevStatus = original ? String(original.get('status') || '') : '';
    if (original && status === prevStatus) return;

    const member = membership.get('user');
    const peladaPtr = membership.get('pelada');
    const memberId = member && member.id ? String(member.id) : '';
    const peladaId = peladaPtr && peladaPtr.id ? String(peladaPtr.id) : '';
    if (!memberId || !peladaId) return;

    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    const admin = pelada.get('admin');
    const adminId = admin && admin.id ? String(admin.id) : '';
    if (!adminId || adminId === memberId) return;

    const peladaName = String(pelada.get('name') || 'pelada');
    const memberLabel =
      String(membership.get('memberDisplayName') || '').trim() ||
      String(membership.get('memberApelido') || '').trim() ||
      String(membership.get('memberFullName') || '').trim() ||
      'Um usuario';
    const route = `/pelada/${peladaId}`;
    const actorId = request.user && request.user.id ? String(request.user.id) : '';

    if (!original && status === 'pending') {
      await createAppMessage({
        recipientId: adminId,
        senderId: memberId,
        kind: 'pelada_membership_request',
        title: 'Solicitacao de socio',
        body: `${memberLabel} pediu para ser socio de "${peladaName}".`,
        relatedClass: 'PeladaMembership',
        relatedId: membership.id,
        actionRoute: route,
      });
      return;
    }

    const senderId = actorId && actorId !== memberId ? actorId : adminId;
    let kind = '';
    let title = '';
    let body = '';
    if (status === 'active' && !original) {
      kind = 'pelada_membership_added';
      title = 'Voce agora e socio';
      body = `Voce foi adicionado como socio de "${peladaName}".`;
    } else if (status === 'active' && prevStatus === 'pending') {
      kind = 'pelada_membership_approved';
      title = 'Solicitacao de socio aceita';
      body = `Sua solicitacao para ser socio de "${peladaName}" foi aceita.`;
    } else if (status === 'active' && prevStatus === 'inactive') {
      kind = 'pelada_membership_reactivated';
      title = 'Socio reativado';
      body = `Voce voltou a ser socio de "${peladaName}".`;
    } else if (status === 'inactive' && prevStatus === 'pending') {
      kind = 'pelada_membership_rejected';
      title = 'Solicitacao de socio recusada';
      body = `Sua solicitacao para ser socio de "${peladaName}" foi recusada.`;
    } else if (status === 'inactive' && prevStatus === 'active') {
      kind = 'pelada_membership_removed';
      title = 'Socio removido';
      body = `Voce deixou de ser socio de "${peladaName}".`;
    } else {
      return;
    }

    await createAppMessage({
      recipientId: memberId,
      senderId,
      kind,
      title,
      body,
      relatedClass: 'PeladaMembership',
      relatedId: membership.id,
      actionRoute: route,
    });
  } catch (error) {
    console.error('PeladaMembership mailbox failed', error);
  }
});

// --- 11-profiles-search.js ---

/** Perfis — busca de atletas, funcoes e escudos de times */

// Busca de atletas e perfis publicos
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function calcAgeFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const date = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function readUserFavoriteProTeam(user, ...legacyValues) {
  const fromUser = String(user?.get?.('favoriteProTeam') || '').trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = String(legacy || '').trim();
    if (value) return value;
  }
  return undefined;
}

function readUserFavoriteAmateurTeam(user, ...legacyValues) {
  const fromUser = String(user?.get?.('favoriteAmateurTeam') || '').trim();
  if (fromUser) return fromUser;
  for (const legacy of legacyValues) {
    const value = String(legacy || '').trim();
    if (value) return value;
  }
  return undefined;
}

function readUserProFootballIdol(user) {
  const value = String(user?.get?.('proFootballIdol') || '').trim();
  return value || undefined;
}

function readUserAmateurFootballIdol(user) {
  const value = String(user?.get?.('amateurFootballIdol') || '').trim();
  return value || undefined;
}

function computePerformanceScore(perf) {
  const goals = Number(perf.get('goals') ?? 0);
  const assists = Number(perf.get('assists') ?? 0);
  const saves = Number(perf.get('saves') ?? 0);
  const yellowCards = Number(perf.get('yellowCards') ?? 0);
  const redCards = Number(perf.get('redCards') ?? 0);
  const points = Number(perf.get('points') ?? 0);
  return points + goals * 3 + assists * 2 + saves * 2 - yellowCards - redCards * 3;
}

async function getTopAthleteUserIdForPelada(peladaId) {
  const pelada = Parse.Object.extend('Pelada').createWithoutData(peladaId);
  const statsPriority = await loadPeladaStatsConflictSource(peladaId);

  const perfQuery = new Parse.Query('EventPerformance');
  perfQuery.equalTo('pelada', pelada);
  perfQuery.limit(1000);
  const performances = await perfQuery.find({ useMasterKey: true });

  const voteQuery = new Parse.Query('MuralVote');
  voteQuery.equalTo('scope', 'pelada');
  voteQuery.equalTo('scopeId', peladaId);
  voteQuery.equalTo('targetRole', 'athlete');
  voteQuery.limit(1000);
  const votes = await voteQuery.find({ useMasterKey: true });

  const perfScores = new Map();
  for (const perf of performances) {
    if (perf.get('role') !== 'athlete') continue;
    const userId = getPerformanceParticipantId(perf);
    if (!userId) continue;
    const score = computeEffectivePerformanceScore(perf, statsPriority);
    perfScores.set(userId, (perfScores.get(userId) || 0) + score);
  }

  const voteAgg = new Map();
  for (const vote of votes) {
    const targetUser = vote.get('targetUser');
    const userId = targetUser && targetUser.id ? targetUser.id : null;
    if (!userId) continue;
    const score = Number(vote.get('score') ?? 0);
    const current = voteAgg.get(userId) || { total: 0, count: 0 };
    current.total += score;
    current.count += 1;
    voteAgg.set(userId, current);
  }

  const userIds = new Set([...perfScores.keys(), ...voteAgg.keys()]);
  let bestUserId = null;
  let bestScore = -1;

  for (const userId of userIds) {
    const performanceScore = perfScores.get(userId) || 0;
    const voteData = voteAgg.get(userId);
    const averageScore = voteData && voteData.count ? voteData.total / voteData.count : 0;
    const combinedScore = performanceScore + averageScore * 10;
    if (combinedScore > bestScore) {
      bestScore = combinedScore;
      bestUserId = userId;
    }
  }

  return bestScore > 0 ? bestUserId : null;
}

Parse.Cloud.define('searchAthletes', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const search = normalizeSearchText(request.params.query);

  const profiles = await new Parse.Query('AthleteProfile')
    .include('user')
    .limit(1000)
    .find({ useMasterKey: true });

  const results = [];
  const seen = new Set();

  for (const profile of profiles) {
    let user = profile.get('user');
    if (!user || !user.id) continue;

    if (!user.get('apelido') && !user.get('name')) {
      try {
        user = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      } catch (error) {
        // mantem referencia parcial
      }
    }

    const userId = user.id;
    if (seen.has(userId)) continue;

    const apelido =
      profile.get('userApelido') || user.get('apelido') || '';
    const fullName = user.get('name') || '';
    const username = user.getUsername() || '';
    const displayName =
      profile.get('userName') ||
      apelido ||
      fullName ||
      username ||
      'Atleta';
    const position = profile.get('primaryPosition') || '';
    const address = user.get('address') || {};
    const city = profile.get('userCity') || address.city || '';
    const state = profile.get('userState') || address.state || '';

    if (search.length > 0) {
      const haystack = normalizeSearchText(
        `${apelido} ${fullName} ${displayName} ${username} ${position} ${city} ${state}`
      );
      if (!haystack.includes(search)) continue;
    }

    seen.add(userId);
    results.push({
      userId,
      displayName,
      apelido: apelido || undefined,
      fullName: fullName || undefined,
      primaryPosition: position,
      city: city || undefined,
      state: state || undefined,
      avatarUrl:
        profile.get('userAvatarUrl') ||
        user.get('avatarUrl') ||
        undefined,
      peladaRate: profile.get('peladaRate') ?? undefined,
      teamMatchRate: profile.get('teamMatchRate') ?? undefined,
    });
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const usernameUserQuery = new Parse.Query(Parse.User);
    usernameUserQuery.matches('username', rawQuery, 'i');

    const matchingUsers = await Parse.Query.or(
      apelidoUserQuery,
      nameUserQuery,
      usernameUserQuery
    )
      .limit(100)
      .find({ useMasterKey: true });

    for (const user of matchingUsers) {
      if (!user.id || seen.has(user.id)) continue;
      const athleteProfile = await new Parse.Query('AthleteProfile')
        .equalTo('user', user)
        .first({ useMasterKey: true });
      if (!athleteProfile) continue;

      const apelido = user.get('apelido') || '';
      const fullName = user.get('name') || '';
      const displayName = apelido || fullName || user.getUsername() || 'Atleta';
      const address = user.get('address') || {};

      seen.add(user.id);
      results.push({
        userId: user.id,
        displayName,
        apelido: apelido || undefined,
        fullName: fullName || undefined,
        primaryPosition: athleteProfile.get('primaryPosition') || '',
        city: athleteProfile.get('userCity') || address.city || undefined,
        state: athleteProfile.get('userState') || address.state || undefined,
        avatarUrl:
          athleteProfile.get('userAvatarUrl') ||
          user.get('avatarUrl') ||
          undefined,
      });
    }
  }

  const ranked = results.sort((a, b) => {
    if (search.length > 0) {
      const scoreDiff = athleteRelevanceScore(b, search) - athleteRelevanceScore(a, search);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return ranked.slice(0, 100);
});

function mapAthleteProfileToHiringCandidate(profile, user) {
  const apelido = profile.get('userApelido') || user.get('apelido') || '';
  const fullName = user.get('name') || '';
  const username = user.getUsername() || '';
  const displayName =
    profile.get('userName') || apelido || fullName || username || 'Atleta';
  const address = user.get('address') || {};

  return {
    userId: user.id,
    userName: fullName || displayName,
    apelido: apelido || displayName,
    avatarUrl: profile.get('userAvatarUrl') || user.get('avatarUrl') || undefined,
    city: profile.get('userCity') || address.city || undefined,
    state: profile.get('userState') || address.state || undefined,
    peladaRate: profile.get('peladaRate') ?? undefined,
    matchRate: profile.get('teamMatchRate') ?? undefined,
  };
}

function matchesAthleteHiringSearch(parts, search) {
  if (!search) return true;
  const haystack = normalizeSearchText(parts.filter(Boolean).join(' '));
  return haystack.includes(search);
}

Parse.Cloud.define('listAthleteHiringCandidates', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const search = normalizeSearchText(request.params.query || '');
  const byUserId = new Map();

  const profiles = await new Parse.Query('AthleteProfile')
    .include('user')
    .limit(1000)
    .find({ useMasterKey: true });

  for (const profile of profiles) {
    let user = profile.get('user');
    if (!user || !user.id) continue;

    if (!user.get('apelido') && !user.get('name')) {
      try {
        user = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      } catch {
        // mantem referencia parcial
      }
    }

    const candidate = mapAthleteProfileToHiringCandidate(profile, user);
    if (!matchesAthleteHiringSearch([candidate.apelido, candidate.userName, candidate.city, candidate.state], search)) {
      continue;
    }
    byUserId.set(candidate.userId, candidate);
  }

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('role', 'athlete')
    .include('user')
    .include('athlete')
    .descending('createdAt')
    .limit(2000)
    .find({ useMasterKey: true });

  for (const registration of registrations) {
    const resolved = await resolveRegistrationParticipantUserId(registration);
    if (!resolved.userId || byUserId.has(resolved.userId)) continue;

    const user = registration.get('user');
    const athlete = registration.get('athlete');
    const apelido =
      registration.get('apelido') ||
      registration.get('userApelido') ||
      (user && user.get ? user.get('apelido') : '') ||
      '';
    const userName =
      registration.get('userDisplayName') ||
      registration.get('apelido') ||
      apelido ||
      (user && user.get ? user.get('name') : '') ||
      'Atleta';
    const address = user && user.get ? user.get('address') || {} : {};

    if (
      !matchesAthleteHiringSearch(
        [
          apelido,
          userName,
          registration.get('userCity') || address.city,
          registration.get('userState') || address.state,
        ],
        search
      )
    ) {
      continue;
    }

    byUserId.set(resolved.userId, {
      userId: resolved.userId,
      userName,
      apelido: apelido || userName,
      avatarUrl: registration.get('avatarUrl') || undefined,
      city: registration.get('userCity') || address.city || undefined,
      state: registration.get('userState') || address.state || undefined,
      peladaRate: athlete && athlete.get ? athlete.get('peladaRate') ?? undefined : undefined,
      matchRate: athlete && athlete.get ? athlete.get('teamMatchRate') ?? undefined : undefined,
    });
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const usernameUserQuery = new Parse.Query(Parse.User);
    usernameUserQuery.matches('username', rawQuery, 'i');

    const matchingUsers = await Parse.Query.or(
      apelidoUserQuery,
      nameUserQuery,
      usernameUserQuery
    )
      .limit(100)
      .find({ useMasterKey: true });

    for (const user of matchingUsers) {
      if (!user.id || byUserId.has(user.id)) continue;
      const athleteProfile = await new Parse.Query('AthleteProfile')
        .equalTo('user', user)
        .first({ useMasterKey: true });
      if (!athleteProfile) continue;
      byUserId.set(user.id, mapAthleteProfileToHiringCandidate(athleteProfile, user));
    }
  }

  return Array.from(byUserId.values()).sort((a, b) =>
    (a.apelido || a.userName).localeCompare(b.apelido || b.userName, 'pt-BR')
  );
});

function athleteRelevanceScore(entry, search) {
  const fields = [entry.displayName, entry.apelido, entry.fullName, entry.primaryPosition]
    .filter(Boolean)
    .map((value) => normalizeSearchText(String(value)));

  let best = 0;
  for (const field of fields) {
    if (field === search) best = Math.max(best, 100);
    else if (field.startsWith(search)) best = Math.max(best, 80);
    else if (field.includes(search)) best = Math.max(best, 50);
  }
  return best;
}

Parse.Cloud.define('getAthletePublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const userId = String(request.params.userId || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }

  let user;
  try {
    user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (error && error.code === Parse.Error.OBJECT_NOT_FOUND) {
      return null;
    }
    throw error;
  }
  const athleteQuery = new Parse.Query('AthleteProfile');
  athleteQuery.equalTo('user', user);
  const athleteProfile = await athleteQuery.first({ useMasterKey: true });

  if (!athleteProfile) {
    return null;
  }

  const apelido = user.get('apelido') || '';
  const fullName = user.get('name') || '';
  const displayName = apelido || fullName || user.getUsername() || 'Atleta';
  const address = user.get('address') || {};
  const birthDate = user.get('birthDate');

  const teamQuery = new Parse.Query('AmateurTeam');
  teamQuery.equalTo('president', user);
  const amateurTeams = await teamQuery.find({ useMasterKey: true });

  const regQuery = new Parse.Query('EventRegistration');
  regQuery.equalTo('user', user);
  regQuery.equalTo('role', 'athlete');
  regQuery.include('event');
  regQuery.include('event.pelada');
  regQuery.limit(2000);
  const registrations = await regQuery.find({ useMasterKey: true });

  const peladaNames = new Set();
  const teamNames = new Set();
  const peladaIds = new Set();

  for (const team of amateurTeams) {
    const name = team.get('name');
    if (name) teamNames.add(name);
  }

  for (const registration of registrations) {
    const event = registration.get('event');
    if (!event) continue;
    const pelada = event.get('pelada');
    if (pelada && pelada.get('name')) {
      peladaNames.add(pelada.get('name'));
      if (pelada.id) peladaIds.add(pelada.id);
    }
    const homeTeamName = event.get('homeTeamName');
    const awayTeamName = event.get('awayTeamName');
    if (homeTeamName) teamNames.add(homeTeamName);
    if (awayTeamName) teamNames.add(awayTeamName);
  }

  const membershipQuery = new Parse.Query('PeladaMembership');
  membershipQuery.equalTo('user', user);
  membershipQuery.equalTo('status', 'active');
  membershipQuery.include('pelada');
  membershipQuery.limit(500);
  const memberships = await membershipQuery.find({ useMasterKey: true });
  for (const membership of memberships) {
    const pelada = membership.get('pelada');
    if (pelada && pelada.get('name')) {
      peladaNames.add(pelada.get('name'));
      if (pelada.id) peladaIds.add(pelada.id);
    }
  }

  const perfQuery = new Parse.Query('EventPerformance');
  perfQuery.equalTo('user', user);
  perfQuery.limit(2000);
  const performances = await perfQuery.find({ useMasterKey: true });

  let goals = 0;
  let yellowCards = 0;
  let redCards = 0;
  for (const perf of performances) {
    goals += Number(perf.get('goals') ?? 0);
    yellowCards += Number(perf.get('yellowCards') ?? 0);
    redCards += Number(perf.get('redCards') ?? 0);
  }

  const craquePeladas = [];
  for (const peladaId of peladaIds) {
    const topUserId = await getTopAthleteUserIdForPelada(peladaId);
    if (topUserId === userId) {
      const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
      const name = pelada.get('name');
      if (name) craquePeladas.push(name);
    }
  }

  const favoriteAmateurTeam = readUserFavoriteAmateurTeam(
    user,
    amateurTeams[0] ? amateurTeams[0].get('name') : undefined
  );

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      athleteProfile.get('userAvatarUrl') ||
      user.get('avatarUrl') ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    peladas: Array.from(peladaNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    teams: Array.from(teamNames).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    favoriteProTeam: readUserFavoriteProTeam(user, athleteProfile.get('favoriteProTeam')),
    favoriteAmateurTeam,
    goals,
    yellowCards,
    redCards,
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    craquePeladas: craquePeladas.sort((a, b) => a.localeCompare(b, 'pt-BR')),
    phone: user.get('showPhoneInProfile') ? user.get('phone') || undefined : undefined,
    email: user.get('showEmailInProfile') ? user.get('email') || undefined : undefined,
    phoneVisible: !!user.get('showPhoneInProfile'),
    emailVisible: !!user.get('showEmailInProfile'),
    peladaRate: athleteProfile.get('peladaRate') ?? undefined,
    teamMatchRate: athleteProfile.get('teamMatchRate') ?? undefined,
    primaryPosition: athleteProfile.get('primaryPosition') || '',
  };
});

Parse.Cloud.define('getAthleteActivityIndicators', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }
  const months = Math.min(Math.max(Number(request.params.months) || 3, 1), 12);
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime());
  windowStart.setMonth(windowStart.getMonth() - months);

  const user = Parse.User.createWithoutData(userId);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('user', user)
    .containedIn('role', ['athlete', 'goalkeeper'])
    .include('event')
    .limit(2000)
    .find({ useMasterKey: true });

  let gamesPlayed = 0;
  let peladasPlayed = 0;
  let gamesAbsent = 0;
  let peladasAbsent = 0;

  for (const registration of registrations) {
    const event = registration.get('event');
    if (!event || !event.get) continue;
    const startTime = event.get('startTime');
    if (!(startTime instanceof Date) || startTime < windowStart || startTime > windowEnd) {
      continue;
    }
    const fee = Number(event.get('participationFee') || 0);
    const confirmed =
      typeof computeRegistrationEffectiveConfirmation === 'function'
        ? computeRegistrationEffectiveConfirmation(registration, fee)
        : !!registration.get('isEffectivelyConfirmed');
    if (!confirmed) continue;

    const type = event.get('type') || '';
    const isMatch = type === 'team_match';
    const isPelada = type === 'pelada' || type === 'racha';
    if (!isMatch && !isPelada) continue;

    const attendance = registration.get('attendance') || 'pending';
    const arrivedAt = registration.get('arrivedAt');
    const eventEnded =
      event.get('isFinished') ||
      (event.get('endTime') instanceof Date && event.get('endTime') < windowEnd) ||
      (startTime < windowEnd && startTime.getTime() + 3 * 60 * 60 * 1000 < Date.now());

    const present =
      attendance === 'present' ||
      (arrivedAt != null && attendance !== 'absent');
    const absent =
      eventEnded &&
      (attendance === 'absent' || (!present && attendance !== 'present'));

    if (isMatch) {
      if (absent) gamesAbsent += 1;
      else gamesPlayed += 1;
    } else if (isPelada) {
      if (absent) peladasAbsent += 1;
      else peladasPlayed += 1;
    }
  }

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedUser', user)
    .equalTo('role', 'athlete')
    .include('event')
    .greaterThanOrEqualTo('createdAt', windowStart)
    .limit(2000)
    .find({ useMasterKey: true });

  let teamMatchInvitesReceived = 0;
  let teamMatchInvitesDeclined = 0;
  let peladaInvitesReceived = 0;
  let peladaInvitesDeclined = 0;

  for (const invitation of invitations) {
    const event = invitation.get('event');
    if (!event || !event.get) continue;
    const type = event.get('type') || '';
    const status = invitation.get('status') || '';
    if (type === 'team_match') {
      teamMatchInvitesReceived += 1;
      if (status === 'declined') teamMatchInvitesDeclined += 1;
    } else if (type === 'pelada' || type === 'racha') {
      peladaInvitesReceived += 1;
      if (status === 'declined') peladaInvitesDeclined += 1;
    }
  }

  return {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    months,
    gamesPlayed,
    peladasPlayed,
    gamesAbsent,
    peladasAbsent,
    teamMatchInvitesReceived,
    teamMatchInvitesDeclined,
    peladaInvitesReceived,
    peladaInvitesDeclined,
  };
});

const PROFILE_ROLE_LABELS = {
  referee: 'Juiz',
  scout: 'Scout / Mesario',
  journalist: 'Jornalista',
  cameraman: 'Cinegrafista',
  narrator: 'Narrador',
  coach: 'Treinador',
  physical_trainer: 'Preparador Fisico',
  masseur: 'Massagista',
  kitman: 'Ropeiro',
  gandula: 'Gandula',
  gatekeeper: 'Porteiro',
  fan: 'Torcedor',
};

const SEARCHABLE_PROFILE_ROLES = [
  'referee',
  'scout',
  'journalist',
  'cameraman',
  'narrator',
  'coach',
  'physical_trainer',
  'masseur',
  'kitman',
  'gandula',
  'gatekeeper',
  'fan',
];

const PROFESSIONAL_PROFILE_ROLES = SEARCHABLE_PROFILE_ROLES.filter((role) => role !== 'fan');

const ROLE_HISTORY_MODE = {
  referee: 'pelada_match',
  scout: 'pelada_match',
  journalist: 'pelada_match',
  cameraman: 'pelada_match',
  narrator: 'pelada_match',
  coach: 'teams_only',
  physical_trainer: 'teams_only',
  masseur: 'pelada_teams',
  kitman: 'pelada_teams',
  gandula: 'pelada_match',
  gatekeeper: 'pelada_match',
};

function isProfessionalProfileRole(role) {
  return PROFESSIONAL_PROFILE_ROLES.includes(role);
}

function profileRoleToMuralRole(role) {
  if (role === 'fan') return null;
  return role;
}

function pickRicherText(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left) return right || undefined;
  if (!right) return left;
  return left.length >= right.length ? left : right;
}

function mergeProfileSearchEntries(primary, secondary) {
  return {
    userId: primary.userId,
    role: primary.role,
    displayName:
      pickRicherText(primary.displayName, secondary.displayName) ||
      primary.displayName ||
      secondary.displayName ||
      PROFILE_ROLE_LABELS[primary.role],
    apelido: pickRicherText(primary.apelido, secondary.apelido),
    fullName: pickRicherText(primary.fullName, secondary.fullName),
    subtitle: pickRicherText(primary.subtitle, secondary.subtitle),
    city: primary.city || secondary.city,
    state: primary.state || secondary.state,
    avatarUrl: primary.avatarUrl || secondary.avatarUrl,
  };
}

function toProfileSearchResultFromRoleProfile(profile, role) {
  const user = profile.get('user');
  const userId = profile.get('userId') || (user && user.id ? user.id : '');
  const apelido = profile.get('userApelido') || (user && user.get ? user.get('apelido') : '') || '';
  const fullName =
    profile.get('userFullName') ||
    (user && user.get ? user.get('name') : '') ||
    '';
  const displayName =
    profile.get('userName') ||
    apelido ||
    fullName ||
    (user && user.getUsername ? user.getUsername() : '') ||
    PROFILE_ROLE_LABELS[role];
  const address = user && user.get ? user.get('address') || {} : {};

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    city: profile.get('userCity') || address.city || undefined,
    state: profile.get('userState') || address.state || undefined,
    avatarUrl: profile.get('userAvatarUrl') || (user && user.get ? user.get('avatarUrl') : undefined) || undefined,
  };
}

function toProfileSearchResultFromRegistration(registration, role) {
  const user = registration.get('user');
  const userId =
    registration.get('participantUserId') ||
    (user && user.id ? user.id : '');
  const apelido =
    registration.get('apelido') ||
    registration.get('userApelido') ||
    (user && user.get ? user.get('apelido') : '') ||
    '';
  const fullName =
    registration.get('userFullName') ||
    (user && user.get ? user.get('name') : '') ||
    '';
  const displayName =
    registration.get('userDisplayName') ||
    apelido ||
    fullName ||
    (user && user.getUsername ? user.getUsername() : '') ||
    PROFILE_ROLE_LABELS[role];

  return {
    userId,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    avatarUrl:
      registration.get('avatarUrl') ||
      (user && user.get ? user.get('avatarUrl') : undefined) ||
      undefined,
  };
}

function profileRelevanceScore(entry, search) {
  const fields = [entry.displayName, entry.apelido, entry.fullName, entry.subtitle]
    .filter(Boolean)
    .map((value) => normalizeSearchText(String(value)));

  let best = 0;
  for (const field of fields) {
    if (field === search) best = Math.max(best, 100);
    else if (field.startsWith(search)) best = Math.max(best, 80);
    else if (field.includes(search)) best = Math.max(best, 50);
  }
  return best;
}

const ROLE_SEARCH_ALIASES = {
  physical_trainer: ['prep', 'preparador', 'pf', 'fisico', 'physical_trainer', 'physical trainer'],
  masseur: ['mass', 'massag', 'massagista', 'masseur'],
  kitman: ['roup', 'rope', 'ropeiro', 'roupeiro', 'kit', 'kitman'],
  coach: ['trein', 'treinador', 'coach', 'tec', 'tecnico'],
  referee: ['juiz', 'arb', 'arbitro', 'referee'],
  scout: ['scout', 'mesario', 'mesa'],
  journalist: ['jornal', 'jornalista', 'imprensa'],
  cameraman: ['cine', 'cinegrafista', 'camera'],
  narrator: ['narr', 'narrador', 'radio'],
  gandula: ['gandula', 'ganda'],
  gatekeeper: ['port', 'porteiro', 'gate'],
  fan: ['torc', 'torcedor', 'fan'],
};

function searchMatchesRoleKeyword(search, role) {
  if (!search) return false;
  const label = normalizeSearchText(PROFILE_ROLE_LABELS[role] || '');
  if (label && (label.includes(search) || search.includes(label))) return true;
  for (const token of label.split(/\s+/)) {
    if (token.length >= 3 && (token.startsWith(search) || token.includes(search))) return true;
  }
  for (const alias of ROLE_SEARCH_ALIASES[role] || []) {
    const normalizedAlias = normalizeSearchText(alias);
    if (!normalizedAlias) continue;
    if (
      normalizedAlias === search ||
      normalizedAlias.startsWith(search) ||
      search.startsWith(normalizedAlias) ||
      normalizedAlias.includes(search)
    ) {
      return true;
    }
  }
  return false;
}

function matchesProfileSearchQuery(entry, search) {
  if (!search) return true;
  if (searchMatchesRoleKeyword(search, entry.role)) return true;
  const haystack = normalizeSearchText(
    `${entry.displayName || ''} ${entry.apelido || ''} ${entry.fullName || ''} ${entry.subtitle || ''} ${entry.city || ''} ${entry.state || ''} ${PROFILE_ROLE_LABELS[entry.role] || ''}`
  );
  if (haystack.includes(search)) return true;
  const tokens = search.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length <= 1) return false;
  return tokens.every((token) => haystack.includes(token));
}

function applyRoleProfileHiringAcl(profile) {
  const user = profile.get('user');
  if (user && user.id && !profile.get('userId')) {
    profile.set('userId', user.id);
  }
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  if (user && user.id) {
    acl.setWriteAccess(user, true);
  }
  profile.setACL(acl);
}

Parse.Cloud.beforeSave('RoleProfile', (request) => {
  const profile = request.object;
  const user = profile.get('user') || request.user;
  if (user) {
    if (!profile.get('user')) profile.set('user', user);
    if (user.id) profile.set('userId', user.id);
  }
  applyRoleProfileHiringAcl(profile);
});

function toProfileSearchResultFromUser(user, role) {
  const apelido = (user.get('apelido') || '').trim();
  const fullName = (user.get('name') || '').trim();
  const address = user.get('address') || {};
  return {
    userId: user.id,
    displayName: apelido || fullName || user.getUsername() || PROFILE_ROLE_LABELS[role],
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    role,
    subtitle: PROFILE_ROLE_LABELS[role],
    city: address.city || undefined,
    state: address.state || undefined,
    avatarUrl: user.get('avatarUrl') || undefined,
  };
}

async function appendUsersByPrimaryRole(byUserId, role, search) {
  const users = await new Parse.Query(Parse.User)
    .equalTo('primaryRole', role)
    .limit(500)
    .find({ useMasterKey: true });
  for (const user of users) {
    if (!user.id) continue;
    const entry = toProfileSearchResultFromUser(user, role);
    if (!matchesProfileSearchQuery(entry, search)) continue;
    const existing = byUserId.get(entry.userId);
    byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
  }
}

function roleProfileHasDisplayName(profile) {
  const user = profile.get('user');
  return (
    !!(profile.get('userApelido') || profile.get('userName') || profile.get('userFullName')) ||
    !!(user && user.get && (user.get('apelido') || user.get('name') || user.getUsername()))
  );
}

async function hydrateRoleProfilesMissingUser(profiles) {
  const missingUserIds = [];
  for (const profile of profiles) {
    const user = profile.get('user');
    const userId = profile.get('userId') || (user && user.id ? user.id : '');
    if (userId && !roleProfileHasDisplayName(profile)) {
      missingUserIds.push(userId);
    }
  }
  if (!missingUserIds.length) return;

  const uniqueIds = Array.from(new Set(missingUserIds));
  const users = await new Parse.Query(Parse.User)
    .containedIn('objectId', uniqueIds)
    .limit(Math.min(uniqueIds.length, 500))
    .find({ useMasterKey: true });
  const byId = new Map(users.map((user) => [user.id, user]));
  for (const profile of profiles) {
    if (roleProfileHasDisplayName(profile)) continue;
    const user = profile.get('user');
    const userId = profile.get('userId') || (user && user.id ? user.id : '');
    if (!userId || !byId.has(userId)) continue;
    profile.set('user', byId.get(userId));
  }
}

function roleProfileToPayload(row, role) {
  if (!row) return undefined;
  return {
    objectId: row.id,
    role,
    peladaRate: row.get('peladaRate') ?? undefined,
    matchRate: row.get('matchRate') ?? undefined,
    athleteRate: row.get('athleteRate') ?? undefined,
    peladaLiveRate: row.get('peladaLiveRate') ?? undefined,
    matchLiveRate: row.get('matchLiveRate') ?? undefined,
    peladaHighlightEditRate: row.get('peladaHighlightEditRate') ?? undefined,
    matchHighlightEditRate: row.get('matchHighlightEditRate') ?? undefined,
    peladaGoalNarrationEditRate: row.get('peladaGoalNarrationEditRate') ?? undefined,
    matchGoalNarrationEditRate: row.get('matchGoalNarrationEditRate') ?? undefined,
    teamTrainingRate: row.get('teamTrainingRate') ?? undefined,
    teamRate: row.get('teamRate') ?? undefined,
    hasOwnEquipment: row.get('hasOwnEquipment') ?? undefined,
    isFederatedReferee: row.get('isFederatedReferee') ?? undefined,
    federationName: row.get('federationName') || undefined,
    federationRegistrationNumber: row.get('federationRegistrationNumber') || undefined,
    equipmentDescription: row.get('equipmentDescription') || undefined,
    pixKey1: row.get('pixKey1') || undefined,
    pixKey2: row.get('pixKey2') || undefined,
    pixKey3: row.get('pixKey3') || undefined,
  };
}

async function loadProfileRegistrationsForUser(userId, role) {
  const userPtr = Parse.User.createWithoutData(userId);

  const byParticipantId = new Parse.Query('EventRegistration');
  byParticipantId.equalTo('participantUserId', userId);
  byParticipantId.equalTo('role', role);

  const byUser = new Parse.Query('EventRegistration');
  byUser.equalTo('user', userPtr);
  byUser.equalTo('role', role);

  const query = Parse.Query.or(byParticipantId, byUser);
  query.include('event');
  query.include('event.pelada');
  query.limit(2000);
  return query.find({ useMasterKey: true });
}

/**
 * EventPerformance ligado ao evento ja carregado.
 * createWithoutData dentro de containedIn nao casa com o ponteiro gravado e a lista volta vazia.
 */
async function findPerformancesForLoadedEvents(events) {
  const rows = [];
  const pageSize = 1000;
  const loaded = (events || []).filter((event) => event && event.id && typeof event.get === 'function');
  for (let i = 0; i < loaded.length; i += 40) {
    const batch = loaded.slice(i, i + 40);
    let skip = 0;
    for (;;) {
      const query = new Parse.Query('EventPerformance');
      query.containedIn('event', batch);
      query.limit(pageSize);
      query.skip(skip);
      const page = await query.find({ useMasterKey: true });
      rows.push(...page);
      if (page.length < pageSize) break;
      skip += page.length;
      if (skip > 8000) break;
    }
  }
  return rows;
}

function historyPerformanceMatchesUser(perf, userId) {
  const wanted = String(userId || '');
  if (!wanted) return false;
  if (typeof getPerformanceParticipantId === 'function') {
    const participantId = getPerformanceParticipantId(perf);
    if (participantId && String(participantId) === wanted) return true;
  }
  const explicit = perf.get('participantUserId');
  if (explicit && String(explicit) === wanted) return true;
  const user = perf.get('user');
  return !!(user && user.id && String(user.id) === wanted);
}

function historyPerformanceScore(perf) {
  if (typeof computeEffectivePerformanceScore === 'function') {
    const priority =
      typeof resolvePerformanceStatsPriority === 'function'
        ? resolvePerformanceStatsPriority(perf, new Map())
        : 'referee';
    return computeEffectivePerformanceScore(perf, priority);
  }
  return computePerformanceScore(perf);
}

/** Pontos lancados na sumula do arbitro (refereeGoals), nao o voto do atleta nem o campo goals do scout. */
function refereeSumulaProfileScore(perf) {
  const hasSumula =
    typeof performanceHasRefereeSumulaData === 'function'
      ? performanceHasRefereeSumulaData(perf)
      : !!(perf.get('refereeSumulaSaved') || Number(perf.get('refereeGoals') || 0));
  if (!hasSumula) return 0;

  const goals =
    typeof readRefereeOverlapStat === 'function'
      ? readRefereeOverlapStat(perf, 'goals')
      : Number(perf.get('refereeGoals') || 0);
  const yellow =
    typeof readRefereeOverlapStat === 'function'
      ? readRefereeOverlapStat(perf, 'yellowCards')
      : Number(perf.get('refereeYellowCards') || 0);
  const red =
    typeof readRefereeOverlapStat === 'function'
      ? readRefereeOverlapStat(perf, 'redCards')
      : Number(perf.get('refereeRedCards') || 0);
  const assists = Number(perf.get('assists') || 0);
  const saves = Number(perf.get('saves') || 0);
  const stored = Number(perf.get('points') || 0);
  const fromSumula = goals * 3 + assists * 2 + saves * 2 - yellow - red * 3;
  if (goals > 0 || yellow > 0 || red > 0) return fromSumula;
  return stored > 0 ? stored : fromSumula;
}

function scoreHistoryEvent(userId, role, perfs) {
  const seen = new Set();
  let total = 0;
  for (const perf of perfs || []) {
    if (!perf || !perf.id || seen.has(perf.id)) continue;
    seen.add(perf.id);
    if (role === 'referee') {
      const hasSumula =
        typeof performanceHasRefereeSumulaData === 'function'
          ? performanceHasRefereeSumulaData(perf)
          : !!(perf.get('refereeSumulaSaved') || Number(perf.get('refereeGoals') || 0));
      if (hasSumula) {
        total += refereeSumulaProfileScore(perf);
        continue;
      }
    }
    if (!historyPerformanceMatchesUser(perf, userId)) continue;
    const rowRole = perf.get('role') || 'athlete';
    if (rowRole !== role) continue;
    total += historyPerformanceScore(perf);
  }
  return total;
}

function voteTargetUserId(vote) {
  const explicit = vote.get('targetUserId');
  if (explicit) return String(explicit);
  const target = vote.get('targetUser');
  return target && target.id ? String(target.id) : '';
}

async function loadRoleVoteAveragesByScopeId(userId, targetRole, scope, scopeIds) {
  const averages = new Map();
  const ids = (scopeIds || []).map((id) => String(id || '')).filter(Boolean);
  if (!ids.length || !targetRole) return averages;

  const totals = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const batch = ids.slice(i, i + 80);
    const query = new Parse.Query('MuralVote');
    query.equalTo('scope', scope);
    query.equalTo('targetRole', targetRole);
    query.containedIn('scopeId', batch);
    query.limit(1000);
    const votes = await query.find({ useMasterKey: true });
    for (const vote of votes) {
      if (voteTargetUserId(vote) !== String(userId)) continue;
      const scopeId = String(vote.get('scopeId') || '');
      if (!scopeId) continue;
      const current = totals.get(scopeId) || { total: 0, count: 0 };
      current.total += Number(vote.get('score') || 0);
      current.count += 1;
      totals.set(scopeId, current);
    }
  }

  for (const [scopeId, data] of totals) {
    if (data.count > 0) averages.set(scopeId, data.total / data.count);
  }
  return averages;
}

function upsertHistoryRecord(map, id, name, score) {
  const existing = map.get(id);
  if (!existing) {
    map.set(id, { id, name, score });
    return;
  }
  existing.score = Math.max(existing.score, score);
}

async function buildRoleParticipationHistory(userId, role) {
  const mode = ROLE_HISTORY_MODE[role] || 'none';
  if (role === 'fan') {
    const registrations = await loadProfileRegistrationsForUser(userId, 'fan');
    const peladas = new Map();
    for (const registration of registrations) {
      const event = registration.get('event');
      if (!event) continue;
      const pelada = event.get('pelada');
      const peladaId = pelada && pelada.id ? pelada.id : null;
      const name = (pelada && pelada.get('name')) || event.get('name');
      if (!peladaId || !name) continue;
      if (!peladas.has(peladaId)) {
        peladas.set(peladaId, { id: peladaId, name, score: 0 });
      }
    }
    return {
      peladas: Array.from(peladas.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      matches: [],
      teams: [],
    };
  }

  if (mode === 'none') {
    return { peladas: [], matches: [], teams: [] };
  }

  const muralRole = profileRoleToMuralRole(role);
  const registrations = await loadProfileRegistrationsForUser(userId, role);
  const eventsById = new Map();
  for (const registration of registrations) {
    const event = registration.get('event');
    if (!event || !event.id || typeof event.get !== 'function') continue;
    eventsById.set(event.id, event);
  }
  const events = Array.from(eventsById.values());
  const performances = await findPerformancesForLoadedEvents(events);
  const perfsByEventId = new Map();
  for (const perf of performances) {
    const event = perf.get('event');
    const eventId = event && event.id ? event.id : '';
    if (!eventId) continue;
    const list = perfsByEventId.get(eventId) || [];
    list.push(perf);
    perfsByEventId.set(eventId, list);
  }

  const peladaIds = [];
  for (const event of events) {
    if (event.get('type') === 'team_match') continue;
    const pelada = event.get('pelada');
    if (pelada && pelada.id) peladaIds.push(pelada.id);
  }
  const eventVoteAverages = muralRole
    ? await loadRoleVoteAveragesByScopeId(
        userId,
        muralRole,
        'event',
        events.map((event) => event.id)
      )
    : new Map();
  const peladaVoteAverages = muralRole
    ? await loadRoleVoteAveragesByScopeId(userId, muralRole, 'pelada', peladaIds)
    : new Map();

  const peladaScores = new Map();
  const matchScores = new Map();
  const teamScores = new Map();
  const peladaEventVoteAverages = new Map();

  for (const event of events) {
    const eventType = event.get('type');
    const eventPerfs = perfsByEventId.get(event.id) || [];
    const performanceScore = scoreHistoryEvent(userId, muralRole || role, eventPerfs);
    const eventVote = eventVoteAverages.get(String(event.id));

    if (eventType === 'team_match') {
      const votePart = eventVote != null ? eventVote * 10 : 0;
      const score = performanceScore + votePart;
      const home = String(event.get('homeTeamName') || '').trim();
      const away = String(event.get('awayTeamName') || '').trim();
      const matchLabel = home && away ? `${home} x ${away}` : event.get('name') || 'Partida';
      upsertHistoryRecord(matchScores, event.id, matchLabel, score);

      if (mode === 'teams_only' || mode === 'pelada_teams') {
        if (home) upsertHistoryRecord(teamScores, `team:${home}`, home, score);
        if (away) upsertHistoryRecord(teamScores, `team:${away}`, away, score);
      }
      continue;
    }

    const pelada = event.get('pelada');
    const peladaId = pelada && pelada.id ? pelada.id : null;
    const peladaName = (pelada && pelada.get('name')) || event.get('name');
    if (!peladaId || !peladaName || (mode !== 'pelada_match' && mode !== 'pelada_teams')) {
      continue;
    }

    const existing = peladaScores.get(peladaId);
    if (!existing) {
      peladaScores.set(peladaId, { id: peladaId, name: peladaName, score: performanceScore });
    } else {
      existing.score += performanceScore;
    }
    if (eventVote != null) {
      const votes = peladaEventVoteAverages.get(peladaId) || [];
      votes.push(eventVote);
      peladaEventVoteAverages.set(peladaId, votes);
    }
  }

  for (const [peladaId, record] of peladaScores) {
    const samples = peladaEventVoteAverages.get(peladaId) || [];
    const peladaVote = peladaVoteAverages.get(String(peladaId));
    if (peladaVote != null) samples.push(peladaVote);
    if (!samples.length) continue;
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    record.score += average * 10;
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  return {
    peladas: Array.from(peladaScores.values()).sort(sortByName),
    matches: Array.from(matchScores.values()).sort(sortByName),
    teams: Array.from(teamScores.values()).sort(sortByName),
  };
}

Parse.Cloud.define('searchProfiles', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const role = String(request.params.role || '').trim();
  if (!SEARCHABLE_PROFILE_ROLES.includes(role)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Perfil invalido.');
  }

  const search = normalizeSearchText(request.params.query);
  const byUserId = new Map();

  if (isProfessionalProfileRole(role)) {
    const profiles = await new Parse.Query('RoleProfile')
      .equalTo('role', role)
      .include('user')
      .limit(1000)
      .find({ useMasterKey: true });
    await hydrateRoleProfilesMissingUser(profiles);

    for (const profile of profiles) {
      const entry = toProfileSearchResultFromRoleProfile(profile, role);
      if (!entry.userId) continue;
      if (!matchesProfileSearchQuery(entry, search)) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }
  }

  await appendUsersByPrimaryRole(byUserId, role, search);

  const roleKeywordSearch = searchMatchesRoleKeyword(search, role);
  // Busca por alias do papel (ex.: "prep") nao precisa varrer todas as inscricoes.
  if (!roleKeywordSearch || byUserId.size === 0) {
    const regQuery = new Parse.Query('EventRegistration');
    regQuery.equalTo('role', role);
    regQuery.descending('createdAt');
    regQuery.limit(2000);
    const registrations = await regQuery.find({ useMasterKey: true });

    for (const registration of registrations) {
      const entry = toProfileSearchResultFromRegistration(registration, role);
      if (!entry.userId) continue;
      if (!matchesProfileSearchQuery(entry, search)) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }
  }

  if (search.length > 0) {
    const rawQuery = String(request.params.query || '').trim();
    const profileQueries = [];

    if (isProfessionalProfileRole(role)) {
      const apelidoProfileQuery = new Parse.Query('RoleProfile');
      apelidoProfileQuery.equalTo('role', role);
      apelidoProfileQuery.matches('userApelido', rawQuery, 'i');
      const nameProfileQuery = new Parse.Query('RoleProfile');
      nameProfileQuery.equalTo('role', role);
      nameProfileQuery.matches('userName', rawQuery, 'i');
      const fullNameProfileQuery = new Parse.Query('RoleProfile');
      fullNameProfileQuery.equalTo('role', role);
      fullNameProfileQuery.matches('userFullName', rawQuery, 'i');
      profileQueries.push(apelidoProfileQuery, nameProfileQuery, fullNameProfileQuery);
    }

    const regApelidoQuery = new Parse.Query('EventRegistration');
    regApelidoQuery.equalTo('role', role);
    regApelidoQuery.matches('apelido', rawQuery, 'i');
    const regUserApelidoQuery = new Parse.Query('EventRegistration');
    regUserApelidoQuery.equalTo('role', role);
    regUserApelidoQuery.matches('userApelido', rawQuery, 'i');
    const regDisplayQuery = new Parse.Query('EventRegistration');
    regDisplayQuery.equalTo('role', role);
    regDisplayQuery.matches('userDisplayName', rawQuery, 'i');
    const regFullNameQuery = new Parse.Query('EventRegistration');
    regFullNameQuery.equalTo('role', role);
    regFullNameQuery.matches('userFullName', rawQuery, 'i');
    profileQueries.push(regApelidoQuery, regUserApelidoQuery, regDisplayQuery, regFullNameQuery);

    const extraResults = await Parse.Query.or(...profileQueries).limit(200).find({ useMasterKey: true });

    for (const row of extraResults) {
      const entry =
        row.className === 'RoleProfile'
          ? toProfileSearchResultFromRoleProfile(row, role)
          : toProfileSearchResultFromRegistration(row, role);
      if (!entry.userId) continue;
      const existing = byUserId.get(entry.userId);
      byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
    }

    const apelidoUserQuery = new Parse.Query(Parse.User);
    apelidoUserQuery.matches('apelido', rawQuery, 'i');
    const nameUserQuery = new Parse.Query(Parse.User);
    nameUserQuery.matches('name', rawQuery, 'i');
    const matchedUsers = await Parse.Query.or(apelidoUserQuery, nameUserQuery)
      .limit(200)
      .find({ useMasterKey: true });

    if (matchedUsers.length) {
      const profileByUserId = new Map();
      if (isProfessionalProfileRole(role)) {
        const matchedUserIds = matchedUsers.map((user) => user.id).filter(Boolean);
        const byPointer = new Parse.Query('RoleProfile');
        byPointer.equalTo('role', role);
        byPointer.containedIn('user', matchedUsers);
        byPointer.include('user');
        const byUserIdField = new Parse.Query('RoleProfile');
        byUserIdField.equalTo('role', role);
        byUserIdField.containedIn('userId', matchedUserIds);
        byUserIdField.include('user');
        const roleProfiles = await Parse.Query.or(byPointer, byUserIdField)
          .limit(400)
          .find({ useMasterKey: true });
        await hydrateRoleProfilesMissingUser(roleProfiles);
        for (const profile of roleProfiles) {
          const user = profile.get('user');
          const userId = profile.get('userId') || (user && user.id ? user.id : '');
          if (userId) profileByUserId.set(userId, profile);
        }
      }

      const registrationByUserId = new Map();
      const byUser = new Parse.Query('EventRegistration');
      byUser.containedIn('user', matchedUsers);
      byUser.equalTo('role', role);
      byUser.descending('createdAt');
      const byParticipantId = new Parse.Query('EventRegistration');
      byParticipantId.containedIn(
        'participantUserId',
        matchedUsers.map((user) => user.id).filter(Boolean)
      );
      byParticipantId.equalTo('role', role);
      byParticipantId.descending('createdAt');
      const matchedRegistrations = await Parse.Query.or(byUser, byParticipantId)
        .limit(400)
        .find({ useMasterKey: true });
      for (const registration of matchedRegistrations) {
        const user = registration.get('user');
        const userId =
          registration.get('participantUserId') ||
          (user && user.id ? user.id : '');
        if (!userId || registrationByUserId.has(userId)) continue;
        registrationByUserId.set(userId, registration);
      }

      for (const user of matchedUsers) {
        if (!user.id) continue;
        let entry = null;
        if (profileByUserId.has(user.id)) {
          entry = toProfileSearchResultFromRoleProfile(profileByUserId.get(user.id), role);
        } else if (registrationByUserId.has(user.id)) {
          entry = toProfileSearchResultFromRegistration(registrationByUserId.get(user.id), role);
        } else if (user.get('primaryRole') === role) {
          const apelido = user.get('apelido') || '';
          const fullName = user.get('name') || '';
          entry = {
            userId: user.id,
            displayName: apelido || fullName || user.getUsername() || PROFILE_ROLE_LABELS[role],
            apelido: apelido || undefined,
            fullName: fullName || undefined,
            role,
            subtitle: PROFILE_ROLE_LABELS[role],
            city: user.get('address')?.city || undefined,
            state: user.get('address')?.state || undefined,
            avatarUrl: user.get('avatarUrl') || undefined,
          };
        }
        if (!entry || !entry.userId) continue;
        const existing = byUserId.get(entry.userId);
        byUserId.set(entry.userId, existing ? mergeProfileSearchEntries(existing, entry) : entry);
      }
    }
  }

  const ranked = Array.from(byUserId.values()).sort((a, b) => {
    if (search.length > 0) {
      const scoreDiff = profileRelevanceScore(b, search) - profileRelevanceScore(a, search);
      if (scoreDiff !== 0) return scoreDiff;
    }
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return ranked.slice(0, 100);
});

Parse.Cloud.define('getRolePublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const role = String(request.params.role || '').trim();
  const userId = String(request.params.userId || '').trim();

  if (!SEARCHABLE_PROFILE_ROLES.includes(role)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Perfil invalido.');
  }
  if (!userId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'userId obrigatorio.');
  }

  let roleProfileRow = null;
  if (isProfessionalProfileRole(role)) {
    const userPtr = Parse.User.createWithoutData(userId);
    roleProfileRow = await new Parse.Query('RoleProfile')
      .equalTo('user', userPtr)
      .equalTo('role', role)
      .first({ useMasterKey: true });
  }

  const registrations = await loadProfileRegistrationsForUser(userId, role);

  if (!roleProfileRow && !registrations.length) {
    return null;
  }

  let user = null;
  try {
    user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
  } catch (error) {
    if (!(error && error.code === Parse.Error.OBJECT_NOT_FOUND)) {
      throw error;
    }
  }

  const registration = registrations[0];
  const apelido =
    (user && user.get('apelido')) ||
    (registration && registration.get('apelido')) ||
    (registration && registration.get('userApelido')) ||
    '';
  const fullName =
    (user && user.get('name')) ||
    (registration && registration.get('userFullName')) ||
    '';
  const displayName =
    (registration && registration.get('userDisplayName')) ||
    apelido ||
    fullName ||
    (user && user.getUsername()) ||
    PROFILE_ROLE_LABELS[role];
  const address = (user && user.get('address')) || {};
  const birthDate = user && user.get('birthDate');
  const roleProfilePayload = roleProfileToPayload(roleProfileRow, role);
  const history = await buildRoleParticipationHistory(userId, role);

  return {
    userId,
    role,
    displayName,
    apelido: apelido || undefined,
    fullName: fullName || undefined,
    avatarUrl:
      (registration && registration.get('avatarUrl')) ||
      (user && user.get('avatarUrl')) ||
      undefined,
    state: address.state || undefined,
    city: address.city || undefined,
    neighborhood: address.neighborhood || undefined,
    age: calcAgeFromBirthDate(birthDate),
    proFootballIdol: readUserProFootballIdol(user),
    amateurFootballIdol: readUserAmateurFootballIdol(user),
    favoriteProTeam: readUserFavoriteProTeam(
      user,
      roleProfileRow ? roleProfileRow.get('favoriteProTeam') : undefined
    ),
    roleProfile: roleProfilePayload,
    history,
  };
});

// Escudo de times (SportsDB)
const TEAM_SHIELD_SEARCH_ALIASES = {
  sport: ['Sport Recife', 'Sport Club do Recife'],
  athletic: ['Athletic Club MG', 'Athletic Club Minas Gerais'],
  central: ['Central Esporte Clube', 'Central EC PE'],
  gas: ['GAS Esporte Clube', 'GAS Caracarai'],
  retro: ['Retro Futebol Clube', 'Retro FC Brasil'],
  abc: ['ABC Futebol Clube', 'ABC FC Natal'],
  csa: ['Centro Sportivo Alagoano', 'CSA Maceio'],
  crb: ['Clube de Regatas Brasil', 'CRB Maceio'],
  crac: ['Clube Recreativo e Atletico Catalano', 'CRAC Goiania'],
  iape: ['IAPE Futebol Clube', 'IAPE Maranhao'],
  asa: ['Agremiacao Sportiva Arapiraquense', 'ASA Arapiraca'],
  cse: ['Centro Sportivo Alagoano', 'CSE Alagoas'],
  mixto: ['Mixto Esporte Clube', 'Mixto Cuiaba'],
  botafogo: ['Botafogo de Futebol e Regatas', 'Botafogo RJ'],
  'botafogo-sp': ['Botafogo Futebol Clube SP', 'Botafogo SP'],
  'botafogo-pb': ['Botafogo Futebol Clube PB', 'Botafogo Paraiba'],
  guarani: ['Guarani Futebol Clube', 'Guarani Campinas'],
  santos: ['Santos FC', 'Santos Futebol Clube'],
  vitoria: ['Esporte Clube Vitoria', 'Vitoria BA'],
  nautico: ['Clube Nautico Capibaribe', 'Nautico Recife'],
  ceara: ['Ceara Sporting Club', 'Ceara Fortaleza'],
  'santa-cruz': ['Santa Cruz Futebol Clube', 'Santa Cruz Recife'],
  'fluminense-pi': ['Fluminense Esporte Clube PI', 'Fluminense PI'],
  'america-mineiro': ['America Futebol Clube MG', 'America Mineiro'],
  'america-de-natal': ['America Futebol Clube RN', 'America de Natal'],
  'america-rj': ['America Futebol Clube RJ', 'America Rio de Janeiro'],
  'atletico-mineiro': ['Clube Atletico Mineiro', 'Atletico Mineiro'],
  'atletico-goianiense': ['Atletico Goianiense', 'Atletico Clube Goianiense'],
  'atletico-cearense': ['Atletico Cearense', 'Atletico Cearense Fortaleza'],
  'operario-pr': ['Operario Ferroviario Esporte Clube', 'Operario PR'],
  'operario-vg': ['Operario Ferroviario VG', 'Operario Vila Galvao'],
  'operario-ms': ['Operario Ferroviario MS', 'Operario MS'],
  'sampaio-correa': ['Sampaio Correa Futebol Clube', 'Sampaio Correa MA'],
  portuguesa: ['Associacao Portuguesa de Desportos', 'Portuguesa SP'],
  ferroviario: ['Clube Ferroviario Atletico Clube', 'Ferroviario Fortaleza'],
  ferroviaria: ['Associacao Ferroviaria de Esportes', 'Ferroviaria Araraquara'],
};

function teamShieldSlug(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeTeamShieldSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildTeamShieldSearchQueries(teamName, slug) {
  const resolvedSlug = slug || teamShieldSlug(teamName);
  const aliases = TEAM_SHIELD_SEARCH_ALIASES[resolvedSlug] || [];
  const fromSlug = resolvedSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const queries = [
    teamName,
    ...aliases,
    fromSlug,
    `${teamName} FC`,
    `${teamName} Esporte Clube`,
    `${teamName} Futebol Clube`,
  ];
  const seen = new Set();
  return queries
    .map((query) => String(query || '').trim())
    .filter(Boolean)
    .filter((query) => {
      const key = normalizeTeamShieldSearchText(query);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isBrazilianSportsDbTeam(team) {
  const country = String(team.strCountry || '').toLowerCase();
  if (country === 'brazil') return true;
  const leagues = [team.strLeague, team.strLeague2, team.strLeague3, team.strLeague4]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
  return (
    leagues.includes('brazil') ||
    leagues.includes('brasileir') ||
    leagues.includes('serie') ||
    leagues.includes('copa do brasil') ||
    leagues.includes('campeonato')
  );
}

function scoreSportsDbTeamMatch(team, queries) {
  let score = 0;
  if (isBrazilianSportsDbTeam(team)) score += 100;
  const names = [team.strTeam, team.strTeamAlternate]
    .map((value) => normalizeTeamShieldSearchText(value))
    .filter(Boolean);
  for (const query of queries) {
    const normalizedQuery = normalizeTeamShieldSearchText(query);
    if (!normalizedQuery) continue;
    for (const name of names) {
      if (name === normalizedQuery) score += 60;
      else if (name.includes(normalizedQuery) || normalizedQuery.includes(name)) score += 25;
      else {
        const tokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2);
        score += tokens.filter((token) => name.includes(token)).length * 8;
      }
    }
  }
  if (team.strBadge || team.strTeamBadge) score += 5;
  return score;
}

async function searchSportsDbTeams(query) {
  const response = await Parse.Cloud.httpRequest({
    url: `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(query)}`,
    followRedirects: true,
  });
  const body = response.data || {};
  return Array.isArray(body.teams) ? body.teams : [];
}

async function resolveTeamShieldUrlFromSportsDb(teamName, slug) {
  const queries = buildTeamShieldSearchQueries(teamName, slug);
  const candidates = new Map();

  for (const query of queries) {
    const teams = await searchSportsDbTeams(query);
    for (const team of teams) {
      const score = scoreSportsDbTeamMatch(team, queries);
      if (score < 30) continue;
      const key = String(team.idTeam || team.strTeam || '');
      const previous = candidates.get(key) || { team, score: 0 };
      previous.score = Math.max(previous.score, score);
      candidates.set(key, previous);
    }
  }

  const ranked = Array.from(candidates.values()).sort((a, b) => b.score - a.score);
  const best =
    ranked.find((entry) => isBrazilianSportsDbTeam(entry.team)) ||
    ranked[0];
  if (!best) return null;

  const badge = best.team.strBadge || best.team.strTeamBadge;
  return badge ? String(badge) : null;
}

Parse.Cloud.define('resolveTeamShieldUrl', async (request) => {
  const teamName = request.params.teamName ? String(request.params.teamName).trim() : '';
  const slug = request.params.slug ? String(request.params.slug).trim() : '';
  if (!teamName) {
    return { url: null };
  }

  const cacheKey = slug ? `${slug}::${teamName}` : teamName;
  const config = await Parse.Config.get({ useMasterKey: true });
  const cache = config.get('teamBadgeUrls') || {};
  if (cache[cacheKey]) {
    return { url: cache[cacheKey] };
  }
  if (cache[teamName]) {
    return { url: cache[teamName] };
  }

  try {
    const url = await resolveTeamShieldUrlFromSportsDb(teamName, slug);
    if (url) {
      cache[cacheKey] = url;
      cache[teamName] = url;
      await Parse.Config.save({ teamBadgeUrls: cache }, { useMasterKey: true });
      return { url };
    }
  } catch {
    // fallback handled on client
  }

  return { url: null };
});

function isAllowedShareImageHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h.endsWith('.wikimedia.org')) return true;
  if (h.includes('back4app') || h.includes('parsefile') || h.includes('amazonaws.com')) return true;
  if (h === 'www.thesportsdb.com' || h === 'thesportsdb.com') return true;
  return false;
}

function isAllowedShareImageUrl(urlString) {
  try {
    const u = new URL(String(urlString || '').trim());
    if (u.protocol !== 'https:') return false;
    return isAllowedShareImageHost(u.hostname);
  } catch {
    return false;
  }
}

async function fetchHttpsImageAsDataUrl(urlString) {
  const url = String(urlString || '').trim();
  if (!isAllowedShareImageUrl(url)) return null;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 512 * 1024) return null;
  let mime = String(response.headers.get('content-type') || 'image/png').split(';')[0].trim();
  if (!mime.startsWith('image/')) mime = 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function resolveTeamShieldBadgeUrlCached(teamName, slug) {
  const cacheKey = slug ? `${slug}::${teamName}` : teamName;
  const config = await Parse.Config.get({ useMasterKey: true });
  const cache = config.get('teamBadgeUrls') || {};
  if (cache[cacheKey]) return cache[cacheKey];
  if (cache[teamName]) return cache[teamName];

  try {
    const url = await resolveTeamShieldUrlFromSportsDb(teamName, slug);
    if (url) {
      cache[cacheKey] = url;
      cache[teamName] = url;
      await Parse.Config.save({ teamBadgeUrls: cache }, { useMasterKey: true });
      return url;
    }
  } catch {
    // fallback no cliente
  }
  return null;
}

Parse.Cloud.define('fetchShareImagesAsDataUrls', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Login obrigatorio.');
  }
  const urls = request.params.urls;
  if (!urls || !Array.isArray(urls)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'urls deve ser um array.');
  }

  const unique = [
    ...new Set(urls.map((value) => String(value || '').trim()).filter(isAllowedShareImageUrl)),
  ].slice(0, 24);

  const dataUrls = {};
  await Promise.all(
    unique.map(async (url) => {
      try {
        const dataUrl = await fetchHttpsImageAsDataUrl(url);
        if (dataUrl) dataUrls[url] = dataUrl;
      } catch {
        // ignora URL que falhou
      }
    })
  );

  return { dataUrls };
});

Parse.Cloud.define('resolveTeamShieldImageBase64', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'Login obrigatorio.');
  }

  const teamName = request.params.teamName ? String(request.params.teamName).trim() : '';
  const slug = request.params.slug ? String(request.params.slug).trim() : '';
  const preferredUrl = request.params.preferredUrl
    ? String(request.params.preferredUrl).trim()
    : '';

  if (!teamName) {
    return { dataUrl: null };
  }

  if (preferredUrl && isAllowedShareImageUrl(preferredUrl)) {
    const fromPreferred = await fetchHttpsImageAsDataUrl(preferredUrl);
    if (fromPreferred) return { dataUrl: fromPreferred };
  }

  const badgeUrl = await resolveTeamShieldBadgeUrlCached(teamName, slug);
  if (!badgeUrl) {
    return { dataUrl: null };
  }

  const dataUrl = await fetchHttpsImageAsDataUrl(badgeUrl);
  return { dataUrl: dataUrl || null };
});

// --- 12-event-media.js ---

/** Imprensa / Midia do evento (radio, jornal e video de melhores momentos) */

const EVENT_MEDIA_SCORE_CATEGORIES = [
  'radio_narration',
  'radio_interview',
  'journal_reportage',
  'journal_interview',
];

const EVENT_MEDIA_ENGAGEMENT_CATEGORIES = [
  ...EVENT_MEDIA_SCORE_CATEGORIES,
  'highlight_video',
];

const EVENT_MEDIA_REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
const HIGHLIGHT_VIDEO_MAX_SECONDS = 5 * 60;
const MEDIA_COMMENT_MAX_LENGTH = 280;

const MEDIA_CONTENT_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationTitle',
  radio_interview: 'radioInterviewTitle',
  journal_reportage: 'journalReportageHeadline',
  journal_interview: 'journalInterviewHeadline',
  highlight_video: 'highlightVideoTitle',
};

const MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY = {
  radio_narration: 'radioNarrationViewCount',
  radio_interview: 'radioInterviewViewCount',
  journal_reportage: 'journalReportageViewCount',
  journal_interview: 'journalInterviewViewCount',
  highlight_video: 'highlightVideoViewCount',
};

function normalizeMediaCategory(value, allowHighlight = true) {
  const category = String(value || '').trim();
  const allowed = allowHighlight ? EVENT_MEDIA_ENGAGEMENT_CATEGORIES : EVENT_MEDIA_SCORE_CATEGORIES;
  if (!allowed.includes(category)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Categoria de midia invalida.');
  }
  return category;
}

function normalizeMediaScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Nota deve ser entre 0 e 10.');
  }
  return Math.round(score);
}

function normalizeReaction(value) {
  const reaction = String(value || '').trim().toLowerCase();
  if (!EVENT_MEDIA_REACTIONS.includes(reaction)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Reacao invalida.');
  }
  return reaction;
}

function trimText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeDisplayName(value, fallback) {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function resolveMediaAuthorAvatarUrl(user, registration) {
  const registrationAvatar =
    registration && registration.get ? registration.get('avatarUrl') : '';
  if (registrationAvatar && String(registrationAvatar).trim()) {
    return String(registrationAvatar).trim();
  }
  if (!user || !user.get) return undefined;
  const direct = safeDisplayName(user.get('avatarUrl'), '');
  if (direct) return direct;
  const avatar = user.get('avatar');
  if (avatar && typeof avatar.url === 'function') {
    return avatar.url();
  }
  if (avatar && avatar._url) return avatar._url;
  if (typeof resolveStoredAvatarUrl === 'function') {
    return resolveStoredAvatarUrl(user, registration) || undefined;
  }
  return undefined;
}

function assertPublicHttpUrl(url, label) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      `${label} deve ser uma URL publica (http ou https). Envie a foto novamente.`
    );
  }
  return value;
}

async function notifyEventMediaPublishedToParticipants(event, publisherUserId, options) {
  if (typeof computeRegistrationEffectiveConfirmation !== 'function') {
    return;
  }
  const participationFee = Number(event.get('participationFee') || 0);
  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .limit(1000)
    .find({ useMasterKey: true });

  const userIds = [];
  for (const registration of registrations) {
    if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
      continue;
    }
    let resolvedUserId = '';
    if (typeof resolveRegistrationParticipantUserId === 'function') {
      const resolved = await resolveRegistrationParticipantUserId(registration);
      resolvedUserId = resolved && resolved.userId ? String(resolved.userId) : '';
    } else {
      const regUser = registration.get('user');
      resolvedUserId = regUser && regUser.id ? String(regUser.id) : '';
    }
    if (resolvedUserId && resolvedUserId !== String(publisherUserId || '')) {
      userIds.push(resolvedUserId);
    }
  }

  const uniqueUserIds = [...new Set(userIds)];
  if (!uniqueUserIds.length) {
    return;
  }

  const eventName = safeDisplayName(event.get('name'), 'Evento');
  const title = options.title || 'Nova reportagem no evento';
  const alert = options.alert || `Confira a reportagem de ${eventName}.`;
  const kind = options.pushType || 'event_journal_reportage';
  if (typeof sendPushToUsers === 'function') {
    await sendPushToUsers(
      uniqueUserIds,
      {
        title,
        alert,
        data: {
          type: kind,
          eventId: event.id,
          category: options.category || 'journal_reportage',
        },
      },
      { throwOnError: false }
    );
  }
  if (typeof createAppMessages === 'function') {
    await createAppMessages(uniqueUserIds, {
      senderId: String(publisherUserId || ''),
      kind,
      title,
      body: alert,
      relatedClass: 'Event',
      relatedId: event.id,
      actionRoute: `/event/${event.id}`,
    });
  }
}

async function loadEventForMedia(eventId) {
  const id = String(eventId || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  return new Parse.Query('Event').include('pelada').get(id, { useMasterKey: true });
}

async function loadUserEventRegistration(user, event) {
  return new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
}

async function assertConfirmedRoleRegistration(user, eventId, role) {
  const event = await loadEventForMedia(eventId);
  const registration = await loadUserEventRegistration(user, event);
  if (!registration) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Inscricao no evento obrigatoria.');
  }
  if (registration.get('role') !== role) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Perfil sem permissao para esta acao.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao ainda nao confirmada.');
  }
  return { event, registration };
}

async function getOrCreateEventMediaPublication(event) {
  let row = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!row) {
    // Fallback: algumas linhas antigas podem ter so eventId textual.
    row = await new Parse.Query('EventMediaPublication')
      .equalTo('eventId', event.id)
      .first({ useMasterKey: true });
  }
  if (!row) {
    row = new Parse.Object('EventMediaPublication');
    row.set('event', event);
  } else if (!row.get('event')) {
    row.set('event', event);
  }
  row.set('eventId', event.id);
  const pelada = event.get('pelada');
  if (pelada) {
    row.set('pelada', pelada);
  }
  if (!row.id) {
    await row.save(null, { useMasterKey: true });
  } else if (
    pelada &&
    (!row.get('pelada') || row.get('pelada').id !== pelada.id || !row.get('eventId'))
  ) {
    await row.save(null, { useMasterKey: true });
  }
  return row;
}

function mapAuthorSnapshot(user, registration) {
  return {
    authorId: user.id,
    authorName: safeDisplayName(
      (registration && registration.get && registration.get('apelido')) ||
        user.get('apelido') ||
        user.get('name') ||
        user.getUsername(),
      'Autor'
    ),
    authorApelido: safeDisplayName(
      (registration && registration.get && registration.get('apelido')) || user.get('apelido'),
      ''
    ),
    authorAvatarUrl: resolveMediaAuthorAvatarUrl(user, registration),
  };
}

function mapMediaAuthorBlock(prefix, publication) {
  return {
    authorId: publication.get(`${prefix}AuthorId`) || '',
    authorName: publication.get(`${prefix}AuthorName`) || '',
    authorApelido: publication.get(`${prefix}AuthorApelido`) || '',
    authorAvatarUrl: publication.get(`${prefix}AuthorAvatarUrl`) || undefined,
    updatedAt: publication.get(`${prefix}UpdatedAt`)
      ? publication.get(`${prefix}UpdatedAt`).toISOString()
      : undefined,
  };
}

async function clearCategoryEngagement(event, category) {
  const views = await new Parse.Query('EventMediaView')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(1000)
    .find({ useMasterKey: true });
  const reactions = await findReactionsForEventCategory(event, category);
  const comments = await new Parse.Query('EventMediaComment')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(1000)
    .find({ useMasterKey: true });
  const all = [...views, ...reactions, ...comments];
  if (all.length) {
    await Parse.Object.destroyAll(all, { useMasterKey: true });
  }
}

async function assertPublicationHasCategory(publication, category) {
  const field = MEDIA_CONTENT_FIELD_BY_CATEGORY[category];
  if (!publication || !field || !publication.get(field)) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Conteudo de midia ainda nao publicado.');
  }
}

async function buildMediaVoteSummary(eventId, category) {
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const votes = await new Parse.Query('EventMediaVote')
    .equalTo('event', eventPtr)
    .equalTo('category', category)
    .include('voter')
    .limit(5000)
    .find({ useMasterKey: true });

  const byVoter = new Map();
  for (const vote of votes) {
    const voter = vote.get('voter');
    const voterId = voter && voter.id ? String(voter.id) : vote.id;
    byVoter.set(voterId, Number(vote.get('score') || 0));
  }

  let total = 0;
  for (const score of byVoter.values()) {
    total += score;
  }
  const voteCount = byVoter.size;
  return {
    voteCount,
    averageScore: voteCount > 0 ? Math.round((total / voteCount) * 10) / 10 : 0,
  };
}

function isMediaLevelReaction(row) {
  const raw = row.get('commentId');
  if (raw == null || raw === '') return true;
  const asString = String(raw).trim();
  return !asString || asString === 'undefined' || asString === 'null';
}

function reactionUserId(row) {
  const user = row.get('user');
  return (user && user.id) || row.get('userId') || '';
}

function emptyReactionCounts() {
  const counts = {};
  for (const key of EVENT_MEDIA_REACTIONS) {
    counts[key] = 0;
  }
  return counts;
}

function summarizeReactionRows(rows, userId) {
  const counts = emptyReactionCounts();
  let myReaction = null;
  let total = 0;
  for (const row of rows) {
    const reaction = String(row.get('reaction') || '')
      .trim()
      .toLowerCase();
    if (counts[reaction] == null) continue;
    counts[reaction] += 1;
    total += 1;
    if (userId && reactionUserId(row) === userId) {
      myReaction = reaction;
    }
  }
  return { total, counts, myReaction };
}

/** Une reacoes por pointer event e por eventId textual (dados antigos). */
async function findReactionsForEventCategory(event, category) {
  const byPtr = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .limit(5000)
    .find({ useMasterKey: true });
  const byId = await new Parse.Query('EventMediaReaction')
    .equalTo('eventId', event.id)
    .equalTo('category', category)
    .limit(5000)
    .find({ useMasterKey: true });
  const map = new Map();
  for (const row of byPtr.concat(byId)) {
    if (row && row.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

/**
 * Reacoes na midia publicada (sem commentId efetivo).
 * Filtra em memoria: doesNotExist falha em linhas antigas com commentId=null.
 */
async function buildReactionSummary(event, category, userId) {
  const rows = await findReactionsForEventCategory(event, category);
  return summarizeReactionRows(rows.filter(isMediaLevelReaction), userId);
}

async function buildCommentReactionSummary(event, category, commentId, userId) {
  const rows = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('commentId', commentId)
    .limit(2000)
    .find({ useMasterKey: true });
  return summarizeReactionRows(rows, userId);
}

async function loadCommentReactionsByCommentId(event, category, commentIds, userId) {
  const byCommentId = {};
  for (const id of commentIds) {
    byCommentId[id] = { total: 0, counts: emptyReactionCounts(), myReaction: null };
  }
  if (!commentIds.length) return byCommentId;

  const rows = await new Parse.Query('EventMediaReaction')
    .equalTo('event', event)
    .equalTo('category', category)
    .containedIn('commentId', commentIds)
    .limit(5000)
    .find({ useMasterKey: true });

  for (const row of rows) {
    const commentId = String(row.get('commentId') || '');
    if (!commentId || !byCommentId[commentId]) continue;
    const reaction = String(row.get('reaction') || '')
      .trim()
      .toLowerCase();
    if (byCommentId[commentId].counts[reaction] == null) continue;
    byCommentId[commentId].counts[reaction] += 1;
    byCommentId[commentId].total += 1;
    if (userId && reactionUserId(row) === userId) {
      byCommentId[commentId].myReaction = reaction;
    }
  }
  return byCommentId;
}

async function loadComments(event, category, userId) {
  const rows = await new Parse.Query('EventMediaComment')
    .equalTo('event', event)
    .equalTo('category', category)
    .ascending('createdAt')
    .limit(500)
    .find({ useMasterKey: true });

  const commentIds = rows.map((row) => row.id).filter(Boolean);
  const reactionsByComment = await loadCommentReactionsByCommentId(
    event,
    category,
    commentIds,
    userId
  );

  const comments = rows.map((row) => {
    const objectId = row.id;
    return {
      objectId,
      userId: row.get('userId') || (row.get('user') && row.get('user').id) || '',
      userName: row.get('userName') || 'Usuario',
      text: row.get('text') || '',
      parentCommentId: row.get('parentCommentId') || null,
      createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : undefined,
      updatedAt: row.get('updatedAt') ? row.get('updatedAt').toISOString() : undefined,
      reactions: reactionsByComment[objectId] || {
        total: 0,
        counts: emptyReactionCounts(),
        myReaction: null,
      },
    };
  });
  return { comments };
}

async function buildEngagementBundle(event, category, userId, publication) {
  const viewCountField = MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY[category];
  const viewCount = Number((publication && publication.get(viewCountField)) || 0);
  let viewedByMe = false;
  if (userId) {
    const existingView = await new Parse.Query('EventMediaView')
      .equalTo('event', event)
      .equalTo('category', category)
      .equalTo('viewer', Parse.User.createWithoutData(userId))
      .first({ useMasterKey: true });
    viewedByMe = !!existingView;
  }
  const reactions = await buildReactionSummary(event, category, userId);
  const { comments } = await loadComments(event, category, userId);
  return {
    viewCount,
    viewedByMe,
    reactions,
    comments,
  };
}

async function loadMyMediaVotes(eventId, userId) {
  const eventPtr = Parse.Object.extend('Event').createWithoutData(eventId);
  const userPtr = Parse.User.createWithoutData(userId);
  const votes = await new Parse.Query('EventMediaVote')
    .equalTo('event', eventPtr)
    .equalTo('voter', userPtr)
    .limit(20)
    .find({ useMasterKey: true });

  const byCategory = {};
  for (const vote of votes) {
    byCategory[vote.get('category')] = Number(vote.get('score') || 0);
  }
  return byCategory;
}

function mapPublicationDashboard(publication, eventId, voteSummaries, myVotes) {
  if (!publication) {
    return {
      eventId,
      radioNarration: null,
      radioInterview: null,
      journalReportage: null,
      journalInterview: null,
      highlightVideo: null,
      myVotes: myVotes || {},
    };
  }

  const radioNarrationTitle = publication.get('radioNarrationTitle');
  const radioInterviewTitle = publication.get('radioInterviewTitle');
  const journalReportageHeadline = publication.get('journalReportageHeadline');
  const journalInterviewHeadline = publication.get('journalInterviewHeadline');
  const highlightVideoTitle = publication.get('highlightVideoTitle');

  return {
    eventId,
    radioNarration: radioNarrationTitle
      ? {
          title: radioNarrationTitle,
          description: publication.get('radioNarrationDescription') || '',
          audioUrl: publication.get('radioNarrationAudioUrl') || '',
          viewCount: Number(publication.get('radioNarrationViewCount') || 0),
          ...mapMediaAuthorBlock('radioNarration', publication),
          votes: voteSummaries.radio_narration,
          myScore: myVotes.radio_narration ?? null,
        }
      : null,
    radioInterview: radioInterviewTitle
      ? {
          title: radioInterviewTitle,
          description: publication.get('radioInterviewDescription') || '',
          audioUrl: publication.get('radioInterviewAudioUrl') || '',
          viewCount: Number(publication.get('radioInterviewViewCount') || 0),
          ...mapMediaAuthorBlock('radioInterview', publication),
          votes: voteSummaries.radio_interview,
          myScore: myVotes.radio_interview ?? null,
        }
      : null,
    journalReportage: journalReportageHeadline
      ? {
          headline: journalReportageHeadline,
          photoUrl: publication.get('journalReportagePhotoUrl') || '',
          body: publication.get('journalReportageBody') || '',
          viewCount: Number(publication.get('journalReportageViewCount') || 0),
          ...mapMediaAuthorBlock('journalReportage', publication),
          votes: voteSummaries.journal_reportage,
          myScore: myVotes.journal_reportage ?? null,
        }
      : null,
    journalInterview: journalInterviewHeadline
      ? {
          headline: journalInterviewHeadline,
          photoUrl: publication.get('journalInterviewPhotoUrl') || '',
          body: publication.get('journalInterviewBody') || '',
          viewCount: Number(publication.get('journalInterviewViewCount') || 0),
          ...mapMediaAuthorBlock('journalInterview', publication),
          votes: voteSummaries.journal_interview,
          myScore: myVotes.journal_interview ?? null,
        }
      : null,
    highlightVideo: highlightVideoTitle
      ? {
          title: highlightVideoTitle,
          description: publication.get('highlightVideoDescription') || '',
          videoUrl: publication.get('highlightVideoUrl') || '',
          durationSec: Number(publication.get('highlightVideoDurationSec') || 0),
          viewCount: Number(publication.get('highlightVideoViewCount') || 0),
          ...mapMediaAuthorBlock('highlightVideo', publication),
        }
      : null,
    myVotes: myVotes || {},
  };
}

function mapTopMediaItem(publication, kind) {
  if (!publication) return null;
  const event = publication.get('event');
  const pelada = publication.get('pelada');
  const base = {
    eventId: event && event.id ? event.id : '',
    eventName: (event && event.get && event.get('name')) || '',
    peladaId: pelada && pelada.id ? pelada.id : '',
    peladaName: (pelada && pelada.get && pelada.get('name')) || '',
    publicationId: publication.id,
  };

  if (kind === 'video') {
    const title = publication.get('highlightVideoTitle');
    if (!title) return null;
    return {
      ...base,
      kind: 'video',
      category: 'highlight_video',
      title,
      description: publication.get('highlightVideoDescription') || '',
      mediaUrl: publication.get('highlightVideoUrl') || '',
      viewCount: Number(publication.get('highlightVideoViewCount') || 0),
      authorName: publication.get('highlightVideoAuthorName') || '',
      authorApelido: publication.get('highlightVideoAuthorApelido') || '',
      authorAvatarUrl: publication.get('highlightVideoAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('highlightVideoUpdatedAt')
        ? publication.get('highlightVideoUpdatedAt').toISOString()
        : undefined,
    };
  }

  if (kind === 'radio') {
    const narrationViews = Number(publication.get('radioNarrationViewCount') || 0);
    const interviewViews = Number(publication.get('radioInterviewViewCount') || 0);
    const useInterview = interviewViews > narrationViews && publication.get('radioInterviewTitle');
    if (useInterview) {
      return {
        ...base,
        kind: 'radio',
        category: 'radio_interview',
        title: publication.get('radioInterviewTitle') || '',
        description: publication.get('radioInterviewDescription') || '',
        mediaUrl: publication.get('radioInterviewAudioUrl') || '',
        viewCount: interviewViews,
        authorName: publication.get('radioInterviewAuthorName') || '',
        authorApelido: publication.get('radioInterviewAuthorApelido') || '',
        authorAvatarUrl: publication.get('radioInterviewAuthorAvatarUrl') || undefined,
        updatedAt: publication.get('radioInterviewUpdatedAt')
          ? publication.get('radioInterviewUpdatedAt').toISOString()
          : undefined,
      };
    }
    if (!publication.get('radioNarrationTitle')) return null;
    return {
      ...base,
      kind: 'radio',
      category: 'radio_narration',
      title: publication.get('radioNarrationTitle') || '',
      description: publication.get('radioNarrationDescription') || '',
      mediaUrl: publication.get('radioNarrationAudioUrl') || '',
      viewCount: narrationViews,
      authorName: publication.get('radioNarrationAuthorName') || '',
      authorApelido: publication.get('radioNarrationAuthorApelido') || '',
      authorAvatarUrl: publication.get('radioNarrationAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('radioNarrationUpdatedAt')
        ? publication.get('radioNarrationUpdatedAt').toISOString()
        : undefined,
    };
  }

  // journal
  const reportageViews = Number(publication.get('journalReportageViewCount') || 0);
  const interviewViews = Number(publication.get('journalInterviewViewCount') || 0);
  const useInterview = interviewViews > reportageViews && publication.get('journalInterviewHeadline');
  if (useInterview) {
    return {
      ...base,
      kind: 'journal',
      category: 'journal_interview',
      title: publication.get('journalInterviewHeadline') || '',
      description: publication.get('journalInterviewBody') || '',
      mediaUrl: publication.get('journalInterviewPhotoUrl') || '',
      viewCount: interviewViews,
      authorName: publication.get('journalInterviewAuthorName') || '',
      authorApelido: publication.get('journalInterviewAuthorApelido') || '',
      authorAvatarUrl: publication.get('journalInterviewAuthorAvatarUrl') || undefined,
      updatedAt: publication.get('journalInterviewUpdatedAt')
        ? publication.get('journalInterviewUpdatedAt').toISOString()
        : undefined,
    };
  }
  if (!publication.get('journalReportageHeadline')) return null;
  return {
    ...base,
    kind: 'journal',
    category: 'journal_reportage',
    title: publication.get('journalReportageHeadline') || '',
    description: publication.get('journalReportageBody') || '',
    mediaUrl: publication.get('journalReportagePhotoUrl') || '',
    viewCount: reportageViews,
    authorName: publication.get('journalReportageAuthorName') || '',
    authorApelido: publication.get('journalReportageAuthorApelido') || '',
    authorAvatarUrl: publication.get('journalReportageAuthorAvatarUrl') || undefined,
    updatedAt: publication.get('journalReportageUpdatedAt')
      ? publication.get('journalReportageUpdatedAt').toISOString()
      : undefined,
  };
}

Parse.Cloud.define('getEventMediaDashboard', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const event = await loadEventForMedia(eventId);

  let publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (!publication) {
    publication = await new Parse.Query('EventMediaPublication')
      .equalTo('eventId', eventId)
      .first({ useMasterKey: true });
  }

  const voteSummaries = {};
  for (const category of EVENT_MEDIA_SCORE_CATEGORIES) {
    try {
      voteSummaries[category] = await buildMediaVoteSummary(eventId, category);
    } catch (error) {
      console.error('buildMediaVoteSummary failed', category, error);
      voteSummaries[category] = { voteCount: 0, averageScore: 0 };
    }
  }
  let myVotes = {};
  try {
    myVotes = await loadMyMediaVotes(eventId, user.id);
  } catch (error) {
    console.error('loadMyMediaVotes failed', error);
  }

  return mapPublicationDashboard(publication, eventId, voteSummaries, myVotes);
});

Parse.Cloud.define('publishEventRadioNarration', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const audioUrl = trimText(request.params.audioUrl, 2048);
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo da narracao.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao da narracao.');
  }
  if (!audioUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Audio da narracao obrigatorio.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'narrator');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('radioNarrationTitle');

  publication.set('radioNarrationTitle', title);
  publication.set('radioNarrationDescription', description);
  publication.set('radioNarrationAudioUrl', audioUrl);
  publication.set('radioNarrationAuthorId', author.authorId);
  publication.set('radioNarrationAuthorName', author.authorName);
  publication.set('radioNarrationAuthorApelido', author.authorApelido);
  publication.set('radioNarrationAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('radioNarrationUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'radio_narration');
  }
  publication.set('radioNarrationViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventRadioInterview', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const audioUrl = trimText(request.params.audioUrl, 2048);
  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo da entrevista.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao da entrevista.');
  }
  if (!audioUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Audio da entrevista obrigatorio.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'narrator');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('radioInterviewTitle');

  publication.set('radioInterviewTitle', title);
  publication.set('radioInterviewDescription', description);
  publication.set('radioInterviewAudioUrl', audioUrl);
  publication.set('radioInterviewAuthorId', author.authorId);
  publication.set('radioInterviewAuthorName', author.authorName);
  publication.set('radioInterviewAuthorApelido', author.authorApelido);
  publication.set('radioInterviewAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('radioInterviewUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'radio_interview');
  }
  publication.set('radioInterviewViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventJournalReportage', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const headline = trimText(request.params.headline, 160);
  const body = trimText(request.params.body, 12000);
  const photoUrl = trimText(request.params.photoUrl, 2048);
  if (!headline) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe a manchete da reportagem.');
  }
  if (!body) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o texto da reportagem.');
  }
  if (!photoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foto da reportagem obrigatoria.');
  }
  const storedPhotoUrl = assertPublicHttpUrl(photoUrl, 'Foto da reportagem');

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'journalist');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('journalReportageHeadline');

  publication.set('journalReportageHeadline', headline);
  publication.set('journalReportageBody', body);
  publication.set('journalReportagePhotoUrl', storedPhotoUrl);
  publication.set('journalReportageAuthorId', author.authorId);
  publication.set('journalReportageAuthorName', author.authorName);
  publication.set('journalReportageAuthorApelido', author.authorApelido);
  publication.set('journalReportageAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('journalReportageUpdatedAt', now);
  if (hadContent) {
    try {
      await clearCategoryEngagement(event, 'journal_reportage');
    } catch (clearError) {
      console.warn('clearCategoryEngagement journal_reportage failed', clearError);
    }
  }
  publication.set('journalReportageViewCount', 0);

  await publication.save(null, { useMasterKey: true });

  const eventLabel = safeDisplayName(event.get('name'), 'evento');
  await notifyEventMediaPublishedToParticipants(event, user.id, {
    title: 'Nova reportagem no mural',
    alert: `${author.authorName} publicou uma reportagem em ${eventLabel}.`,
    pushType: 'event_journal_reportage',
    category: 'journal_reportage',
  });

  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventJournalInterview', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const headline = trimText(request.params.headline, 160);
  const body = trimText(request.params.body, 12000);
  const photoUrl = trimText(request.params.photoUrl, 2048);
  if (!headline) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe a manchete da entrevista.');
  }
  if (!body) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o texto da entrevista.');
  }
  if (!photoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foto da entrevista obrigatoria.');
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'journalist');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('journalInterviewHeadline');

  publication.set('journalInterviewHeadline', headline);
  publication.set('journalInterviewBody', body);
  publication.set('journalInterviewPhotoUrl', photoUrl);
  publication.set('journalInterviewAuthorId', author.authorId);
  publication.set('journalInterviewAuthorName', author.authorName);
  publication.set('journalInterviewAuthorApelido', author.authorApelido);
  publication.set('journalInterviewAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('journalInterviewUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'journal_interview');
  }
  publication.set('journalInterviewViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString() };
});

Parse.Cloud.define('publishEventHighlightVideo', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const title = trimText(request.params.title, 120);
  const description = trimText(request.params.description, 500);
  const videoUrl = trimText(request.params.videoUrl, 2048);
  const durationSec = Math.round(Number(request.params.durationSec || 0));

  if (!title) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe o titulo do video.');
  }
  if (!description) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe uma breve descricao do video.');
  }
  if (!videoUrl) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Video obrigatorio.');
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Duracao do video invalida.');
  }
  if (durationSec > HIGHLIGHT_VIDEO_MAX_SECONDS) {
    throw new Parse.Error(
      Parse.Error.INVALID_QUERY,
      'O video de melhores momentos deve ter no maximo 5 minutos.'
    );
  }

  const { event, registration } = await assertConfirmedRoleRegistration(user, eventId, 'cameraman');
  const publication = await getOrCreateEventMediaPublication(event);
  const author = mapAuthorSnapshot(user, registration);
  const now = new Date();
  const hadContent = !!publication.get('highlightVideoTitle');

  publication.set('highlightVideoTitle', title);
  publication.set('highlightVideoDescription', description);
  publication.set('highlightVideoUrl', videoUrl);
  publication.set('highlightVideoDurationSec', durationSec);
  publication.set('highlightVideoAuthorId', author.authorId);
  publication.set('highlightVideoAuthorName', author.authorName);
  publication.set('highlightVideoAuthorApelido', author.authorApelido);
  publication.set('highlightVideoAuthorAvatarUrl', author.authorAvatarUrl || '');
  publication.set('highlightVideoUpdatedAt', now);
  if (hadContent) {
    await clearCategoryEngagement(event, 'highlight_video');
  }
  publication.set('highlightVideoViewCount', 0);

  await publication.save(null, { useMasterKey: true });
  return { ok: true, updatedAt: now.toISOString(), overwritten: hadContent };
});

Parse.Cloud.define('castEventMediaVote', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, false);
  const clearRequested = !!request.params.clear;
  const event = await loadEventForMedia(eventId);

  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  const existing = await new Parse.Query('EventMediaVote')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('voter', user)
    .first({ useMasterKey: true });

  // Toggle: clear explicito ou clicar na mesma nota remove o voto (permite escolher outra).
  if (existing) {
    const currentScore = Number(existing.get('score'));
    const score = clearRequested ? currentScore : normalizeMediaScore(request.params.score);
    if (clearRequested || currentScore === score) {
      await existing.destroy({ useMasterKey: true });
      const summary = await buildMediaVoteSummary(eventId, category);
      return { ok: true, score: null, myScore: null, ...summary };
    }
    existing.set('score', score);
    await existing.save(null, { useMasterKey: true });
    const summary = await buildMediaVoteSummary(eventId, category);
    return { ok: true, score, myScore: score, ...summary };
  }

  if (clearRequested) {
    const summary = await buildMediaVoteSummary(eventId, category);
    return { ok: true, score: null, myScore: null, ...summary };
  }

  const score = normalizeMediaScore(request.params.score);
  const vote = new Parse.Object('EventMediaVote');
  vote.set('event', event);
  vote.set('category', category);
  vote.set('voter', user);
  vote.set('score', score);
  await vote.save(null, { useMasterKey: true });

  const summary = await buildMediaVoteSummary(eventId, category);
  return { ok: true, score, myScore: score, ...summary };
});

Parse.Cloud.define('getEventMediaEngagement', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  return {
    ok: true,
    eventId,
    category,
    ...(await buildEngagementBundle(event, category, user.id, publication)),
  };
});

Parse.Cloud.define('recordEventMediaView', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  const existing = await new Parse.Query('EventMediaView')
    .equalTo('event', event)
    .equalTo('category', category)
    .equalTo('viewer', user)
    .first({ useMasterKey: true });

  const viewCountField = MEDIA_VIEW_COUNT_FIELD_BY_CATEGORY[category];
  let viewCount = Number(publication.get(viewCountField) || 0);
  let counted = false;
  const authorId = getMediaPublicationAuthorId(publication, category);
  const isAuthor = !!(authorId && authorId === user.id);
  const confirmed = await isConfirmedEventParticipant(user, event);
  const countsForTop = !isAuthor && confirmed;

  if (!existing) {
    const view = new Parse.Object('EventMediaView');
    view.set('event', event);
    view.set('eventId', event.id);
    view.set('category', category);
    view.set('viewer', user);
    view.set('viewerId', user.id);
    view.set('countsForTop', countsForTop);
    const pelada = event.get('pelada');
    if (pelada) view.set('pelada', pelada);
    await view.save(null, { useMasterKey: true });

    if (countsForTop) {
      viewCount += 1;
      publication.set(viewCountField, viewCount);
      await publication.save(null, { useMasterKey: true });
      counted = true;
    }
  }

  return {
    ok: true,
    counted,
    viewCount,
    viewedByMe: true,
    countsForTop,
    skippedReason: existing
      ? 'already_viewed'
      : isAuthor
        ? 'author'
        : !confirmed
          ? 'not_confirmed_participant'
          : null,
  };
});

Parse.Cloud.define('setEventMediaReaction', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const clear = !!request.params.clear;
  const commentId = String(request.params.commentId || '').trim();
  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);

  if (!commentId && !clear) {
    assertNotMediaAuthorEngagement(publication, category, user.id, 'reagir');
  }

  if (commentId) {
    const comment = await new Parse.Query('EventMediaComment').get(commentId, { useMasterKey: true });
    const commentEvent = comment.get('event');
    if (!commentEvent || commentEvent.id !== event.id || comment.get('category') !== category) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Comentario invalido para esta midia.');
    }
  }

  const candidates = await findReactionsForEventCategory(event, category);
  const existing =
    candidates.find((row) => {
      if (reactionUserId(row) !== user.id) return false;
      if (commentId) return String(row.get('commentId') || '') === commentId;
      return isMediaLevelReaction(row);
    }) || null;

  if (clear) {
    if (existing) {
      await existing.destroy({ useMasterKey: true });
    }
  } else {
    const reaction = normalizeReaction(request.params.reaction);
    if (existing) {
      existing.set('reaction', reaction);
      existing.set('event', event);
      existing.set('eventId', event.id);
      existing.set('user', user);
      existing.set('userId', user.id);
      if (commentId) {
        existing.set('commentId', commentId);
      } else if (existing.get('commentId') != null) {
        existing.unset('commentId');
      }
      await existing.save(null, { useMasterKey: true });
    } else {
      const row = new Parse.Object('EventMediaReaction');
      row.set('event', event);
      row.set('eventId', event.id);
      row.set('category', category);
      row.set('user', user);
      row.set('userId', user.id);
      row.set('reaction', reaction);
      if (commentId) {
        row.set('commentId', commentId);
      }
      await row.save(null, { useMasterKey: true });
    }
  }

  if (commentId) {
    return {
      ok: true,
      commentId,
      ...(await buildCommentReactionSummary(event, category, commentId, user.id)),
    };
  }

  return {
    ok: true,
    ...(await buildReactionSummary(event, category, user.id)),
  };
});

Parse.Cloud.define('upsertEventMediaComment', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const eventId = String(request.params.eventId || '').trim();
  const category = normalizeMediaCategory(request.params.category, true);
  const text = trimText(request.params.text, MEDIA_COMMENT_MAX_LENGTH);
  if (!text) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Informe um comentario breve.');
  }
  assertCommentDiscipline(text);

  const event = await loadEventForMedia(eventId);
  const publication = await new Parse.Query('EventMediaPublication')
    .equalTo('event', event)
    .first({ useMasterKey: true });
  await assertPublicationHasCategory(publication, category);
  assertNotMediaAuthorEngagement(publication, category, user.id, 'comentar');

  let parentCommentId = String(request.params.parentCommentId || '').trim();
  if (parentCommentId) {
    const parent = await new Parse.Query('EventMediaComment').get(parentCommentId, {
      useMasterKey: true,
    });
    const parentEvent = parent.get('event');
    if (!parentEvent || parentEvent.id !== event.id || parent.get('category') !== category) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Comentario pai invalido.');
    }
    // Um nivel de resposta: respostas aninhadas ficam sob o comentario raiz.
    const rootParentId = String(parent.get('parentCommentId') || '').trim();
    if (rootParentId) {
      parentCommentId = rootParentId;
    }
  }

  const userName = (user.get('apelido') || user.get('name') || user.getUsername() || 'Usuario').trim();
  const row = new Parse.Object('EventMediaComment');
  row.set('event', event);
  row.set('category', category);
  row.set('user', user);
  row.set('userId', user.id);
  row.set('userName', userName);
  row.set('text', text);
  if (parentCommentId) {
    row.set('parentCommentId', parentCommentId);
  }
  await row.save(null, { useMasterKey: true });

  const { comments } = await loadComments(event, category, user.id);
  return { ok: true, comments };
});

Parse.Cloud.define('getTopEventMedia', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const kind = String(request.params.kind || 'video').trim();
  if (!['video', 'radio', 'journal'].includes(kind)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'kind invalido (video|radio|journal).');
  }
  const scope = String(request.params.scope || 'app').trim();
  if (!['app', 'pelada'].includes(scope)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scope invalido (app|pelada).');
  }

  const peladaId = scope === 'pelada' ? String(request.params.peladaId || '').trim() : '';
  if (scope === 'pelada' && !peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio para scope pelada.');
  }
  const peladaPtr = peladaId
    ? Parse.Object.extend('Pelada').createWithoutData(peladaId)
    : null;

  function applyScope(q) {
    if (peladaPtr) q.equalTo('pelada', peladaPtr);
    q.include(['event', 'pelada']);
    q.limit(200);
    return q;
  }

  let rows = [];
  if (kind === 'video') {
    const query = applyScope(new Parse.Query('EventMediaPublication'));
    query.exists('highlightVideoUrl');
    query.descending('highlightVideoViewCount');
    rows = await query.find({ useMasterKey: true });
  } else if (kind === 'radio') {
    const qNarration = applyScope(new Parse.Query('EventMediaPublication'));
    qNarration.exists('radioNarrationTitle');
    qNarration.descending('radioNarrationViewCount');
    const qInterview = applyScope(new Parse.Query('EventMediaPublication'));
    qInterview.exists('radioInterviewTitle');
    qInterview.descending('radioInterviewViewCount');
    const [narrationRows, interviewRows] = await Promise.all([
      qNarration.find({ useMasterKey: true }),
      qInterview.find({ useMasterKey: true }),
    ]);
    const map = new Map();
    for (const row of narrationRows.concat(interviewRows)) {
      if (row && row.id) map.set(row.id, row);
    }
    rows = Array.from(map.values());
  } else {
    const qReportage = applyScope(new Parse.Query('EventMediaPublication'));
    qReportage.exists('journalReportageHeadline');
    qReportage.descending('journalReportageViewCount');
    const qInterview = applyScope(new Parse.Query('EventMediaPublication'));
    qInterview.exists('journalInterviewHeadline');
    qInterview.descending('journalInterviewViewCount');
    const [reportageRows, interviewRows] = await Promise.all([
      qReportage.find({ useMasterKey: true }),
      qInterview.find({ useMasterKey: true }),
    ]);
    const map = new Map();
    for (const row of reportageRows.concat(interviewRows)) {
      if (row && row.id) map.set(row.id, row);
    }
    rows = Array.from(map.values());
  }

  let best = null;
  for (const row of rows) {
    const mapped = mapTopMediaItem(row, kind);
    if (!mapped) continue;
    if (!meetsMediaTopViewQuorum(mapped.viewCount)) continue;
    if (!best || mapped.viewCount > best.viewCount) {
      best = mapped;
    }
  }

  return { ok: true, scope, kind, item: best, minViews: INTEGRITY_MIN_MEDIA_TOP_VIEWS };
});

Parse.Cloud.define('configureEventMediaClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const authAddField = { requiresAuthentication: true };
  const cloudOnlyWrite = {
    find: authRead,
    get: authRead,
    count: authRead,
    create: {},
    update: {},
    delete: {},
    addField: authAddField,
    protectedFields: {},
  };

  // Publicacao ainda precisa de update via Cloud (Master Key); cliente nao cria/edita direto.
  const created = [];
  const updated = [];
  for (const className of [
    'EventMediaPublication',
    'EventMediaVote',
    'EventMediaView',
    'EventMediaReaction',
    'EventMediaComment',
  ]) {
    const schema = new Parse.Schema(className);
    schema.setCLP(cloudOnlyWrite);
    try {
      await schema.update();
      updated.push(className);
    } catch {
      await schema.save();
      created.push(className);
    }
  }

  return { ok: true, classes: 5, created, updated };
});

// --- 13-material.js ---

/** Controle de material da pelada / ropeiro (kitman) e sessao por evento */

const MATERIAL_INVENTORY_CLASS = 'MaterialInventoryItem';
const EVENT_MATERIAL_SESSION_CLASS = 'EventMaterialSession';

const MATERIAL_ITEM_TYPES = [
  'shirt',
  'bib',
  'shorts',
  'socks',
  'shin_guards',
  'gloves',
  'captain_armband',
  'ball',
  'goal_net',
  'water_bottle',
  'water_gallon',
  'goal_post',
];

const MATERIAL_ITEM_LABELS = {
  shirt: 'Camisas',
  bib: 'Coletes',
  shorts: 'Calcoes',
  socks: 'Pares de Meioes',
  shin_guards: 'Pares de Caneleiras',
  gloves: 'Pares de Luvas',
  captain_armband: 'Faixa de capitao',
  ball: 'Bolas',
  goal_net: 'Pares Redes de Barras',
  water_bottle: "Garrafas d'agua",
  water_gallon: "Garrafoes d'agua",
  goal_post: 'Pares de Barras',
};

function materialLineLabel(itemType, color) {
  const base = MATERIAL_ITEM_LABELS[itemType] || itemType;
  const normalized = String(color || '').trim();
  return normalized ? `${base} (${normalized})` : base;
}

function normalizeColor(color) {
  return String(color || '').trim();
}

function mapInventoryItem(obj) {
  const quantity = Math.max(0, Number(obj.get('quantity') || 0));
  const damagedQuantity = Math.max(0, Number(obj.get('damagedQuantity') || 0));
  const pelada = obj.get('pelada');
  const user = obj.get('user');
  return {
    objectId: obj.id,
    ownerType: obj.get('ownerType') || 'pelada',
    peladaId: pelada && pelada.id ? pelada.id : undefined,
    userId: user && user.id ? user.id : undefined,
    itemType: obj.get('itemType') || 'ball',
    color: normalizeColor(obj.get('color')),
    quantity,
    damagedQuantity,
    // Avaria e qualificativa: o item continua utilizavel no evento.
    availableQuantity: quantity,
  };
}

function normalizeLines(rawLines) {
  if (!Array.isArray(rawLines)) return [];
  return rawLines.map((line) => {
    const quantityBlindCounted =
      line.quantityBlindCounted == null
        ? null
        : Math.max(0, Number(line.quantityBlindCounted || 0));
    let quantityDamagedCounted =
      line.quantityDamagedCounted == null
        ? null
        : Math.max(0, Number(line.quantityDamagedCounted || 0));
    if (
      quantityBlindCounted != null &&
      quantityDamagedCounted != null &&
      quantityDamagedCounted > quantityBlindCounted
    ) {
      quantityDamagedCounted = quantityBlindCounted;
    }
    return {
      inventoryItemId: line.inventoryItemId ? String(line.inventoryItemId) : undefined,
      itemType: String(line.itemType || 'ball'),
      color: normalizeColor(line.color),
      quantityLoaded: Math.max(0, Number(line.quantityLoaded || 0)),
      quantitySent: Math.max(0, Number(line.quantitySent || 0)),
      quantityReturned: Math.max(0, Number(line.quantityReturned || 0)),
      quantityBlindCounted,
      quantityDamagedCounted,
    };
  });
}

async function applyInventoryDamagesFromConference(lines) {
  for (const line of lines) {
    const damaged = Math.max(0, Number(line.quantityDamagedCounted || 0));
    if (!line.inventoryItemId || damaged <= 0) continue;
    try {
      const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(line.inventoryItemId, {
        useMasterKey: true,
      });
      const quantity = Math.max(0, Number(item.get('quantity') || 0));
      const current = Math.max(0, Number(item.get('damagedQuantity') || 0));
      item.set('damagedQuantity', Math.min(quantity, current + damaged));
      await item.save(null, { useMasterKey: true });
    } catch {
      // Continua demais itens
    }
  }
}

function computeDivergences(lines, mode) {
  const rows = [];
  for (const line of lines) {
    if (line.quantityBlindCounted == null) continue;
    const expected =
      mode === 'return'
        ? line.quantitySent
        : line.quantitySent || line.quantityLoaded;
    const counted = Number(line.quantityBlindCounted) || 0;
    const delta = counted - expected;
    if (delta === 0) continue;
    rows.push({
      itemType: line.itemType,
      color: line.color,
      label: materialLineLabel(line.itemType, line.color),
      expected,
      counted,
      delta,
    });
  }
  return rows;
}

async function getCounterpartyName(userId) {
  if (!userId) return undefined;
  try {
    const user = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
    return (
      user.get('apelido') ||
      user.get('name') ||
      user.getUsername() ||
      'Ropeiro'
    );
  } catch {
    return 'Ropeiro';
  }
}

/** Resolve o unico ropeiro do evento (inscricao ou convite aceito). */
async function resolveEventKitmanCounterparty(event) {
  const kitmanReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'kitman')
    .include('user')
    .ascending('createdAt')
    .first({ useMasterKey: true });
  const kitmanUser = kitmanReg && kitmanReg.get('user');
  if (kitmanUser && kitmanUser.id) {
    return {
      userId: kitmanUser.id,
      displayName:
        kitmanReg.get('userDisplayName') ||
        kitmanReg.get('apelido') ||
        (await getCounterpartyName(kitmanUser.id)),
    };
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('role', 'kitman')
    .containedIn('status', ['accepted', 'presence_confirmed', 'payment_released', 'completed'])
    .include('invitedUser')
    .ascending('createdAt')
    .first({ useMasterKey: true });
  const invited = invitation && invitation.get('invitedUser');
  if (invited && invited.id) {
    return {
      userId: invited.id,
      displayName: await getCounterpartyName(invited.id),
    };
  }
  return null;
}

async function ensurePeladaSessionKitmanCounterparty(session, event) {
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    return session;
  }
  if (session.get('counterpartyUserId')) {
    return session;
  }
  const kitman = await resolveEventKitmanCounterparty(event);
  if (!kitman) {
    return session;
  }
  session.set('counterpartyUserId', kitman.userId);
  session.set('counterpartyName', kitman.displayName);
  await session.save(null, { useMasterKey: true });
  return session;
}

function mapSession(obj) {
  const materialSource = obj.get('materialSource') || 'none';
  const lines = normalizeLines(obj.get('lines'));
  const mode = materialSource === 'pelada' ? 'return' : 'receive';
  const stored = obj.get('divergences');
  const divergences = Array.isArray(stored) ? stored : computeDivergences(lines, mode);
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : '',
    materialSource,
    counterpartyUserId: obj.get('counterpartyUserId') || undefined,
    counterpartyName: obj.get('counterpartyName') || undefined,
    status: obj.get('status') || 'idle',
    lines,
    divergences,
    lossesApplied: !!obj.get('lossesApplied'),
    updatedAt: obj.get('updatedAt') ? obj.get('updatedAt').toISOString() : undefined,
  };
}

async function assertEventMaterialActor(eventId, user) {
  const event = await new Parse.Query('Event')
    .include('pelada')
    .include('admin')
    .get(eventId, { useMasterKey: true });
  const admin = event.get('admin');
  const isAdmin = !!(admin && admin.id === user.id);

  const kitmanRegistration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'kitman')
    .first({ useMasterKey: true });

  let isContractedKitman = false;
  if (kitmanRegistration) {
    isContractedKitman = true;
  } else {
    const invitation = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('invitedUser', user)
      .equalTo('role', 'kitman')
      .containedIn('status', ['accepted', 'presence_confirmed', 'payment_released', 'completed'])
      .first({ useMasterKey: true });
    isContractedKitman = !!invitation;
  }

  if (!isAdmin && !isContractedKitman) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador ou o ropeiro do evento podem gerenciar material.'
    );
  }

  return { event, isAdmin, isContractedKitman };
}

async function getOrCreateSession(event) {
  let session = await new Parse.Query(EVENT_MATERIAL_SESSION_CLASS)
    .equalTo('event', event)
    .first({ useMasterKey: true });
  if (session) return session;

  session = new Parse.Object(EVENT_MATERIAL_SESSION_CLASS);
  session.set('event', event);
  session.set('materialSource', 'none');
  session.set('status', 'idle');
  session.set('lines', []);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  await session.save(null, { useMasterKey: true });
  return session;
}

async function assertInventoryOwnerAccess(ownerType, peladaId, user) {
  if (ownerType === 'kitman') {
    return { ownerType: 'kitman', user };
  }
  if (!peladaId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
  }
  const pelada = await assertPeladaAdminUser(peladaId, user);
  return { ownerType: 'pelada', pelada, user };
}

Parse.Cloud.define('listMaterialInventory', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const ownerType = String(request.params.ownerType || '').trim();
  if (ownerType !== 'pelada' && ownerType !== 'kitman') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'ownerType invalido.');
  }

  const query = new Parse.Query(MATERIAL_INVENTORY_CLASS);
  query.equalTo('ownerType', ownerType);
  if (ownerType === 'pelada') {
    const peladaId = String(request.params.peladaId || '').trim();
    if (!peladaId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'peladaId obrigatorio.');
    }
    const pelada = await new Parse.Query('Pelada').get(peladaId, { useMasterKey: true });
    const admin = pelada.get('admin');
    if (!admin || admin.id !== user.id) {
      // Socios ativos tambem podem visualizar (somente leitura); mutacoes sao admin-only.
      const membership = await new Parse.Query('PeladaMembership')
        .equalTo('pelada', pelada)
        .equalTo('user', user)
        .equalTo('status', 'active')
        .first({ useMasterKey: true });
      if (!membership) {
        throw new Parse.Error(
          Parse.Error.OPERATION_FORBIDDEN,
          'Sem permissao para ver o material desta pelada.'
        );
      }
    }
    query.equalTo('pelada', pelada);
  } else {
    query.equalTo('user', user);
  }

  query.ascending('itemType');
  query.addAscending('color');
  query.limit(500);
  const rows = await query.find({ useMasterKey: true });
  return rows.map(mapInventoryItem);
});

Parse.Cloud.define('upsertMaterialInventoryItem', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const ownerType = String(request.params.ownerType || '').trim();
  const itemType = String(request.params.itemType || '').trim();
  const color = normalizeColor(request.params.color);
  const quantity = Math.max(0, Number(request.params.quantity || 0));
  const damagedQuantity = Math.max(0, Number(request.params.damagedQuantity || 0));
  const objectId = String(request.params.objectId || '').trim();

  if (ownerType !== 'pelada' && ownerType !== 'kitman') {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'ownerType invalido.');
  }
  if (!MATERIAL_ITEM_TYPES.includes(itemType)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Tipo de material invalido.');
  }
  if (damagedQuantity > quantity) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Quantidade avariada nao pode ser maior que a quantidade total.'
    );
  }

  const access = await assertInventoryOwnerAccess(
    ownerType,
    String(request.params.peladaId || '').trim(),
    user
  );

  let item;
  if (objectId) {
    item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(objectId, {
      useMasterKey: true,
    });
    if (ownerType === 'pelada') {
      const pelada = item.get('pelada');
      if (!pelada || pelada.id !== access.pelada.id) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item nao encontrado.');
      }
    } else {
      const owner = item.get('user');
      if (!owner || owner.id !== user.id) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item nao encontrado.');
      }
    }
  } else {
    item = new Parse.Object(MATERIAL_INVENTORY_CLASS);
    item.set('ownerType', ownerType);
    if (ownerType === 'pelada') {
      item.set('pelada', access.pelada);
      item.unset('user');
    } else {
      item.set('user', user);
      item.unset('pelada');
    }
  }

  item.set('itemType', itemType);
  item.set('color', color);
  item.set('quantity', quantity);
  item.set('damagedQuantity', damagedQuantity);
  await item.save(null, { useMasterKey: true });
  return mapInventoryItem(item);
});

Parse.Cloud.define('deleteMaterialInventoryItem', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const objectId = String(request.params.objectId || '').trim();
  if (!objectId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'objectId obrigatorio.');
  }

  const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(objectId, {
    useMasterKey: true,
  });
  const ownerType = item.get('ownerType');
  if (ownerType === 'kitman') {
    const owner = item.get('user');
    if (!owner || owner.id !== user.id) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao.');
    }
  } else {
    const pelada = item.get('pelada');
    if (!pelada || !pelada.id) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Item invalido.');
    }
    await assertPeladaAdminUser(pelada.id, user);
  }

  await item.destroy({ useMasterKey: true });
  return { ok: true };
});

Parse.Cloud.define('getEventMaterialSession', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }

  await assertEventMaterialActor(eventId, user);
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  let session = await getOrCreateSession(event);
  session = await ensurePeladaSessionKitmanCounterparty(session, event);
  return mapSession(session);
});

Parse.Cloud.define('setEventMaterialSource', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const materialSource = String(request.params.materialSource || '').trim();
  const counterpartyUserId = String(request.params.counterpartyUserId || '').trim();

  if (!['pelada', 'kitman', 'none'].includes(materialSource)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Origem de material invalida.');
  }

  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );

  const session = await getOrCreateSession(event);
  const currentSource = session.get('materialSource') || 'none';

  // Admin define origem; se ja for material da pelada, ropeiro nao pode trocar.
  if (!isAdmin && isContractedKitman) {
    if (materialSource === 'pelada') {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Apenas o administrador define uso do material da pelada.'
      );
    }
    if (currentSource === 'pelada') {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'O administrador ja definiu uso do material da pelada neste evento.'
      );
    }
  }

  session.set('materialSource', materialSource);
  session.set('lines', []);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  session.set('status', 'idle');

  if (materialSource === 'none') {
    session.unset('counterpartyUserId');
    session.unset('counterpartyName');
  } else if (counterpartyUserId) {
    session.set('counterpartyUserId', counterpartyUserId);
    session.set('counterpartyName', await getCounterpartyName(counterpartyUserId));
  } else if (materialSource === 'kitman' && isContractedKitman) {
    session.set('counterpartyUserId', user.id);
    session.set('counterpartyName', await getCounterpartyName(user.id));
  } else if (materialSource === 'pelada' && isAdmin) {
    const kitman = await resolveEventKitmanCounterparty(event);
    if (kitman) {
      session.set('counterpartyUserId', kitman.userId);
      session.set('counterpartyName', kitman.displayName);
    } else {
      session.unset('counterpartyUserId');
      session.unset('counterpartyName');
    }
  }

  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('loadEventMaterial', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const mode = String(request.params.mode || 'all').trim();
  const partialLines = Array.isArray(request.params.lines) ? request.params.lines : [];

  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  if (materialSource === 'none') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Defina a origem do material antes de carregar.'
    );
  }
  if (materialSource === 'pelada' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador carrega o material da pelada.'
    );
  }
  if (materialSource === 'kitman' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o ropeiro carrega o proprio material.'
    );
  }

  const inventoryQuery = new Parse.Query(MATERIAL_INVENTORY_CLASS);
  if (materialSource === 'pelada') {
    const pelada = event.get('pelada');
    if (!pelada || !pelada.id) {
      throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Evento sem pelada.');
    }
    inventoryQuery.equalTo('ownerType', 'pelada');
    inventoryQuery.equalTo('pelada', Parse.Object.extend('Pelada').createWithoutData(pelada.id));
  } else {
    const kitmanUserId = session.get('counterpartyUserId') || (isContractedKitman ? user.id : '');
    if (!kitmanUserId) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Ropeiro nao identificado. Contrate um ropeiro ou informe a contraparte.'
      );
    }
    inventoryQuery.equalTo('ownerType', 'kitman');
    inventoryQuery.equalTo('user', Parse.User.createWithoutData(kitmanUserId));
  }

  inventoryQuery.limit(500);
  const inventory = await inventoryQuery.find({ useMasterKey: true });
  const byId = new Map(inventory.map((row) => [row.id, row]));

  let lines = [];
  if (mode === 'all') {
    lines = inventory
      .map((row) => {
        const mapped = mapInventoryItem(row);
        if (mapped.availableQuantity <= 0) return null;
        return {
          inventoryItemId: mapped.objectId,
          itemType: mapped.itemType,
          color: mapped.color,
          quantityLoaded: mapped.availableQuantity,
          quantitySent: 0,
          quantityReturned: 0,
          quantityBlindCounted: null,
          quantityDamagedCounted: null,
        };
      })
      .filter(Boolean);
  } else {
    for (const entry of partialLines) {
      const inventoryItemId = String(entry.inventoryItemId || '').trim();
      const quantity = Math.max(0, Number(entry.quantity || 0));
      if (!inventoryItemId || quantity <= 0) continue;
      const row = byId.get(inventoryItemId);
      if (!row) continue;
      const mapped = mapInventoryItem(row);
      lines.push({
        inventoryItemId: mapped.objectId,
        itemType: mapped.itemType,
        color: mapped.color,
        quantityLoaded: Math.min(quantity, mapped.availableQuantity),
        quantitySent: 0,
        quantityReturned: 0,
        quantityBlindCounted: null,
        quantityDamagedCounted: null,
      });
    }
  }

  if (!lines.length) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Nenhum item disponivel para carregar.'
    );
  }

  session.set('lines', lines);
  session.set('divergences', []);
  session.set('lossesApplied', false);
  session.set('status', 'loaded');
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('sendEventMaterial', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Carregue o material antes de enviar.');
  }

  if (materialSource === 'pelada' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador envia o material da pelada.'
    );
  }
  if (materialSource === 'kitman' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o ropeiro envia o proprio material.'
    );
  }

  if (materialSource === 'pelada') {
    await ensurePeladaSessionKitmanCounterparty(session, event);
    if (!session.get('counterpartyUserId')) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Contrate um ropeiro no evento antes de enviar o material.'
      );
    }
  }

  const sent = lines.map((line) => ({
    ...line,
    quantitySent: line.quantityLoaded,
    quantityReturned: 0,
    quantityBlindCounted: null,
    quantityDamagedCounted: null,
  }));
  session.set('lines', sent);
  session.set('divergences', []);
  session.set('status', 'sent');
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('submitEventMaterialBlindCount', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const counts = Array.isArray(request.params.counts) ? request.params.counts : [];
  const { event, isAdmin, isContractedKitman } = await assertEventMaterialActor(
    eventId,
    user
  );
  const session = await getOrCreateSession(event);
  const materialSource = session.get('materialSource') || 'none';
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length || session.get('status') === 'idle') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao ha material enviado para conferir.');
  }

  // Contagem cega:
  // - material da pelada: ropeiro confere o que recebeu do admin
  // - material do ropeiro: admin confere o que recebeu do ropeiro
  if (materialSource === 'pelada' && !isContractedKitman && !isAdmin) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem permissao para conferir.');
  }
  if (materialSource === 'kitman' && !isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador faz a contagem cega do material do ropeiro.'
    );
  }

  const countMap = new Map();
  const damagedMap = new Map();
  for (const row of counts) {
    const key = `${String(row.itemType || '')}::${normalizeColor(row.color).toLowerCase()}`;
    countMap.set(key, Math.max(0, Number(row.quantity || 0)));
    if (row.damagedQuantity != null) {
      damagedMap.set(key, Math.max(0, Number(row.damagedQuantity || 0)));
    }
  }

  const updated = lines.map((line) => {
    const key = `${line.itemType}::${normalizeColor(line.color).toLowerCase()}`;
    const counted = countMap.has(key) ? countMap.get(key) : line.quantityBlindCounted;
    let damagedCounted = damagedMap.has(key)
      ? damagedMap.get(key)
      : line.quantityDamagedCounted;
    if (counted != null && damagedCounted != null && damagedCounted > counted) {
      damagedCounted = counted;
    }
    return {
      ...line,
      quantityBlindCounted: counted == null ? null : counted,
      quantityDamagedCounted: damagedCounted == null ? null : damagedCounted,
    };
  });

  const divergences = computeDivergences(updated, 'receive');
  session.set('lines', updated);
  session.set('divergences', divergences);
  session.set('status', 'received');
  await session.save(null, { useMasterKey: true });
  await applyInventoryDamagesFromConference(updated);
  return mapSession(session);
});

Parse.Cloud.define('receiveEventMaterialReturn', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const counts = Array.isArray(request.params.counts) ? request.params.counts : [];
  const { event, isAdmin } = await assertEventMaterialActor(eventId, user);
  if (!isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador recebe a devolucao do material.'
    );
  }

  const session = await getOrCreateSession(event);
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Devolucao aplica-se quando o material usado e o da pelada.'
    );
  }
  const lines = normalizeLines(session.get('lines'));
  if (!lines.length || session.get('status') === 'idle' || session.get('status') === 'loaded') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Envie o material antes de receber a devolucao.');
  }

  const countMap = new Map();
  const damagedMap = new Map();
  for (const row of counts) {
    const key = `${String(row.itemType || '')}::${normalizeColor(row.color).toLowerCase()}`;
    countMap.set(key, Math.max(0, Number(row.quantity || 0)));
    if (row.damagedQuantity != null) {
      damagedMap.set(key, Math.max(0, Number(row.damagedQuantity || 0)));
    }
  }

  const updated = lines.map((line) => {
    const key = `${line.itemType}::${normalizeColor(line.color).toLowerCase()}`;
    const counted = countMap.has(key)
      ? countMap.get(key)
      : line.quantityBlindCounted != null
        ? line.quantityBlindCounted
        : line.quantitySent;
    let damagedCounted = damagedMap.has(key)
      ? damagedMap.get(key)
      : line.quantityDamagedCounted != null
        ? line.quantityDamagedCounted
        : 0;
    if (damagedCounted > counted) {
      damagedCounted = counted;
    }
    return {
      ...line,
      quantityReturned: counted,
      quantityBlindCounted: counted,
      quantityDamagedCounted: damagedCounted,
    };
  });
  const divergences = computeDivergences(updated, 'return');
  session.set('lines', updated);
  session.set('divergences', divergences);
  session.set('status', 'reconciled');
  await session.save(null, { useMasterKey: true });
  // Soma apenas avarias novas informadas nesta conferência de devolucao.
  await applyInventoryDamagesFromConference(
    updated.map((line) => {
      const prior = lines.find(
        (row) =>
          row.itemType === line.itemType &&
          normalizeColor(row.color).toLowerCase() ===
            normalizeColor(line.color).toLowerCase()
      );
      const priorDamaged = Math.max(0, Number(prior?.quantityDamagedCounted || 0));
      const currentDamaged = Math.max(0, Number(line.quantityDamagedCounted || 0));
      return {
        ...line,
        quantityDamagedCounted: Math.max(0, currentDamaged - priorDamaged),
      };
    })
  );
  return mapSession(session);
});

Parse.Cloud.define('applyEventMaterialLosses', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventMaterialActor(eventId, user);
  if (!isAdmin) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o administrador aplica baixas no inventario da pelada.'
    );
  }

  const session = await getOrCreateSession(event);
  if ((session.get('materialSource') || 'none') !== 'pelada') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Baixa automatica aplica-se ao inventario da pelada.'
    );
  }
  if (session.get('lossesApplied')) {
    return mapSession(session);
  }

  const lines = normalizeLines(session.get('lines'));
  const divergences = computeDivergences(lines, 'return');
  for (const divergence of divergences) {
    if (divergence.delta >= 0) continue; // so falta/perda
    const loss = Math.abs(divergence.delta);
    const line = lines.find(
      (row) =>
        row.itemType === divergence.itemType &&
        normalizeColor(row.color).toLowerCase() ===
          normalizeColor(divergence.color).toLowerCase()
    );
    if (!line || !line.inventoryItemId) continue;
    try {
      const item = await new Parse.Query(MATERIAL_INVENTORY_CLASS).get(
        line.inventoryItemId,
        { useMasterKey: true }
      );
      const quantity = Math.max(0, Number(item.get('quantity') || 0));
      const damaged = Math.max(0, Number(item.get('damagedQuantity') || 0));
      item.set('quantity', Math.max(0, quantity - loss));
      item.set('damagedQuantity', Math.min(damaged, Math.max(0, quantity - loss)));
      await item.save(null, { useMasterKey: true });
    } catch {
      // Continua demais itens
    }
  }

  session.set('lossesApplied', true);
  session.set('status', 'reconciled');
  session.set('divergences', divergences);
  await session.save(null, { useMasterKey: true });
  return mapSession(session);
});

Parse.Cloud.define('configureMaterialClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  // Mutacoes passam por Cloud Functions (master key). Bloqueia escrita direta do cliente.
  const authRead = { requiresAuthentication: true };
  const denied = {};
  const schemaInventory = new Parse.Schema(MATERIAL_INVENTORY_CLASS);
  schemaInventory.setCLP({
    find: authRead,
    get: authRead,
    count: authRead,
    create: denied,
    update: denied,
    delete: denied,
    addField: denied,
    protectedFields: {},
  });
  try {
    await schemaInventory.update();
  } catch {
    await schemaInventory.save();
  }

  const schemaSession = new Parse.Schema(EVENT_MATERIAL_SESSION_CLASS);
  schemaSession.setCLP({
    find: authRead,
    get: authRead,
    count: authRead,
    create: denied,
    update: denied,
    delete: denied,
    addField: denied,
    protectedFields: {},
  });
  try {
    await schemaSession.update();
  } catch {
    await schemaSession.save();
  }

  return {
    ok: true,
    message: 'CLP atualizado para MaterialInventoryItem e EventMaterialSession.',
  };
});

// --- 14-support-roles.js ---

/** Ferramentas de dia de evento: torcedor, treinador, preparador fisico, massagista */

const FAN_CHECKIN_CLASS = 'FanEventCheckIn';
const COACH_BOARD_CLASS = 'CoachEventBoard';
const MASSEUR_TREATMENT_CLASS = 'MasseurTreatment';
const TRAINER_SESSION_CLASS = 'PhysicalTrainerSession';

const SUPPORT_ROLES = ['fan', 'coach', 'physical_trainer', 'masseur'];

const MASSEUR_PHASES = ['pre', 'halftime', 'post'];
const MASSEUR_RETURN_STATUSES = ['cleared', 'limited', 'out'];
const TRAINER_FOCUSES = ['endurance', 'explosion', 'mobility', 'recovery', 'general'];

function trimSupportText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function normalizeAttendanceMode(value) {
  const mode = String(value || '').trim();
  return mode === 'remote' ? 'remote' : 'presential';
}

async function loadSupportEvent(eventId) {
  const id = String(eventId || '').trim();
  if (!id) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'eventId obrigatorio.');
  }
  return new Parse.Query('Event').get(id, { useMasterKey: true });
}

async function loadSupportRegistration(user, event) {
  return new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
}

async function assertConfirmedSupportRole(user, eventId, role) {
  const event = await loadSupportEvent(eventId);
  const registration = await loadSupportRegistration(user, event);
  if (!registration) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Inscricao no evento obrigatoria.');
  }
  if (registration.get('role') !== role) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Perfil sem permissao para esta acao.');
  }
  const participationFee = Number(event.get('participationFee') || 0);
  if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao ainda nao confirmada.');
  }
  return { event, registration };
}

async function assertEventAdminOrSupportRole(user, eventId, role) {
  try {
    const event = await assertEventAdmin(user, eventId);
    return { event, registration: null, isAdmin: true };
  } catch {
    // segue para papel confirmado
  }
  const { event, registration } = await assertConfirmedSupportRole(user, eventId, role);
  return { event, registration, isAdmin: false };
}

function mapFanCheckIn(obj, user) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    userId: user ? user.id : obj.get('user') && obj.get('user').id ? obj.get('user').id : undefined,
    userName:
      (user && (user.get('apelido') || user.get('name') || user.getUsername())) ||
      obj.get('userName') ||
      'Torcedor',
    avatarUrl: user ? resolveStoredAvatarUrl(user, null) : obj.get('avatarUrl') || undefined,
    attendanceMode: normalizeAttendanceMode(obj.get('attendanceMode')),
    message: obj.get('message') || '',
    checkedInAt: obj.get('checkedInAt')
      ? obj.get('checkedInAt').toISOString()
      : obj.createdAt
        ? obj.createdAt.toISOString()
        : undefined,
  };
}

function mapCoachBoard(obj) {
  const checklist = obj.get('checklist') || {};
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    coachUserId: obj.get('coachUser') && obj.get('coachUser').id ? obj.get('coachUser').id : undefined,
    checklist: {
      talkedToTeam: !!checklist.talkedToTeam,
      ledWarmup: !!checklist.ledWarmup,
      lineupDefined: !!checklist.lineupDefined,
    },
    teamNotes: Array.isArray(obj.get('teamNotes')) ? obj.get('teamNotes') : [],
    suggestedStarters: Array.isArray(obj.get('suggestedStarters'))
      ? obj.get('suggestedStarters')
      : [],
    rotationNotes: obj.get('rotationNotes') || '',
    updatedAt: obj.updatedAt ? obj.updatedAt.toISOString() : undefined,
  };
}

function mapMasseurTreatment(obj) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    masseurUserId:
      obj.get('masseurUser') && obj.get('masseurUser').id ? obj.get('masseurUser').id : undefined,
    athleteUserId:
      obj.get('athleteUser') && obj.get('athleteUser').id ? obj.get('athleteUser').id : undefined,
    athleteName: obj.get('athleteName') || 'Atleta',
    phase: obj.get('phase') || 'pre',
    bodyRegion: obj.get('bodyRegion') || '',
    treatmentType: obj.get('treatmentType') || '',
    durationMin: Math.max(0, Number(obj.get('durationMin') || 0)),
    returnStatus: obj.get('returnStatus') || 'cleared',
    notes: obj.get('notes') || '',
    createdAt: obj.createdAt ? obj.createdAt.toISOString() : undefined,
  };
}

function mapTrainerSession(obj) {
  return {
    objectId: obj.id,
    eventId: obj.get('event') && obj.get('event').id ? obj.get('event').id : undefined,
    trainerUserId:
      obj.get('trainerUser') && obj.get('trainerUser').id ? obj.get('trainerUser').id : undefined,
    planFocus: obj.get('planFocus') || 'general',
    planDurationMin: Math.max(0, Number(obj.get('planDurationMin') || 0)),
    planNotes: obj.get('planNotes') || '',
    warmupStartedAt: obj.get('warmupStartedAt')
      ? obj.get('warmupStartedAt').toISOString()
      : undefined,
    warmupEndedAt: obj.get('warmupEndedAt') ? obj.get('warmupEndedAt').toISOString() : undefined,
    cooldownDone: !!obj.get('cooldownDone'),
    athleteUserIds: Array.isArray(obj.get('athleteUserIds')) ? obj.get('athleteUserIds') : [],
    updatedAt: obj.updatedAt ? obj.updatedAt.toISOString() : undefined,
  };
}

async function countConfirmedRoleEvents(userId, role) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regs = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .equalTo('role', role)
    .limit(500)
    .find({ useMasterKey: true });
  let confirmed = 0;
  for (const reg of regs) {
    const event = reg.get('event');
    if (!event) continue;
    try {
      await event.fetch({ useMasterKey: true });
    } catch {
      continue;
    }
    const fee = Number(event.get('participationFee') || 0);
    if (computeRegistrationEffectiveConfirmation(reg, fee)) confirmed += 1;
  }
  return { eventsCount: confirmed, registrationsCount: regs.length };
}

// --- Torcedor ---

Parse.Cloud.define('submitFanCheckIn', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, registration } = await assertConfirmedSupportRole(request.user, eventId, 'fan');
  const attendanceMode = normalizeAttendanceMode(
    request.params.attendanceMode || registration.get('attendanceMode')
  );
  const message = trimSupportText(request.params.message, 160);

  let row = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .equalTo('user', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(FAN_CHECKIN_CLASS);
    row.set('event', event);
    row.set('user', request.user);
  }
  row.set('attendanceMode', attendanceMode);
  row.set('message', message);
  row.set('userName', request.user.get('apelido') || request.user.get('name') || request.user.getUsername());
  row.set('avatarUrl', resolveStoredAvatarUrl(request.user, registration) || undefined);
  row.set('checkedInAt', new Date());
  await row.save(null, { useMasterKey: true });
  return mapFanCheckIn(row, request.user);
});

Parse.Cloud.define('getEventFanCheckIns', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  await assertEventAdminOrSupportRole(request.user, eventId, 'fan');
  const event = await loadSupportEvent(eventId);
  const rows = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .descending('checkedInAt')
    .limit(200)
    .find({ useMasterKey: true });
  return rows.map((row) => mapFanCheckIn(row, null));
});

Parse.Cloud.define('getMyFanCheckIn', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const event = await loadSupportEvent(eventId);
  const row = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .equalTo('user', request.user)
    .first({ useMasterKey: true });
  return row ? mapFanCheckIn(row, request.user) : null;
});

Parse.Cloud.define('getFanHighlightRankings', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const scope = String(request.params.scope || 'app').trim();
  const scopeId = String(request.params.scopeId || '').trim();
  const limit = Math.min(Math.max(Number(request.params.limit) || 10, 1), 50);

  let eventIds = null;
  if (scope === 'event') {
    if (!scopeId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scopeId obrigatorio.');
    }
    eventIds = [scopeId];
  } else if (scope === 'pelada') {
    if (!scopeId) {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'scopeId obrigatorio.');
    }
    const pelada = Parse.Object.extend('Pelada').createWithoutData(scopeId);
    const events = await new Parse.Query('Event')
      .equalTo('pelada', pelada)
      .select(['objectId'])
      .limit(500)
      .find({ useMasterKey: true });
    eventIds = events.map((e) => e.id);
  }

  const query = new Parse.Query(FAN_CHECKIN_CLASS).limit(1000);
  if (eventIds) {
    if (!eventIds.length) return [];
    const eventPtrs = eventIds.map((id) => Parse.Object.extend('Event').createWithoutData(id));
    query.containedIn('event', eventPtrs);
  }
  const rows = await query.find({ useMasterKey: true });
  const byUser = new Map();
  for (const row of rows) {
    const user = row.get('user');
    const userId = user && user.id ? user.id : '';
    if (!userId) continue;
    const current = byUser.get(userId) || {
      userId,
      userName: row.get('userName') || 'Torcedor',
      avatarUrl: row.get('avatarUrl') || undefined,
      checkIns: 0,
      presential: 0,
      remote: 0,
    };
    current.checkIns += 1;
    if (normalizeAttendanceMode(row.get('attendanceMode')) === 'remote') {
      current.remote += 1;
    } else {
      current.presential += 1;
    }
    byUser.set(userId, current);
  }

  return Array.from(byUser.values())
    .map((entry) => ({
      ...entry,
      engagementScore: entry.checkIns * 10 + entry.presential * 2,
    }))
    .sort((a, b) => b.engagementScore - a.engagementScore || b.checkIns - a.checkIns)
    .slice(0, limit);
});

Parse.Cloud.define('getFanEngagementSummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const checkIns = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('user', userPtr)
    .limit(1000)
    .find({ useMasterKey: true });
  let presential = 0;
  let remote = 0;
  for (const row of checkIns) {
    if (normalizeAttendanceMode(row.get('attendanceMode')) === 'remote') remote += 1;
    else presential += 1;
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'fan');
  return {
    role: 'fan',
    checkIns: checkIns.length,
    presentialCheckIns: presential,
    remoteCheckIns: remote,
    eventsCount: roleCounts.eventsCount,
    engagementScore: checkIns.length * 10 + presential * 2,
  };
});

// --- Treinador ---

Parse.Cloud.define('getCoachEventBoard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(request.user, eventId, 'coach');
  let query = new Parse.Query(COACH_BOARD_CLASS).equalTo('event', event);
  if (!isAdmin) {
    query = query.equalTo('coachUser', request.user);
  }
  const row = await query.descending('updatedAt').first({ useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    return row ? mapCoachBoard(row) : null;
  }
  const ctx = await resolveCoachTeamMatchContext(event, request.user);
  const base = row
    ? mapCoachBoard(row)
    : {
        objectId: '',
        eventId: event.id,
        checklist: { talkedToTeam: false, ledWarmup: false, lineupDefined: false },
        teamNotes: [],
        suggestedStarters: [],
        rotationNotes: '',
      };
  return {
    ...base,
    isTeamMatch: true,
    coachSides: ctx.coachSides,
    homeTeamName: ctx.homeTeamName,
    awayTeamName: ctx.awayTeamName,
  };
});

async function resolveCoachTeamMatchContext(event, user) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });
  const homeTeam = event.get('homeTeam');
  const awayTeam = event.get('awayTeam');
  const coachSides = await resolveCoachManageSidesForTeamMatch(event, user);
  return {
    coachSides,
    homeTeamName:
      event.get('homeTeamName') || (homeTeam && homeTeam.get ? homeTeam.get('name') : '') || 'Mandante',
    awayTeamName:
      event.get('awayTeamName') || (awayTeam && awayTeam.get ? awayTeam.get('name') : '') || 'Visitante',
  };
}

Parse.Cloud.define('saveCoachEventBoard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'coach');
  const checklistIn = request.params.checklist || {};
  let teamNotes = Array.isArray(request.params.teamNotes)
    ? request.params.teamNotes.map((note) => ({
        teamIndex: Math.max(0, Number(note.teamIndex) || 0),
        teamName: trimSupportText(note.teamName, 40),
        formation: trimSupportText(note.formation, 40),
        focus: trimSupportText(note.focus, 120),
      }))
    : [];
  let suggestedStarters = Array.isArray(request.params.suggestedStarters)
    ? request.params.suggestedStarters.map((line) => ({
        teamIndex: Math.max(0, Number(line.teamIndex) || 0),
        userIds: Array.isArray(line.userIds)
          ? line.userIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 20)
          : [],
      }))
    : [];

  let row = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('event', event)
    .equalTo('coachUser', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(COACH_BOARD_CLASS);
    row.set('event', event);
    row.set('coachUser', request.user);
  }
  let teamMatchCtx = null;
  if (event.get('type') === 'team_match') {
    const ctx = await resolveCoachTeamMatchContext(event, request.user);
    teamMatchCtx = ctx;
    const allowed = new Set(
      ctx.coachSides.map((side) => (side === 'away' ? 1 : side === 'home' ? 0 : -1))
    );
    if (!allowed.size) {
      throw new Parse.Error(
        Parse.Error.OPERATION_FORBIDDEN,
        'Voce nao esta vinculado a nenhum dos times deste confronto.'
      );
    }
    const names = [ctx.homeTeamName, ctx.awayTeamName];
    const prevNotes = Array.isArray(row.get('teamNotes')) ? row.get('teamNotes') : [];
    const prevStarters = Array.isArray(row.get('suggestedStarters'))
      ? row.get('suggestedStarters')
      : [];
    const mergedNotes = [];
    const mergedStarters = [];
    for (const idx of [0, 1]) {
      const source = allowed.has(idx) ? teamNotes : prevNotes;
      const note = source.find((n) => Number(n && n.teamIndex) === idx);
      if (note) mergedNotes.push({ ...note, teamIndex: idx, teamName: names[idx] });
      const starterSource = allowed.has(idx) ? suggestedStarters : prevStarters;
      const line = starterSource.find((l) => Number(l && l.teamIndex) === idx);
      if (line) mergedStarters.push({ ...line, teamIndex: idx });
    }
    teamNotes = mergedNotes;
    suggestedStarters = mergedStarters;
  }
  row.set('checklist', {
    talkedToTeam: !!checklistIn.talkedToTeam,
    ledWarmup: !!checklistIn.ledWarmup,
    lineupDefined: !!checklistIn.lineupDefined,
  });
  row.set('teamNotes', teamNotes);
  row.set('suggestedStarters', suggestedStarters);
  row.set('rotationNotes', trimSupportText(request.params.rotationNotes, 400));
  await row.save(null, { useMasterKey: true });
  if (teamMatchCtx) {
    return {
      ...mapCoachBoard(row),
      isTeamMatch: true,
      coachSides: teamMatchCtx.coachSides,
      homeTeamName: teamMatchCtx.homeTeamName,
      awayTeamName: teamMatchCtx.awayTeamName,
    };
  }
  return mapCoachBoard(row);
});

Parse.Cloud.define('getCoachProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const boards = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('coachUser', userPtr)
    .limit(500)
    .find({ useMasterKey: true });
  let checklistComplete = 0;
  for (const board of boards) {
    const checklist = board.get('checklist') || {};
    if (checklist.talkedToTeam && checklist.ledWarmup && checklist.lineupDefined) {
      checklistComplete += 1;
    }
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'coach');
  return {
    role: 'coach',
    eventsCount: roleCounts.eventsCount,
    boardsSaved: boards.length,
    checklistCompleteCount: checklistComplete,
  };
});

// --- Massagista ---

Parse.Cloud.define('listMasseurTreatments', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(request.user, eventId, 'masseur');
  let query = new Parse.Query(MASSEUR_TREATMENT_CLASS).equalTo('event', event).descending('createdAt');
  if (!isAdmin) {
    query = query.equalTo('masseurUser', request.user);
  }
  const rows = await query.limit(200).find({ useMasterKey: true });
  return rows.map(mapMasseurTreatment);
});

Parse.Cloud.define('upsertMasseurTreatment', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'masseur');
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  if (!athleteUserId) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'athleteUserId obrigatorio.');
  }
  const phase = String(request.params.phase || 'pre').trim();
  if (!MASSEUR_PHASES.includes(phase)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Fase de atendimento invalida.');
  }
  const returnStatus = String(request.params.returnStatus || 'cleared').trim();
  if (!MASSEUR_RETURN_STATUSES.includes(returnStatus)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Status de retorno invalido.');
  }

  const athletePtr = Parse.User.createWithoutData(athleteUserId);
  let athleteName = 'Atleta';
  try {
    const athlete = await new Parse.Query(Parse.User).get(athleteUserId, { useMasterKey: true });
    athleteName = athlete.get('apelido') || athlete.get('name') || athlete.getUsername() || athleteName;
  } catch {
    // mantem default
  }

  const objectId = String(request.params.objectId || '').trim();
  let row = null;
  if (objectId) {
    row = await new Parse.Query(MASSEUR_TREATMENT_CLASS).get(objectId, { useMasterKey: true });
    if (!row.get('masseurUser') || row.get('masseurUser').id !== request.user.id) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Atendimento de outro massagista.');
    }
  } else {
    row = new Parse.Object(MASSEUR_TREATMENT_CLASS);
    row.set('event', event);
    row.set('masseurUser', request.user);
  }
  row.set('athleteUser', athletePtr);
  row.set('athleteName', athleteName);
  row.set('phase', phase);
  row.set('bodyRegion', trimSupportText(request.params.bodyRegion, 60));
  row.set('treatmentType', trimSupportText(request.params.treatmentType, 60));
  row.set('durationMin', Math.max(0, Math.min(180, Number(request.params.durationMin) || 0)));
  row.set('returnStatus', returnStatus);
  row.set('notes', trimSupportText(request.params.notes, 200));
  await row.save(null, { useMasterKey: true });
  return mapMasseurTreatment(row);
});

Parse.Cloud.define('getEventMasseurAlerts', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  await assertEventAdminOrSupportRole(request.user, eventId, 'masseur');
  const event = await loadSupportEvent(eventId);
  const rows = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('event', event)
    .containedIn('returnStatus', ['limited', 'out'])
    .descending('createdAt')
    .limit(50)
    .find({ useMasterKey: true });
  return rows.map(mapMasseurTreatment);
});

Parse.Cloud.define('getMasseurProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const treatments = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('masseurUser', userPtr)
    .limit(1000)
    .find({ useMasterKey: true });
  const athletes = new Set();
  let totalDuration = 0;
  let limitedOrOut = 0;
  for (const row of treatments) {
    const athlete = row.get('athleteUser');
    if (athlete && athlete.id) athletes.add(athlete.id);
    totalDuration += Math.max(0, Number(row.get('durationMin') || 0));
    if (['limited', 'out'].includes(row.get('returnStatus'))) limitedOrOut += 1;
  }
  const roleCounts = await countConfirmedRoleEvents(userId, 'masseur');
  return {
    role: 'masseur',
    eventsCount: roleCounts.eventsCount,
    treatmentsCount: treatments.length,
    uniqueAthletes: athletes.size,
    avgDurationMin:
      treatments.length > 0 ? Math.round((totalDuration / treatments.length) * 10) / 10 : 0,
    limitedOrOutCount: limitedOrOut,
  };
});

// --- Preparador fisico ---

Parse.Cloud.define('getPhysicalTrainerSession', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event, isAdmin } = await assertEventAdminOrSupportRole(
    request.user,
    eventId,
    'physical_trainer'
  );
  let query = new Parse.Query(TRAINER_SESSION_CLASS).equalTo('event', event);
  if (!isAdmin) {
    query = query.equalTo('trainerUser', request.user);
  }
  const row = await query.descending('updatedAt').first({ useMasterKey: true });
  return row ? mapTrainerSession(row) : null;
});

Parse.Cloud.define('savePhysicalTrainerSession', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const { event } = await assertConfirmedSupportRole(request.user, eventId, 'physical_trainer');
  const startTime = event.get('startTime');
  if (startTime instanceof Date && !Number.isNaN(startTime.getTime()) && new Date() >= startTime) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'A preparacao fisica so pode ser registrada antes do inicio do evento.'
    );
  }
  const planFocus = String(request.params.planFocus || 'general').trim();
  if (!TRAINER_FOCUSES.includes(planFocus)) {
    throw new Parse.Error(Parse.Error.INVALID_QUERY, 'Foco do plano invalido.');
  }
  const athleteUserIds = Array.isArray(request.params.athleteUserIds)
    ? request.params.athleteUserIds.map((id) => String(id || '').trim()).filter(Boolean).slice(0, 40)
    : [];

  let row = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('event', event)
    .equalTo('trainerUser', request.user)
    .first({ useMasterKey: true });
  if (!row) {
    row = new Parse.Object(TRAINER_SESSION_CLASS);
    row.set('event', event);
    row.set('trainerUser', request.user);
  }
  row.set('planFocus', planFocus);
  row.set('planDurationMin', Math.max(0, Math.min(180, Number(request.params.planDurationMin) || 0)));
  row.set('planNotes', trimSupportText(request.params.planNotes, 400));
  row.set('athleteUserIds', athleteUserIds);
  row.set('cooldownDone', !!request.params.cooldownDone);
  if (request.params.warmupStarted === true && !row.get('warmupStartedAt')) {
    row.set('warmupStartedAt', new Date());
  }
  if (request.params.warmupEnded === true) {
    row.set('warmupEndedAt', new Date());
  }
  if (request.params.clearWarmup === true) {
    row.unset('warmupStartedAt');
    row.unset('warmupEndedAt');
  }
  await row.save(null, { useMasterKey: true });
  return mapTrainerSession(row);
});

Parse.Cloud.define('getPhysicalTrainerProfileStats', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id).trim();
  const userPtr = Parse.User.createWithoutData(userId);
  const sessions = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('trainerUser', userPtr)
    .limit(500)
    .find({ useMasterKey: true });
  const athletes = new Set();
  let warmupsCompleted = 0;
  for (const session of sessions) {
    const ids = Array.isArray(session.get('athleteUserIds')) ? session.get('athleteUserIds') : [];
    ids.forEach((id) => athletes.add(id));
    if (session.get('warmupStartedAt') && session.get('warmupEndedAt')) warmupsCompleted += 1;
  }
  const personalAthletes = await new Parse.Query('AthleteProfile')
    .equalTo('personalTrainerUserId', userId)
    .limit(200)
    .find({ useMasterKey: true });
  const roleCounts = await countConfirmedRoleEvents(userId, 'physical_trainer');
  return {
    role: 'physical_trainer',
    eventsCount: roleCounts.eventsCount,
    sessionsCount: sessions.length,
    warmupsCompleted,
    athletesCoachedInEvents: athletes.size,
    personalAthletesCount: personalAthletes.length,
  };
});

Parse.Cloud.define('getEventSupportOpsSnapshot', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  let event;
  try {
    event = await assertEventAdmin(request.user, eventId);
  } catch {
    event = await loadSupportEvent(eventId);
    const registration = await loadSupportRegistration(request.user, event);
    const fee = Number(event.get('participationFee') || 0);
    // qualquer participante confirmado pode ver o resumo no mural
    if (!registration || !computeRegistrationEffectiveConfirmation(registration, fee)) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Participacao nao confirmada.');
    }
  }

  const coachBoard = await new Parse.Query(COACH_BOARD_CLASS)
    .equalTo('event', event)
    .descending('updatedAt')
    .first({ useMasterKey: true });
  const trainerSession = await new Parse.Query(TRAINER_SESSION_CLASS)
    .equalTo('event', event)
    .descending('updatedAt')
    .first({ useMasterKey: true });
  const treatments = await new Parse.Query(MASSEUR_TREATMENT_CLASS)
    .equalTo('event', event)
    .limit(200)
    .find({ useMasterKey: true });
  const fanCheckIns = await new Parse.Query(FAN_CHECKIN_CLASS)
    .equalTo('event', event)
    .limit(500)
    .find({ useMasterKey: true });
  const alerts = treatments.filter((row) => ['limited', 'out'].includes(row.get('returnStatus')));

  return {
    eventId,
    coach: coachBoard
      ? {
          checklist: mapCoachBoard(coachBoard).checklist,
          hasBoard: true,
        }
      : { hasBoard: false, checklist: null },
    trainer: trainerSession
      ? {
          hasSession: true,
          planFocus: trainerSession.get('planFocus') || 'general',
          athleteCount: Array.isArray(trainerSession.get('athleteUserIds'))
            ? trainerSession.get('athleteUserIds').length
            : 0,
          warmupActive: !!(
            trainerSession.get('warmupStartedAt') && !trainerSession.get('warmupEndedAt')
          ),
          warmupDone: !!(
            trainerSession.get('warmupStartedAt') && trainerSession.get('warmupEndedAt')
          ),
          cooldownDone: !!trainerSession.get('cooldownDone'),
        }
      : { hasSession: false },
    masseur: {
      treatmentsCount: treatments.length,
      alertsCount: alerts.length,
      alerts: alerts.slice(0, 5).map(mapMasseurTreatment),
    },
    fan: {
      checkIns: fanCheckIns.length,
      presential: fanCheckIns.filter(
        (row) => normalizeAttendanceMode(row.get('attendanceMode')) === 'presential'
      ).length,
      remote: fanCheckIns.filter(
        (row) => normalizeAttendanceMode(row.get('attendanceMode')) === 'remote'
      ).length,
    },
  };
});

Parse.Cloud.define('configureSupportRolesClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const denied = {};
  const classes = [
    FAN_CHECKIN_CLASS,
    COACH_BOARD_CLASS,
    MASSEUR_TREATMENT_CLASS,
    TRAINER_SESSION_CLASS,
  ];

  for (const className of classes) {
    const schema = new Parse.Schema(className);
    schema.setCLP({
      find: authRead,
      get: authRead,
      count: authRead,
      create: denied,
      update: denied,
      delete: denied,
      addField: denied,
      protectedFields: {},
    });
    try {
      await schema.update();
    } catch {
      await schema.save();
    }
  }

  return {
    ok: true,
    message:
      'CLP atualizado para FanEventCheckIn, CoachEventBoard, MasseurTreatment e PhysicalTrainerSession.',
  };
});

// --- 15-amateur-teams.js ---

/** Elenco de AmateurTeam + perfil publico do time */
const MEMBERSHIP_CLASS = 'AmateurTeamMembership';

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

function computeAverageAge(ages) {
  const valid = ages.filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, n) => sum + n, 0) / valid.length) * 10) / 10;
}

async function assertTeamPresident(teamId, user) {
  const team = await new Parse.Query('AmateurTeam').include('president').get(teamId, {
    useMasterKey: true,
  });
  const president = team.get('president');
  if (!president || president.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente do time pode gerenciar o elenco.');
  }
  return team;
}

async function mapMembershipRow(row) {
  const user = row.get('user');
  const legend = row.get('legendAthlete');
  let apelido = String(row.get('apelido') || '').trim();
  let avatarUrl = row.get('avatarUrl') || undefined;
  let position = String(row.get('position') || '').trim() || undefined;
  let birthDate = row.get('birthDate') || null;
  let age = ageFromBirthDate(birthDate);

  if (user && user.id) {
    try {
      const full = await new Parse.Query(Parse.User).get(user.id, { useMasterKey: true });
      if (!apelido) {
        apelido =
          String(full.get('apelido') || '').trim() ||
          String(full.get('name') || '').trim() ||
          full.getUsername() ||
          'Atleta';
      }
      if (!birthDate && full.get('birthDate')) birthDate = full.get('birthDate');
      age = ageFromBirthDate(birthDate);
      const avatar = full.get('avatar');
      if (!avatarUrl && avatar && avatar.url) avatarUrl = avatar.url();
      if (!position) {
        const profile = await new Parse.Query('AthleteProfile')
          .equalTo('user', full)
          .first({ useMasterKey: true });
        if (profile) position = String(profile.get('primaryPosition') || '').trim() || undefined;
      }
    } catch {
      // mantem denormalizado
    }
  } else if (legend && legend.id) {
    try {
      const full = await new Parse.Query('AmateurLegendAthlete').get(legend.id, { useMasterKey: true });
      if (!apelido) apelido = String(full.get('apelido') || full.get('name') || 'Lenda').trim();
      if (!position) position = String(full.get('primaryPosition') || '').trim() || undefined;
      if (!birthDate && full.get('birthDate')) birthDate = full.get('birthDate');
      age = ageFromBirthDate(birthDate);
      const photo = full.get('photo') || full.get('image');
      if (!avatarUrl && photo && photo.url) avatarUrl = photo.url();
    } catch {
      // mantem denormalizado
    }
  }

  return {
    objectId: row.id,
    teamId: row.get('team') && row.get('team').id ? row.get('team').id : '',
    userId: user && user.id ? user.id : undefined,
    legendAthleteId: legend && legend.id ? legend.id : undefined,
    source: row.get('source') === 'legend' ? 'legend' : 'athlete',
    apelido: apelido || 'Atleta',
    avatarUrl,
    position,
    age,
    birthDate: birthDate ? new Date(birthDate).toISOString() : null,
  };
}

async function loadRosterAges(teamId) {
  const rows = await new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', Parse.Object.extend('AmateurTeam').createWithoutData(teamId))
    .equalTo('active', true)
    .limit(200)
    .find({ useMasterKey: true });
  const ages = [];
  const members = [];
  for (const row of rows) {
    const mapped = await mapMembershipRow(row);
    members.push(mapped);
    if (typeof mapped.age === 'number') ages.push(mapped.age);
  }
  return { count: rows.length, averageAge: computeAverageAge(ages), members };
}

function personDisplayFromUser(user) {
  if (!user) return { name: '', avatarUrl: '' };
  const name = String(user.get('apelido') || user.get('name') || user.getUsername() || '').trim();
  let avatarUrl = String(user.get('avatarUrl') || '').trim();
  const avatar = user.get('avatar');
  if (!avatarUrl && avatar && typeof avatar.url === 'function') avatarUrl = avatar.url();
  return { name, avatarUrl };
}

function personWinRatePercent(wins, draws, losses) {
  const played = wins + draws + losses;
  if (!played) return null;
  return Math.round(((wins * 3 + draws) / (played * 3)) * 1000) / 10;
}

function unbeatenDurationLabel(fromDate, now) {
  const days = Math.max(0, Math.floor((now.getTime() - fromDate.getTime()) / 86400000));
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years + (years === 1 ? ' ano' : ' anos');
  }
  if (days >= 14) {
    const weeks = Math.floor(days / 7);
    return weeks + (weeks === 1 ? ' semana' : ' semanas');
  }
  return days + (days === 1 ? ' dia' : ' dias');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function countFansOfTeamName(teamName) {
  const name = String(teamName || '').trim();
  if (!name) return 0;
  const query = new Parse.Query(Parse.User);
  query.matches('favoriteAmateurTeam', '^\\s*' + escapeRegExp(name) + '\\s*$', 'i');
  return query.count({ useMasterKey: true });
}

async function loadCountedTeamMatches(teamId, limit) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const capped = Math.min(Math.max(Number(limit) || 1, 1), 200);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(capped)
    .find({ useMasterKey: true });
  const matches = [];
  for (const event of events) {
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const homeScore = Number(actual.homeScore || 0);
    const awayScore = Number(actual.awayScore || 0);
    const teamScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    matches.push({
      event,
      result: teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D',
      teamSide: isHome ? 'home' : 'away',
      startTime: event.get('startTime') || null,
      homeTeamName: event.get('homeTeamName') || '',
      awayTeamName: event.get('awayTeamName') || '',
      homeScore,
      awayScore,
    });
  }
  return matches;
}

function buildUnbeatenSummary(matches, now) {
  if (!matches.length) return { unbeatenFor: null, lastDefeat: null };
  const streak = [];
  let lastDefeat = null;
  for (const match of matches) {
    if (match.result === 'L') {
      lastDefeat = match;
      break;
    }
    streak.push(match);
  }
  const unbeatenFor = streak.length
    ? unbeatenDurationLabel(new Date(streak[streak.length - 1].startTime || now), now)
    : '0 dias';
  return {
    unbeatenFor,
    lastDefeat: lastDefeat
      ? {
          startTime: lastDefeat.startTime ? new Date(lastDefeat.startTime).toISOString() : null,
          homeTeamName: lastDefeat.homeTeamName,
          awayTeamName: lastDefeat.awayTeamName,
          homeScore: lastDefeat.homeScore,
          awayScore: lastDefeat.awayScore,
        }
      : null,
  };
}

function bumpPersonRecord(bucket, user, result) {
  if (!user || !user.id) return;
  const current = bucket.get(user.id) || {
    userId: user.id,
    name: '',
    avatarUrl: '',
    wins: 0,
    draws: 0,
    losses: 0,
  };
  const display = personDisplayFromUser(user);
  if (!current.name && display.name) current.name = display.name;
  if (!current.avatarUrl && display.avatarUrl) current.avatarUrl = display.avatarUrl;
  if (result === 'W') current.wins += 1;
  else if (result === 'L') current.losses += 1;
  else current.draws += 1;
  bucket.set(user.id, current);
}

function toPublicPerson(row) {
  const played = row.wins + row.draws + row.losses;
  return {
    userId: row.userId,
    name: row.name || 'Atleta',
    avatarUrl: row.avatarUrl || '',
    matchesPlayed: played,
    winRatePercent: played ? personWinRatePercent(row.wins, row.draws, row.losses) : null,
  };
}

async function collectTeamPeopleRecords(matches) {
  const athletes = new Map();
  const coaches = new Map();
  for (const match of matches) {
    const regs = await new Parse.Query('EventRegistration')
      .equalTo('event', match.event)
      .equalTo('teamSide', match.teamSide)
      .containedIn('role', ['athlete', 'coach'])
      .include('user')
      .limit(150)
      .find({ useMasterKey: true });
    for (const reg of regs) {
      const bucket = reg.get('role') === 'coach' ? coaches : athletes;
      bumpPersonRecord(bucket, reg.get('user'), match.result);
    }
  }
  return { athletes, coaches };
}

Parse.Cloud.define('listTeamRoster', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const rows = await new Parse.Query(MEMBERSHIP_CLASS)
    .equalTo('team', teamPtr)
    .equalTo('active', true)
    .ascending('apelido')
    .limit(200)
    .find({ useMasterKey: true });
  const mapped = [];
  for (const row of rows) {
    mapped.push(await mapMembershipRow(row));
  }
  return mapped;
});

Parse.Cloud.define('addTeamMember', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  const legendAthleteId = String(request.params.legendAthleteId || '').trim();
  if (!teamId || (!athleteUserId && !legendAthleteId)) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time e o atleta ou lenda.');
  }
  await assertTeamPresident(teamId, user);

  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const existingQ = new Parse.Query(MEMBERSHIP_CLASS).equalTo('team', teamPtr).equalTo('active', true);
  if (athleteUserId) {
    existingQ.equalTo('user', Parse.User.createWithoutData(athleteUserId));
  } else {
    existingQ.equalTo(
      'legendAthlete',
      Parse.Object.extend('AmateurLegendAthlete').createWithoutData(legendAthleteId)
    );
  }
  const already = await existingQ.first({ useMasterKey: true });
  if (already) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Este atleta ja esta no elenco.');
  }

  const membership = new Parse.Object(MEMBERSHIP_CLASS);
  membership.set('team', teamPtr);
  membership.set('active', true);
  membership.set('addedBy', user);
  if (athleteUserId) {
    membership.set('user', Parse.User.createWithoutData(athleteUserId));
    membership.set('source', 'athlete');
  } else {
    membership.set(
      'legendAthlete',
      Parse.Object.extend('AmateurLegendAthlete').createWithoutData(legendAthleteId)
    );
    membership.set('source', 'legend');
  }
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(true);
  acl.setWriteAccess(user.id, true);
  membership.setACL(acl);
  await membership.save(null, { useMasterKey: true });
  return mapMembershipRow(membership);
});

Parse.Cloud.define('removeTeamMember', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const membershipId = String(request.params.membershipId || '').trim();
  if (!membershipId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o membro do elenco.');
  }
  const row = await new Parse.Query(MEMBERSHIP_CLASS).include('team').get(membershipId, {
    useMasterKey: true,
  });
  const team = row.get('team');
  if (!team || !team.id) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Time nao encontrado.');
  }
  await assertTeamPresident(team.id, user);
  row.set('active', false);
  await row.save(null, { useMasterKey: true });
  return { ok: true };
});

function mapAmateurTeamListRow(team) {
  const teamImage = team.get('teamImage');
  const shieldImage = team.get('shieldImage');
  const president = team.get('president');
  return {
    objectId: team.id,
    name: team.get('name') || '',
    presidentId: president && president.id ? president.id : '',
    imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
    shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
    uniformId: team.get('uniformId') || '',
    homeVenue: team.get('homeVenue') || '',
    foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
  };
}

Parse.Cloud.define('listMyAmateurTeams', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const rows = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .ascending('name')
    .limit(5)
    .find({ useMasterKey: true });
  return rows.map(mapAmateurTeamListRow);
});

/**
 * Mesma regra de eventCountsForTeamMatchRanking (17): encerrado OU ja iniciado com placar pronto.
 * Retorna o placar quando o confronto conta; null caso contrario.
 */
async function loadCountedTeamMatchScore(event) {
  const finished = !!event.get('isFinished');
  const start = event.get('startTime');
  if (!finished && (!start || start > new Date())) return null;
  let actual = null;
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      actual = await buildEventActualPredictionResults(event);
    }
  } catch (error) {
    console.warn('loadCountedTeamMatchScore failed', event.id, error);
  }
  if (!finished && (!actual || !actual.ready)) return null;
  return actual || { homeScore: 0, awayScore: 0, goalScorers: [] };
}

async function loadTeamMatchHistoryRows(teamId, limit = 10) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const capped = Math.min(Math.max(Number(limit) || 10, 1), 40);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(Math.min(capped * 3, 120))
    .find({ useMasterKey: true });

  const lastResults = [];
  for (const event of events) {
    if (lastResults.length >= capped) break;
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
    lastResults.push({
      eventId: event.id,
      name: event.get('name') || '',
      startTime: event.get('startTime') ? event.get('startTime').toISOString() : null,
      homeTeamName: event.get('homeTeamName') || '',
      awayTeamName: event.get('awayTeamName') || '',
      homeScore: Number(actual.homeScore || 0),
      awayScore: Number(actual.awayScore || 0),
      isFinished: !!event.get('isFinished'),
      result,
    });
  }
  return lastResults;
}

Parse.Cloud.define('listAmateurTeamMatchHistory', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  const limit = Number(request.params.limit || 8);
  return loadTeamMatchHistoryRows(teamId, limit);
});

Parse.Cloud.define('getAmateurTeamPublicProfile', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }

  const team = await new Parse.Query('AmateurTeam').include('president').get(teamId, {
    useMasterKey: true,
  });
  const roster = await loadRosterAges(teamId);

  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const events = await Parse.Query.or(homeQ, awayQ)
    .lessThanOrEqualTo('startTime', new Date())
    .descending('startTime')
    .limit(40)
    .find({ useMasterKey: true });

  let wins = 0;
  let losses = 0;
  let draws = 0;
  const scorerMap = new Map();
  const pointsMap = new Map();
  let yellowCards = 0;
  let redCards = 0;
  const observations = [];

  for (const event of events) {
    const actual = await loadCountedTeamMatchScore(event);
    if (!actual) continue;
    const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
    const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    const result = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
    if (result === 'W') wins += 1;
    else if (result === 'L') losses += 1;
    else draws += 1;

    const perfs = await new Parse.Query('EventPerformance')
      .equalTo('event', event)
      .include('user')
      .limit(200)
      .find({ useMasterKey: true });
    for (const perf of perfs) {
      const reg = await new Parse.Query('EventRegistration')
        .equalTo('event', event)
        .equalTo('user', perf.get('user'))
        .first({ useMasterKey: true });
      const side = reg ? reg.get('teamSide') : null;
      if (side && ((isHome && side !== 'home') || (!isHome && side !== 'away'))) continue;

      const uid = perf.get('user') && perf.get('user').id ? perf.get('user').id : '';
      if (!uid) continue;
      const goals = Number(perf.get('goals') || perf.get('refereeGoals') || 0);
      const points = Number(perf.get('points') || perf.get('score') || 0);
      yellowCards += Math.max(
        Number(perf.get('yellowCards') || 0),
        Number(perf.get('refereeYellowCards') || 0)
      );
      redCards += Math.max(Number(perf.get('redCards') || 0), Number(perf.get('refereeRedCards') || 0));
      const obs = String(perf.get('refereeObservation') || '').trim();
      if (obs && observations.length < 20) {
        observations.push({
          eventId: event.id,
          eventName: event.get('name') || '',
          text: obs,
        });
      }
      if (goals > 0) {
        const prev = scorerMap.get(uid) || { userId: uid, goals: 0, name: '' };
        prev.goals += goals;
        const u = perf.get('user');
        prev.name =
          (u && (u.get('apelido') || u.get('name') || u.getUsername())) || prev.name || 'Atleta';
        scorerMap.set(uid, prev);
      }
      if (points > 0) {
        const prev = pointsMap.get(uid) || { userId: uid, points: 0, name: '' };
        prev.points += points;
        const u = perf.get('user');
        prev.name =
          (u && (u.get('apelido') || u.get('name') || u.getUsername())) || prev.name || 'Atleta';
        pointsMap.set(uid, prev);
      }
    }
  }

  const lastResults = await loadTeamMatchHistoryRows(teamId, 5);
  const countedMatches = await loadCountedTeamMatches(teamId, 200);
  const unbeaten = buildUnbeatenSummary(countedMatches, new Date());
  const people = await collectTeamPeopleRecords(countedMatches);
  const fanCount = await countFansOfTeamName(team.get('name'));
  const athletes = (roster.members || []).map((member) => {
    const record = member.userId ? people.athletes.get(member.userId) : null;
    const person = record ? toPublicPerson(record) : null;
    return {
      userId: member.userId || '',
      name: member.apelido || 'Atleta',
      avatarUrl: member.avatarUrl || '',
      matchesPlayed: person ? person.matchesPlayed : 0,
      winRatePercent: person ? person.winRatePercent : null,
    };
  });
  const coaches = Array.from(people.coaches.values())
    .map(toPublicPerson)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));

  const topScorer = Array.from(scorerMap.values()).sort((a, b) => b.goals - a.goals)[0] || null;
  const topPoints = Array.from(pointsMap.values()).sort((a, b) => b.points - a.points)[0] || null;
  const teamImage = team.get('teamImage');
  const shieldImage = team.get('shieldImage');
  const president = team.get('president');

  return {
    objectId: team.id,
    name: team.get('name') || '',
    description: team.get('description') || '',
    foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
    homeVenue: team.get('homeVenue') || '',
    imageUrl: teamImage && teamImage.url ? teamImage.url() : undefined,
    shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
    presidentId: president && president.id ? president.id : '',
    presidentName: personDisplayFromUser(president).name,
    presidentAvatarUrl: personDisplayFromUser(president).avatarUrl,
    fanCount,
    unbeatenFor: unbeaten.unbeatenFor,
    lastDefeat: unbeaten.lastDefeat,
    athletes,
    coaches,
    averageAge: roster.averageAge,
    rosterCount: roster.count,
    wins,
    losses,
    draws,
    matchesPlayed: wins + losses + draws,
    winRatePercent:
      wins + losses + draws > 0
        ? Math.round(((wins * 3 + draws) / ((wins + losses + draws) * 3)) * 1000) / 10
        : 0,
    lastResults,
    topScorer,
    topPointsAthlete: topPoints,
    yellowCards,
    redCards,
    observations: observations.slice(0, 10),
  };
});

/** Enrich listAmateurTeamsForLegend rows — called from patched list below if needed. */
async function amateurTeamAverageAge(teamId) {
  const { averageAge } = await loadRosterAges(teamId);
  return averageAge;
}

/** Publico de push para confronto: elenco ativo, presidentes, confirmados e contratados aceitos. */
async function collectTeamMatchNotifyUserIds(event) {
  const userIds = new Set();
  const add = (id) => {
    const value = String(id || '').trim();
    if (value) userIds.add(value);
  };

  let homeTeam = event.get('homeTeam');
  let awayTeam = event.get('awayTeam');
  const teamIds = [];

  async function resolveTeam(teamPtr) {
    if (!teamPtr || !teamPtr.id) return null;
    if (teamPtr.get && teamPtr.get('president')) return teamPtr;
    try {
      return await new Parse.Query('AmateurTeam').include('president').get(teamPtr.id, {
        useMasterKey: true,
      });
    } catch {
      return null;
    }
  }

  homeTeam = await resolveTeam(homeTeam);
  awayTeam = await resolveTeam(awayTeam);

  for (const team of [homeTeam, awayTeam]) {
    if (!team || !team.id) continue;
    teamIds.push(team.id);
    const president = team.get('president');
    add(president && president.id);
  }

  for (const teamId of teamIds) {
    const memberships = await new Parse.Query(MEMBERSHIP_CLASS)
      .equalTo('team', Parse.Object.extend('AmateurTeam').createWithoutData(teamId))
      .equalTo('active', true)
      .include('user')
      .limit(200)
      .find({ useMasterKey: true });
    for (const membership of memberships) {
      const memberUser = membership.get('user');
      if (memberUser && memberUser.id) add(memberUser.id);
    }
  }

  if (typeof computeRegistrationEffectiveConfirmation === 'function') {
    const participationFee = Number(event.get('participationFee') || 0);
    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .limit(1000)
      .find({ useMasterKey: true });
    for (const registration of registrations) {
      if (!computeRegistrationEffectiveConfirmation(registration, participationFee)) continue;
      const direct = registration.get('participantUserId');
      const regUser = registration.get('user');
      add(direct || (regUser && regUser.id));
    }
  }

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('status', 'accepted')
    .limit(300)
    .find({ useMasterKey: true });
  for (const invitation of invitations) {
    const invited = invitation.get('invitedUser');
    add(invited && invited.id);
  }

  return [...userIds];
}

// --- 16-match-challenge.js ---

/** Desafio entre times (MatchChallenge) + resumo do dia do confronto */

function isoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchChallengeReturnEnd(returnStart, proposedStart, proposedEnd) {
  const startMs = proposedStart ? new Date(proposedStart).getTime() : NaN;
  const endMs = proposedEnd ? new Date(proposedEnd).getTime() : NaN;
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? endMs - startMs
      : 2 * 60 * 60 * 1000;
  return new Date(returnStart.getTime() + durationMs);
}

function mapMatchChallengeRow(row) {
  const challengerTeam = row.get('challengerTeam');
  const challengedTeam = row.get('challengedTeam');
  const proposedStart = row.get('proposedStartTime');
  const proposedEnd = row.get('proposedEndTime');
  return {
    objectId: row.id,
    status: row.get('status') || 'pending',
    message: row.get('message') || '',
    challengeConditions: row.get('challengeConditions') || '',
    returnChallengeConditions: row.get('returnChallengeConditions') || '',
    hasReturnLeg: !!row.get('hasReturnLeg'),
    returnStartTime: isoOrNull(row.get('returnStartTime')),
    returnEndTime: isoOrNull(row.get('returnEndTime')),
    returnLocationComplement: row.get('returnLocationComplement') || '',
    returnAddress: row.get('returnAddress') || null,
    eventId: row.get('eventId') || '',
    returnEventId: row.get('returnEventId') || '',
    declineReason: row.get('declineReason') || '',
    proposedStartTime: proposedStart ? proposedStart.toISOString() : null,
    proposedEndTime: proposedEnd ? proposedEnd.toISOString() : null,
    proposedAddress: row.get('proposedAddress') || {},
    proposedLocationComplement: row.get('proposedLocationComplement') || '',
    challengerTeamId: challengerTeam && challengerTeam.id ? challengerTeam.id : '',
    challengedTeamId: challengedTeam && challengedTeam.id ? challengedTeam.id : '',
    challengerTeamName: row.get('challengerTeamName') || '',
    challengedTeamName: row.get('challengedTeamName') || '',
    challengerUserId: row.get('challengerUser') && row.get('challengerUser').id
      ? row.get('challengerUser').id
      : '',
    challengedUserId: row.get('challengedUser') && row.get('challengedUser').id
      ? row.get('challengedUser').id
      : '',
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
  };
}

Parse.Cloud.define('createMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengedTeamId = String(request.params.challengedTeamId || '').trim();
  const challengerTeamId = String(request.params.challengerTeamId || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 1000);
  const challengeConditions = String(request.params.challengeConditions || '').trim().slice(0, 2000);
  const hasReturnLeg = !!request.params.hasReturnLeg;
  const proposedStartTime = request.params.proposedStartTime
    ? new Date(request.params.proposedStartTime)
    : null;
  const proposedEndTime = request.params.proposedEndTime
    ? new Date(request.params.proposedEndTime)
    : null;
  if (
    !proposedStartTime ||
    Number.isNaN(proposedStartTime.getTime()) ||
    !proposedEndTime ||
    Number.isNaN(proposedEndTime.getTime())
  ) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe data e hora desejadas para o confronto.'
    );
  }
  if (proposedEndTime <= proposedStartTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }
  const proposedAddress =
    request.params.proposedAddress && typeof request.params.proposedAddress === 'object'
      ? request.params.proposedAddress
      : {};
  const proposedLocationComplement = String(request.params.proposedLocationComplement || '').trim();
  const city = String(proposedAddress.city || '').trim();
  const state = String(proposedAddress.state || '').trim();
  if (!city || !state) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe o local desejado (cidade e UF no minimo).'
    );
  }
  if (!challengedTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione o time desafiado.');
  }
  if (!challengerTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Selecione o seu time desafiante.');
  }

  const myTeams = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(5)
    .find({ useMasterKey: true });
  if (!myTeams.length) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Cadastre seu time antes de desafiar.');
  }
  const challengerTeam = myTeams.find((team) => team.id === challengerTeamId);
  if (!challengerTeam) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce so pode desafiar com um time do qual e presidente.'
    );
  }
  if (challengerTeam.id === challengedTeamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel desafiar o proprio time.');
  }

  const challengedTeam = await new Parse.Query('AmateurTeam')
    .include('president')
    .get(challengedTeamId, { useMasterKey: true });
  const challengedPresident = challengedTeam.get('president');
  if (!challengedPresident || !challengedPresident.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time desafiado sem presidente.');
  }
  if (challengedPresident.id === user.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel desafiar o proprio time.');
  }

  const pending = await new Parse.Query('MatchChallenge')
    .equalTo('challengerTeam', challengerTeam)
    .equalTo('challengedTeam', challengedTeam)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (pending) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe um desafio pendente para este time.');
  }

  if (typeof assertTeamsFreeForProposedMatch === 'function') {
    await assertTeamsFreeForProposedMatch(
      challengerTeam,
      challengedTeam,
      proposedStartTime,
      proposedEndTime,
      {}
    );
  }

  const challenge = new Parse.Object('MatchChallenge');
  challenge.set('challengerTeam', challengerTeam);
  challenge.set('challengedTeam', challengedTeam);
  challenge.set('challengerUser', user);
  challenge.set('challengedUser', challengedPresident);
  challenge.set('challengerTeamName', challengerTeam.get('name') || '');
  challenge.set('challengedTeamName', challengedTeam.get('name') || '');
  challenge.set('message', message);
  if (challengeConditions) challenge.set('challengeConditions', challengeConditions);
  challenge.set('hasReturnLeg', hasReturnLeg);
  challenge.set('proposedStartTime', proposedStartTime);
  challenge.set('proposedEndTime', proposedEndTime);
  challenge.set('proposedAddress', proposedAddress);
  challenge.set('proposedLocationComplement', proposedLocationComplement);
  challenge.set('status', 'pending');
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  acl.setReadAccess(challengedPresident.id, true);
  acl.setWriteAccess(challengedPresident.id, true);
  challenge.setACL(acl);
  await challenge.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(challengedPresident.id, {
      title: 'Desafio de confronto',
      alert: `${challengerTeam.get('name') || 'Um time'} te desafiou. Veja na caixa de entrada.`,
      data: {
        type: 'match_challenge',
        challengeId: challenge.id,
      },
    });
  } catch (error) {
    console.error('createMatchChallenge push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(proposedStartTime) : '';
    await createAppMessage({
      recipientId: challengedPresident.id,
      senderId: user.id,
      kind: 'match_challenge',
      title: `Desafio de ${challengerTeam.get('name') || 'um time'}`,
      body:
        `${challengerTeam.get('name') || 'Um time'} desafiou ${challengedTeam.get('name') || 'seu time'}` +
        (dateLabel ? ` para ${dateLabel}.` : '.') +
        ' Responda na Entrada.',
      relatedClass: 'MatchChallenge',
      relatedId: challenge.id,
      actionRoute: '/inbox',
    });
  }

  return mapMatchChallengeRow(challenge);
});

Parse.Cloud.define('respondMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengeId = String(request.params.challengeId || '').trim();
  const decision = String(request.params.decision || '').trim();
  const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
  const returnLocationComplement = String(request.params.returnLocationComplement || '')
    .trim()
    .slice(0, 300);
  const returnStartRaw = request.params.returnStartTime
    ? new Date(request.params.returnStartTime)
    : null;
  const returnStart =
    returnStartRaw && !Number.isNaN(returnStartRaw.getTime()) ? returnStartRaw : null;
  if (!challengeId || (decision !== 'accepted' && decision !== 'declined')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o desafio e a decisao.');
  }
  if (decision === 'declined' && declineReason.length < 3) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o motivo da rejeicao.');
  }

  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerUser')
    .include('challengedUser')
    .include('challengerTeam')
    .include('challengedTeam')
    .get(challengeId, { useMasterKey: true });
  const challengedUser = challenge.get('challengedUser');
  if (!challengedUser || challengedUser.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente desafiado pode responder.');
  }
  if (challenge.get('status') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este desafio ja foi respondido.');
  }

  if (decision === 'accepted') {
    const proposedStart = challenge.get('proposedStartTime');
    const proposedEnd = challenge.get('proposedEndTime');
    if (
      !proposedStart ||
      !proposedEnd ||
      Number.isNaN(new Date(proposedStart).getTime()) ||
      Number.isNaN(new Date(proposedEnd).getTime())
    ) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        'Este desafio nao tem data/hora propostas. Peca um novo convite.'
      );
    }
    if (challenge.get('hasReturnLeg')) {
      if (!returnStart) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Informe data e hora da volta.'
        );
      }
      if (returnLocationComplement.length < 3) {
        throw new Parse.Error(
          Parse.Error.VALIDATION_ERROR,
          'Informe o local da volta (voce sera o mandante).'
        );
      }
    }
    const challengerTeam = challenge.get('challengerTeam');
    const challengedTeam = challenge.get('challengedTeam');
    let homeTeam = challengerTeam;
    let awayTeam = challengedTeam;
    if (challengerTeam && challengerTeam.id && (!challengerTeam.get || !challengerTeam.get('president'))) {
      homeTeam = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(challengerTeam.id, { useMasterKey: true });
    }
    if (challengedTeam && challengedTeam.id && (!challengedTeam.get || !challengedTeam.get('president'))) {
      awayTeam = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(challengedTeam.id, { useMasterKey: true });
    }
    if (typeof assertTeamsFreeForProposedMatch === 'function') {
      await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, proposedStart, proposedEnd, {
        excludeChallengeId: challenge.id,
      });
      if (challenge.get('hasReturnLeg') && returnStart) {
        const returnEndPreview = matchChallengeReturnEnd(returnStart, proposedStart, proposedEnd);
        await assertTeamsFreeForProposedMatch(homeTeam, awayTeam, returnStart, returnEndPreview, {
          excludeChallengeId: challenge.id,
        });
      }
    }
  }

  challenge.set('status', decision);
  if (decision === 'declined') challenge.set('declineReason', declineReason);
  if (decision === 'accepted' && challenge.get('hasReturnLeg') && returnStart) {
    const returnEnd = matchChallengeReturnEnd(
      returnStart,
      challenge.get('proposedStartTime'),
      challenge.get('proposedEndTime')
    );
    const proposedAddress = challenge.get('proposedAddress');
    const returnAddress =
      proposedAddress && typeof proposedAddress === 'object' && !Array.isArray(proposedAddress)
        ? { ...proposedAddress, locationComplement: returnLocationComplement }
        : null;
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(returnStart) : '';
    const summary = (
      dateLabel
        ? `Volta: ${dateLabel} — ${returnLocationComplement}`
        : `Volta: ${returnLocationComplement}`
    ).slice(0, 2000);
    challenge.set('returnStartTime', returnStart);
    challenge.set('returnEndTime', returnEnd);
    challenge.set('returnLocationComplement', returnLocationComplement);
    if (returnAddress) challenge.set('returnAddress', returnAddress);
    challenge.set('returnChallengeConditions', summary);
  }
  await challenge.save(null, { useMasterKey: true });

  const challengerUser = challenge.get('challengerUser');
  if (challengerUser && challengerUser.id) {
    try {
      await sendPushToUser(challengerUser.id, {
        title: decision === 'accepted' ? 'Desafio aceito' : 'Desafio recusado',
        alert:
          decision === 'accepted'
            ? `${challenge.get('challengedTeamName') || 'O adversario'} aceitou o desafio. Marque o confronto.`
            : `${challenge.get('challengedTeamName') || 'O adversario'} recusou: ${declineReason}`,
        data: {
          type: 'match_challenge_response',
          challengeId: challenge.id,
          decision,
        },
      });
    } catch (error) {
      console.error('respondMatchChallenge push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      const challengedName = challenge.get('challengedTeamName') || 'O adversario';
      await createAppMessage({
        recipientId: challengerUser.id,
        senderId: user.id,
        kind: 'match_challenge_response',
        title: decision === 'accepted' ? 'Desafio aceito' : 'Desafio recusado',
        body:
          decision === 'accepted'
            ? `${challengedName} aceitou o desafio. Marque o confronto na Saida.`
            : `${challengedName} recusou o desafio. Motivo: ${declineReason || 'nao informado'}.`,
        relatedClass: 'MatchChallenge',
        relatedId: challenge.id,
        actionRoute: '/inbox?box=out',
      });
    }
  }

  return mapMatchChallengeRow(challenge);
});

Parse.Cloud.define('listMyMatchChallenges', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asChallenger = new Parse.Query('MatchChallenge').equalTo('challengerUser', user);
  const asChallenged = new Parse.Query('MatchChallenge').equalTo('challengedUser', user);
  const rows = await Parse.Query.or(asChallenger, asChallenged)
    .descending('createdAt')
    .limit(50)
    .find({ useMasterKey: true });
  return rows.map(mapMatchChallengeRow);
});

Parse.Cloud.define('getAcceptedMatchChallenge', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const challengeId = String(request.params.challengeId || '').trim();
  if (!challengeId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o desafio.');
  }
  const challenge = await new Parse.Query('MatchChallenge')
    .include('challengerTeam')
    .include('challengedTeam')
    .get(challengeId, { useMasterKey: true });
  if (challenge.get('status') !== 'accepted') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O desafio precisa estar aceito.');
  }
  const challengerUser = challenge.get('challengerUser');
  const challengedUser = challenge.get('challengedUser');
  if (
    !challengerUser ||
    !challengedUser ||
    (challengerUser.id !== user.id && challengedUser.id !== user.id)
  ) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Sem acesso a este desafio.');
  }
  return {
    ...mapMatchChallengeRow(challenge),
    homeTeamId: challenge.get('challengerTeam') && challenge.get('challengerTeam').id,
    awayTeamId: challenge.get('challengedTeam') && challenge.get('challengedTeam').id,
  };
});

Parse.Cloud.define('getTeamMatchMatchdaySummary', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event')
    .include('homeTeam')
    .include('awayTeam')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Resumo disponivel apenas para confrontos.');
  }

  let actual = { homeScore: 0, awayScore: 0, goalScorers: [] };
  if (typeof buildEventActualPredictionResults === 'function') {
    actual = await buildEventActualPredictionResults(event);
  }

  const homeTeamName =
    event.get('homeTeamName') ||
    (event.get('homeTeam') && event.get('homeTeam').get
      ? event.get('homeTeam').get('name')
      : '') ||
    'Mandante';
  const awayTeamName =
    event.get('awayTeamName') ||
    (event.get('awayTeam') && event.get('awayTeam').get
      ? event.get('awayTeam').get('name')
      : '') ||
    'Visitante';
  const homeShieldFile =
    event.get('homeTeam') && event.get('homeTeam').get
      ? event.get('homeTeam').get('shieldImage')
      : null;
  const awayShieldFile =
    event.get('awayTeam') && event.get('awayTeam').get
      ? event.get('awayTeam').get('shieldImage')
      : null;
  const homeTeamShieldUrl =
    homeShieldFile && homeShieldFile.url ? homeShieldFile.url() : undefined;
  const awayTeamShieldUrl =
    awayShieldFile && awayShieldFile.url ? awayShieldFile.url() : undefined;

  const scorers = [];
  const performances = await new Parse.Query('EventPerformance')
    .equalTo('event', event)
    .include('user')
    .limit(200)
    .find({ useMasterKey: true });

  for (const perf of performances) {
    // Confronto: lista de gols do placar usa apenas o apontamento do arbitro.
    const goals =
      event.get('type') === 'team_match'
        ? Number(perf.get('refereeGoals') || 0)
        : Math.max(Number(perf.get('goals') || 0), Number(perf.get('refereeGoals') || 0));
    if (goals <= 0) continue;
    const u = perf.get('user');
    if (!u || !u.id) continue;
    let age = null;
    let position = '';
    let avatarUrl = undefined;
    try {
      const full = await new Parse.Query(Parse.User).get(u.id, { useMasterKey: true });
      age = ageFromBirthDate(full.get('birthDate'));
      const avatar = full.get('avatar');
      if (avatar && avatar.url) avatarUrl = avatar.url();
      const profile = await new Parse.Query('AthleteProfile')
        .equalTo('user', full)
        .first({ useMasterKey: true });
      if (profile) position = String(profile.get('primaryPosition') || '').trim();
    } catch {
      // ignore
    }
    const reg = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('user', u)
      .first({ useMasterKey: true });
    const teamSide = reg ? reg.get('teamSide') || null : null;
    let teamName = '';
    if (teamSide === 'home') teamName = homeTeamName;
    else if (teamSide === 'away') teamName = awayTeamName;
    scorers.push({
      userId: u.id,
      name: (u.get && (u.get('apelido') || u.get('name') || u.getUsername())) || 'Atleta',
      goals,
      position,
      age,
      avatarUrl,
      teamSide,
      teamName,
    });
  }
  scorers.sort((a, b) => b.goals - a.goals);

  let referee = null;
  const refReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'referee')
    .include('user')
    .first({ useMasterKey: true });
  let refereeUser = refReg && refReg.get('user') ? refReg.get('user') : null;
  if (!refereeUser) {
    const acceptedInvite = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('role', 'referee')
      .equalTo('status', 'accepted')
      .include('invitedUser')
      .descending('updatedAt')
      .first({ useMasterKey: true });
    if (acceptedInvite && acceptedInvite.get('invitedUser')) {
      refereeUser = acceptedInvite.get('invitedUser');
    }
  }
  if (refereeUser) {
    const ru = refereeUser;
    let age = null;
    let avatarUrl = undefined;
    try {
      const full = await new Parse.Query(Parse.User).get(ru.id, { useMasterKey: true });
      age = ageFromBirthDate(full.get('birthDate'));
      const avatar = full.get('avatar');
      if (avatar && avatar.url) avatarUrl = avatar.url();
    } catch {
      // ignore
    }
    let score = null;
    try {
      // MuralVote de evento usa scope/scopeId (nao pointer event).
      const votes = await new Parse.Query('MuralVote')
        .equalTo('scope', 'event')
        .equalTo('scopeId', event.id)
        .equalTo('targetRole', 'referee')
        .equalTo('targetUser', Parse.User.createWithoutData(ru.id))
        .limit(200)
        .find({ useMasterKey: true });
      if (votes.length) {
        const sum = votes.reduce((acc, v) => acc + Number(v.get('score') || 0), 0);
        score = Math.round((sum / votes.length) * 10) / 10;
      }
    } catch {
      score = null;
    }
    referee = {
      userId: ru.id,
      name: (ru.get && (ru.get('apelido') || ru.get('name') || ru.getUsername())) || 'Arbitro',
      age,
      avatarUrl,
      score,
    };
  }

  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });

  let canSeeConditions = false;
  const admin = event.get('admin');
  if (admin && admin.id === request.user.id) {
    canSeeConditions = true;
  } else {
    for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
      if (!team) continue;
      const president = team.get('president');
      if (president && president.id === request.user.id) {
        canSeeConditions = true;
        break;
      }
    }
  }

  return {
    eventId: event.id,
    homeTeamName,
    awayTeamName,
    homeTeamShieldUrl,
    awayTeamShieldUrl,
    homeScore: Number(actual.homeScore || 0),
    awayScore: Number(actual.awayScore || 0),
    scorers,
    referee,
    challengeConditions: canSeeConditions ? event.get('challengeConditions') || '' : '',
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
    athleteConvocationBy:
      event.get('athleteConvocationBy') === 'coach' ? 'coach' : 'president',
  };
});

const TEAM_MATCH_REASON_MIN_LEN = 8;
const TEAM_MATCH_RESCHEDULE_MIN_DELTA_MS =
  typeof RESCHEDULE_MIN_DELTA_MS === 'number' ? RESCHEDULE_MIN_DELTA_MS : 15 * 60 * 1000;

async function assertTeamMatchScheduleManager(event, user) {
  const admin = event.get('admin');
  if (admin && admin.id === user.id) return;

  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
    if (!team) continue;
    const president = team.get('president');
    if (president && president.id === user.id) return;
  }

  throw new Parse.Error(
    Parse.Error.OPERATION_FORBIDDEN,
    'Apenas presidentes dos times ou quem marcou o confronto podem alterar a agenda.'
  );
}

function normalizeTeamMatchReason(raw) {
  const reason = String(raw || '').trim();
  if (reason.length < TEAM_MATCH_REASON_MIN_LEN) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      `Informe o motivo com pelo menos ${TEAM_MATCH_REASON_MIN_LEN} caracteres.`
    );
  }
  return reason.slice(0, 500);
}

Parse.Cloud.define('cancelTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const reason = normalizeTeamMatchReason(request.params.reason);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este confronto ja foi encerrado.');
  }
  const startTime = event.get('startTime');
  const startMs = startTime instanceof Date ? startTime.getTime() : new Date(startTime || 0).getTime();
  if (!Number.isNaN(startMs) && startMs <= Date.now()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel cancelar apos o inicio.');
  }

  await assertTeamMatchScheduleManager(event, user);
  clearPendingTeamMatchReschedule(event);
  event.set('isFinished', true);
  event.set('lastScheduleChangeReason', reason);
  event.set('lastScheduleChangeBy', user);
  event.set('lastScheduleChangeAt', new Date());
  await event.save(null, { useMasterKey: true });

  return { ok: true, eventId: event.id, isFinished: true };
});

async function loadTeamMatchPresidents(event) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  const seen = new Set();
  const presidents = [];
  for (const team of [event.get('homeTeam'), event.get('awayTeam')]) {
    if (!team) continue;
    const president = team.get('president');
    if (!president || !president.id || seen.has(president.id)) continue;
    seen.add(president.id);
    presidents.push(president);
  }
  return presidents;
}

function clearPendingTeamMatchReschedule(event) {
  event.unset('pendingRescheduleStartTime');
  event.unset('pendingRescheduleEndTime');
  event.unset('pendingRescheduleReason');
  event.unset('pendingRescheduleRequestedBy');
  event.unset('pendingRescheduleRequestedAt');
  event.unset('pendingRescheduleStatus');
}

function mapPendingRescheduleRow(event) {
  const requestedBy = event.get('pendingRescheduleRequestedBy');
  const start = event.get('pendingRescheduleStartTime');
  const end = event.get('pendingRescheduleEndTime');
  const currentStart = event.get('startTime');
  return {
    eventId: event.id,
    eventName: event.get('name') || '',
    homeTeamName: event.get('homeTeamName') || 'Mandante',
    awayTeamName: event.get('awayTeamName') || 'Visitante',
    currentStartTime: currentStart ? currentStart.toISOString() : null,
    proposedStartTime: start ? start.toISOString() : null,
    proposedEndTime: end ? end.toISOString() : null,
    reason: event.get('pendingRescheduleReason') || '',
    requestedByUserId: requestedBy && requestedBy.id ? requestedBy.id : '',
    requestedAt: event.get('pendingRescheduleRequestedAt')
      ? event.get('pendingRescheduleRequestedAt').toISOString()
      : null,
    status: event.get('pendingRescheduleStatus') || 'pending',
  };
}

async function applyTeamMatchReschedule(event, user, startTime, endTime, reason) {
  event.set('startTime', startTime);
  event.set('endTime', endTime);
  event.set('lastScheduleChangeReason', reason);
  event.set('lastScheduleChangeBy', user);
  event.set('lastScheduleChangeAt', new Date());
  clearPendingTeamMatchReschedule(event);
  await event.save(null, { useMasterKey: true });
}

/** Propoe remarcacao; se nao houver outro presidente, aplica na hora. */
Parse.Cloud.define('rescheduleTeamMatch', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const reason = normalizeTeamMatchReason(request.params.reason);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }

  const startTime = request.params.startTime ? new Date(request.params.startTime) : null;
  const endTime = request.params.endTime ? new Date(request.params.endTime) : null;
  if (!startTime || Number.isNaN(startTime.getTime()) || !endTime || Number.isNaN(endTime.getTime())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe data e hora do confronto.');
  }
  if (endTime <= startTime) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'O termino deve ser apos o inicio.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este confronto ja foi encerrado.');
  }
  if (event.get('pendingRescheduleStatus') === 'pending') {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Ja existe uma proposta de remarcacao pendente para este confronto.'
    );
  }

  const oldStart = event.get('startTime');
  const oldStartMs = oldStart instanceof Date ? oldStart.getTime() : new Date(oldStart || 0).getTime();
  if (!Number.isNaN(oldStartMs) && oldStartMs <= Date.now()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel remarcar apos o inicio.');
  }
  if (
    !Number.isNaN(oldStartMs) &&
    Math.abs(startTime.getTime() - oldStartMs) < TEAM_MATCH_RESCHEDULE_MIN_DELTA_MS
  ) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'A nova data deve diferir pelo menos 15 minutos da anterior.'
    );
  }

  await assertTeamMatchScheduleManager(event, user);
  const presidents = await loadTeamMatchPresidents(event);
  const counterparts = presidents.filter((president) => president.id !== user.id);

  if (!counterparts.length) {
    await applyTeamMatchReschedule(event, user, startTime, endTime, reason);
    return {
      ok: true,
      pending: false,
      eventId: event.id,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };
  }

  event.set('pendingRescheduleStartTime', startTime);
  event.set('pendingRescheduleEndTime', endTime);
  event.set('pendingRescheduleReason', reason);
  event.set('pendingRescheduleRequestedBy', user);
  event.set('pendingRescheduleRequestedAt', new Date());
  event.set('pendingRescheduleStatus', 'pending');
  await event.save(null, { useMasterKey: true });

  const eventName = event.get('name') || 'confronto';
  const dateLabel =
    typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
  for (const counterpart of counterparts) {
    try {
      await sendPushToUser(counterpart.id, {
        title: 'Remarcacao de confronto',
        alert: dateLabel
          ? `Proposta de remarcar "${eventName}" para ${dateLabel}. Veja na caixa de entrada.`
          : `Proposta de remarcar "${eventName}". Veja na caixa de entrada.`,
        data: {
          type: 'team_match_reschedule_request',
          eventId: event.id,
        },
      });
    } catch (error) {
      console.error('rescheduleTeamMatch push failed', error);
    }
  }

  if (typeof createAppMessages === 'function') {
    await createAppMessages(
      counterparts.map((counterpart) => counterpart.id),
      {
        senderId: user.id,
        kind: 'team_match_reschedule_request',
        title: 'Proposta de remarcacao',
        body:
          `Proposta de remarcar "${eventName}"` +
          (dateLabel ? ` para ${dateLabel}.` : '.') +
          (reason ? ` Motivo: ${reason}.` : '') +
          ' Aceite ou recuse na Entrada.',
        relatedClass: 'Event',
        relatedId: event.id,
        actionRoute: '/inbox',
      }
    );
  }

  return {
    ok: true,
    pending: true,
    eventId: event.id,
    proposedStartTime: startTime.toISOString(),
    proposedEndTime: endTime.toISOString(),
    awaitingPresidents: counterparts.length,
  };
});

Parse.Cloud.define('respondTeamMatchReschedule', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const decision = String(request.params.decision || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }
  if (decision !== 'accepted' && decision !== 'declined') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe accepted ou declined.');
  }

  const event = await new Parse.Query('Event')
    .include('pendingRescheduleRequestedBy')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('pendingRescheduleStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao ha proposta de remarcacao pendente.');
  }

  const requestedBy = event.get('pendingRescheduleRequestedBy');
  if (requestedBy && requestedBy.id === user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Quem pediu a remarcacao nao pode aceitar a propria proposta.'
    );
  }

  const presidents = await loadTeamMatchPresidents(event);
  const isCounterpart = presidents.some((president) => president.id === user.id);
  if (!isCounterpart) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente do time adversario pode responder a remarcacao.'
    );
  }

  const proposedStart = event.get('pendingRescheduleStartTime');
  const proposedEnd = event.get('pendingRescheduleEndTime');
  const reason = String(event.get('pendingRescheduleReason') || '').trim();
  const eventName = event.get('name') || 'confronto';
  const requesterId = requestedBy && requestedBy.id ? requestedBy.id : '';

  if (decision === 'declined') {
    const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
    clearPendingTeamMatchReschedule(event);
    await event.save(null, { useMasterKey: true });
    if (requesterId) {
      try {
        await sendPushToUser(requesterId, {
          title: 'Remarcacao recusada',
          alert: declineReason
            ? `A remarcacao de "${eventName}" foi recusada. Motivo: ${declineReason}`
            : `A remarcacao de "${eventName}" foi recusada.`,
          data: {
            type: 'team_match_reschedule_response',
            eventId: event.id,
            decision: 'declined',
          },
        });
      } catch (error) {
        console.error('respondTeamMatchReschedule decline push failed', error);
      }

      if (typeof createAppMessage === 'function') {
        await createAppMessage({
          recipientId: requesterId,
          senderId: user.id,
          kind: 'team_match_reschedule_response',
          title: 'Remarcacao recusada',
          body:
            `A remarcacao de "${eventName}" foi recusada pelo adversario.` +
            (declineReason ? ` Motivo: ${declineReason}.` : ''),
          relatedClass: 'Event',
          relatedId: event.id,
          actionRoute: `/event/${event.id}`,
        });
      }
    }
    return { ok: true, decision: 'declined', eventId: event.id };
  }

  if (
    !proposedStart ||
    !proposedEnd ||
    Number.isNaN(new Date(proposedStart).getTime()) ||
    Number.isNaN(new Date(proposedEnd).getTime())
  ) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Proposta de remarcacao invalida.');
  }

  await applyTeamMatchReschedule(
    event,
    user,
    new Date(proposedStart),
    new Date(proposedEnd),
    reason || 'Remarcacao aceita pelo adversario'
  );

  if (requesterId) {
    const acceptedDateLabel =
      typeof formatEventPushDate === 'function'
        ? formatEventPushDate(event.get('startTime'))
        : '';
    try {
      await sendPushToUser(requesterId, {
        title: 'Remarcacao aceita',
        alert: acceptedDateLabel
          ? `Remarcacao de "${eventName}" aceita para ${acceptedDateLabel}.`
          : `Remarcacao de "${eventName}" aceita.`,
        data: {
          type: 'team_match_reschedule_response',
          eventId: event.id,
          decision: 'accepted',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchReschedule accept push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      await createAppMessage({
        recipientId: requesterId,
        senderId: user.id,
        kind: 'team_match_reschedule_response',
        title: 'Remarcacao aceita',
        body:
          `O adversario aceitou remarcar "${eventName}"` +
          (acceptedDateLabel ? ` para ${acceptedDateLabel}.` : '.'),
        relatedClass: 'Event',
        relatedId: event.id,
        actionRoute: `/event/${event.id}`,
      });
    }
  }

  return {
    ok: true,
    decision: 'accepted',
    eventId: event.id,
    startTime: event.get('startTime') ? event.get('startTime').toISOString() : null,
    endTime: event.get('endTime') ? event.get('endTime').toISOString() : null,
  };
});

Parse.Cloud.define('listPendingTeamMatchReschedules', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teams = await new Parse.Query('AmateurTeam')
    .equalTo('president', user)
    .limit(5)
    .find({ useMasterKey: true });
  if (!teams.length) return [];

  const homeQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('pendingRescheduleStatus', 'pending')
    .containedIn('homeTeam', teams);
  const awayQ = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .equalTo('pendingRescheduleStatus', 'pending')
    .containedIn('awayTeam', teams);
  const rows = await Parse.Query.or(homeQ, awayQ)
    .include('pendingRescheduleRequestedBy')
    .descending('pendingRescheduleRequestedAt')
    .limit(30)
    .find({ useMasterKey: true });

  return rows
    .filter((event) => {
      const requestedBy = event.get('pendingRescheduleRequestedBy');
      return !(requestedBy && requestedBy.id === user.id);
    })
    .map(mapPendingRescheduleRow);
});

Parse.Cloud.define('getTeamMatchPendingReschedule', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto.');
  }
  const event = await new Parse.Query('Event')
    .include('pendingRescheduleRequestedBy')
    .get(eventId, { useMasterKey: true });
  if (event.get('pendingRescheduleStatus') !== 'pending') {
    return null;
  }
  return mapPendingRescheduleRow(event);
});

function mapTeamMatchJoinRequestRow(row) {
  const event = row.get('event');
  const athlete = row.get('athlete');
  const president = row.get('president');
  return {
    objectId: row.id,
    status: row.get('status') || 'pending',
    teamSide: row.get('teamSide') || '',
    teamName: row.get('teamName') || '',
    eventId: event && event.id ? event.id : '',
    eventName: row.get('eventName') || (event && event.get ? event.get('name') : '') || 'Confronto',
    eventStartTime: (() => {
      const start =
        row.get('eventStartTime') || (event && event.get ? event.get('startTime') : null);
      return start ? start.toISOString() : null;
    })(),
    athleteUserId: athlete && athlete.id ? athlete.id : '',
    athleteApelido: row.get('athleteApelido') || '',
    athleteFullName: row.get('athleteFullName') || '',
    athleteAvatarUrl: row.get('athleteAvatarUrl') || '',
    presidentUserId: president && president.id ? president.id : '',
    presidentApelido: row.get('presidentApelido') || '',
    message: row.get('message') || '',
    declineReason: row.get('declineReason') || '',
    createdAt: row.get('createdAt') ? row.get('createdAt').toISOString() : null,
    respondedAt: row.get('respondedAt') ? row.get('respondedAt').toISOString() : null,
  };
}

async function loadTeamMatchSidePresident(event, teamSide) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });
  const team = teamSide === 'away' ? event.get('awayTeam') : event.get('homeTeam');
  if (!team || !team.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time do confronto nao encontrado.');
  }
  let president = team.get('president');
  if (president && president.id && typeof president.fetch === 'function') {
    try {
      await president.fetch({ useMasterKey: true });
    } catch {
      /* pointer */
    }
  }
  if (!president || !president.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Time sem presidente.');
  }
  return {
    team,
    president,
    teamName: event.get(teamSide === 'away' ? 'awayTeamName' : 'homeTeamName') || team.get('name') || '',
  };
}

Parse.Cloud.define('setTeamMatchAcceptsUninvitedAthletes', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const accepts = !!request.params.accepts;
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto e o time (home/away).');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Confronto ja finalizado.');
  }
  const { president } = await loadTeamMatchSidePresident(event, teamSide);
  if (president.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente deste time pode alterar a opcao.'
    );
  }
  const field =
    teamSide === 'away' ? 'awayAcceptsUninvitedAthletes' : 'homeAcceptsUninvitedAthletes';
  event.set(field, accepts);
  await event.save(null, { useMasterKey: true });
  return {
    eventId: event.id,
    homeAcceptsUninvitedAthletes: !!event.get('homeAcceptsUninvitedAthletes'),
    awayAcceptsUninvitedAthletes: !!event.get('awayAcceptsUninvitedAthletes'),
  };
});

Parse.Cloud.define('requestTeamMatchParticipation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const message = String(request.params.message || '').trim().slice(0, 500);
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o confronto e o time desejado.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao disponivel apenas para confrontos.');
  }
  if (event.get('isFinished') || new Date() >= event.get('startTime')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao e possivel solicitar neste confronto.');
  }

  const acceptsField =
    teamSide === 'away' ? 'awayAcceptsUninvitedAthletes' : 'homeAcceptsUninvitedAthletes';
  if (!event.get(acceptsField)) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Este time nao esta aceitando atletas nao convocados.'
    );
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .first({ useMasterKey: true });
  if (existingReg) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Voce ja esta inscrito neste confronto.');
  }

  const pendingInvite = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', user)
    .equalTo('role', 'athlete')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (pendingInvite) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Voce ja possui convite de convocacao para este confronto.'
    );
  }

  const duplicate = await new Parse.Query('TeamMatchJoinRequest')
    .equalTo('event', event)
    .equalTo('athlete', user)
    .equalTo('status', 'pending')
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'Ja existe uma solicitacao pendente.');
  }

  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  if (typeof findUserScheduleConflictDetail === 'function') {
    const conflict = await findUserScheduleConflictDetail(user.id, startTime, endTime, eventId);
    if (conflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Conflito de agenda com "${conflict.eventName}".`
      );
    }
  }

  const { president, teamName } = await loadTeamMatchSidePresident(event, teamSide);
  if (president.id === user.id) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Presidente nao solicita participacao no proprio time.');
  }

  try {
    await user.fetch({ useMasterKey: true });
  } catch {
    /* sessao */
  }
  const athleteApelido = String(user.get('apelido') || '').trim();
  const athleteFullName = String(user.get('name') || '').trim();
  const athleteAvatar =
    typeof resolveUserAvatarUrl === 'function' ? resolveUserAvatarUrl(user) : String(user.get('avatarUrl') || '');

  let presidentApelido = '';
  try {
    await president.fetch({ useMasterKey: true });
    presidentApelido = String(president.get('apelido') || president.get('name') || '').trim();
  } catch {
    presidentApelido = '';
  }

  const row = new Parse.Object('TeamMatchJoinRequest');
  row.set('event', event);
  row.set('athlete', user);
  row.set('president', president);
  row.set('teamSide', teamSide);
  row.set('teamName', teamName);
  row.set('eventName', event.get('name') || `${event.get('homeTeamName')} x ${event.get('awayTeamName')}`);
  row.set('eventStartTime', startTime);
  row.set('status', 'pending');
  row.set('message', message);
  row.set('athleteApelido', athleteApelido);
  row.set('athleteFullName', athleteFullName);
  if (athleteAvatar) row.set('athleteAvatarUrl', athleteAvatar);
  row.set('presidentApelido', presidentApelido);
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, true);
  acl.setReadAccess(president.id, true);
  acl.setWriteAccess(president.id, true);
  row.setACL(acl);
  await row.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(president.id, {
      title: 'Solicitacao de participacao',
      alert: `${athleteApelido || athleteFullName || 'Um atleta'} pediu para jogar por ${teamName}.`,
      data: {
        type: 'team_match_join_request',
        requestId: row.id,
        eventId: event.id,
      },
    });
  } catch (error) {
    console.error('requestTeamMatchParticipation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const athleteName = athleteApelido || athleteFullName || 'Um atleta';
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
    await createAppMessage({
      recipientId: president.id,
      senderId: user.id,
      kind: 'team_match_join_request',
      title: `Pedido de participacao de ${athleteName}`,
      body:
        `${athleteName} pediu para jogar por ${teamName} em "${row.get('eventName')}"` +
        (dateLabel ? ` (${dateLabel}).` : '.') +
        ' Autorize ou recuse na Entrada.',
      relatedClass: 'TeamMatchJoinRequest',
      relatedId: row.id,
      actionRoute: '/inbox',
    });
  }

  return mapTeamMatchJoinRequestRow(row);
});

Parse.Cloud.define('respondTeamMatchParticipation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const requestId = String(request.params.requestId || '').trim();
  const decision = String(request.params.decision || '').trim();
  const declineReason = String(request.params.declineReason || '').trim().slice(0, 500);
  if (!requestId || (decision !== 'accepted' && decision !== 'declined')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a solicitacao e a decisao.');
  }

  const row = await new Parse.Query('TeamMatchJoinRequest')
    .include('event')
    .include('athlete')
    .include('president')
    .get(requestId, { useMasterKey: true });
  const president = row.get('president');
  if (!president || president.id !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Apenas o presidente do time pode responder.');
  }
  if (row.get('status') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta solicitacao ja foi respondida.');
  }

  const event = row.get('event');
  const athlete = row.get('athlete');
  if (!event || !athlete) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Solicitacao incompleta.');
  }

  if (decision === 'declined') {
    row.set('status', 'declined');
    if (declineReason) row.set('declineReason', declineReason);
    row.set('respondedAt', new Date());
    await row.save(null, { useMasterKey: true });
    try {
      await sendPushToUser(athlete.id, {
        title: 'Participacao recusada',
        alert: `${row.get('teamName') || 'O time'} recusou sua solicitacao no confronto.`,
        data: {
          type: 'team_match_join_response',
          requestId: row.id,
          eventId: event.id,
          decision: 'declined',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchParticipation decline push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      await createAppMessage({
        recipientId: athlete.id,
        senderId: user.id,
        kind: 'team_match_join_response',
        title: 'Participacao recusada',
        body:
          `${row.get('teamName') || 'O time'} recusou sua solicitacao em "${row.get('eventName')}".` +
          (declineReason ? ` Motivo: ${declineReason}.` : ''),
        relatedClass: 'TeamMatchJoinRequest',
        relatedId: row.id,
        actionRoute: `/event/${event.id}`,
      });
    }
    return mapTeamMatchJoinRequestRow(row);
  }

  const startTime = event.get('startTime');
  const endTime = event.get('endTime');
  if (typeof findUserScheduleConflictDetail === 'function') {
    const conflict = await findUserScheduleConflictDetail(athlete.id, startTime, endTime, event.id);
    if (conflict.conflict) {
      throw new Parse.Error(
        Parse.Error.VALIDATION_ERROR,
        `Atleta com conflito de agenda em "${conflict.eventName}".`
      );
    }
  }

  const existingReg = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', athlete)
    .first({ useMasterKey: true });
  if (!existingReg) {
    try {
      await athlete.fetch({ useMasterKey: true });
    } catch {
      /* */
    }
    const apelido =
      String(row.get('athleteApelido') || athlete.get('apelido') || athlete.get('name') || '').trim() ||
      athlete.getUsername() ||
      'Atleta';
    const registration = new Parse.Object('EventRegistration');
    registration.set('event', event);
    registration.set('user', athlete);
    registration.set('role', 'athlete');
    registration.set('apelido', apelido);
    registration.set('committed', true);
    registration.set('membershipType', 'convidado');
    registration.set('attendance', 'pending');
    registration.set('paymentConfirmed', true);
    registration.set('paymentExempt', true);
    registration.set('isEffectivelyConfirmed', true);
    registration.set('invitedByContract', true);
    registration.set('contractOfferedAmount', 0);
    registration.set('teamSide', row.get('teamSide'));
    const avatar = row.get('athleteAvatarUrl') || '';
    if (avatar) registration.set('avatarUrl', avatar);
    await registration.save(null, { useMasterKey: true });
  }

  row.set('status', 'accepted');
  row.set('respondedAt', new Date());
  await row.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(athlete.id, {
      title: 'Participacao aceita',
      alert: `${row.get('teamName') || 'O time'} aceitou voce no confronto.`,
      data: {
        type: 'team_match_join_response',
        requestId: row.id,
        eventId: event.id,
        decision: 'accepted',
      },
    });
  } catch (error) {
    console.error('respondTeamMatchParticipation accept push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const dateLabel =
      typeof formatEventPushDate === 'function' ? formatEventPushDate(startTime) : '';
    await createAppMessage({
      recipientId: athlete.id,
      senderId: user.id,
      kind: 'team_match_join_response',
      title: 'Participacao aceita',
      body:
        `${row.get('teamName') || 'O time'} aceitou voce em "${row.get('eventName')}"` +
        (dateLabel ? ` (${dateLabel}).` : '.'),
      relatedClass: 'TeamMatchJoinRequest',
      relatedId: row.id,
      actionRoute: `/event/${event.id}`,
    });
  }

  return mapTeamMatchJoinRequestRow(row);
});

Parse.Cloud.define('listMyTeamMatchJoinRequests', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const asAthlete = new Parse.Query('TeamMatchJoinRequest').equalTo('athlete', user);
  const asPresident = new Parse.Query('TeamMatchJoinRequest').equalTo('president', user);
  const rows = await Parse.Query.or(asAthlete, asPresident)
    .descending('createdAt')
    .limit(80)
    .find({ useMasterKey: true });
  return rows.map(mapTeamMatchJoinRequestRow);
});

/** Convocacao de atletas no confronto � presidente ou treinador por time */

function normalizeAthleteConvocationBy(value) {
  return value === 'coach' ? 'coach' : 'president';
}

async function resolveCoachManageSidesForTeamMatch(event, user) {
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', user)
    .equalTo('role', 'coach')
    .containedIn('status', ['pending', 'accepted'])
    .descending('createdAt')
    .first({ useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', user)
    .equalTo('role', 'coach')
    .first({ useMasterKey: true });

  if (!invitation && !registration) return [];

  const explicit =
    (invitation && invitation.get('teamSide')) ||
    (registration && registration.get('teamSide')) ||
    '';
  if (explicit === 'home' || explicit === 'away') return [explicit];

  const invitedBy =
    (invitation && invitation.get('invitedBy')) ||
    (registration && registration.get('invitedBy')) ||
    null;
  if (!invitedBy || !invitedBy.id) return [];

  const sides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    if (president && president.id === invitedBy.id) sides.push(side);
  }
  return sides;
}

async function resolveTeamMatchConvocationAccess(event, user) {
  const mode = normalizeAthleteConvocationBy(event.get('athleteConvocationBy'));
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], {
    useMasterKey: true,
  });

  const manageSides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    const isPresident = !!(president && president.id === user.id);
    if (isPresident) {
      manageSides.push(side);
      continue;
    }
  }

  if (mode === 'coach') {
    const coachSides = await resolveCoachManageSidesForTeamMatch(event, user);
    for (const side of coachSides) {
      if (!manageSides.includes(side)) manageSides.push(side);
    }
  } else {
    // Modo presidente: apenas presidentes (ja preenchido).
  }

  const admin = event.get('admin');
  const canSetMode = !!(admin && admin.id === user.id);

  return {
    athleteConvocationBy: mode,
    manageSides,
    canManage: manageSides.length > 0,
    canSetMode,
  };
}

Parse.Cloud.define('getTeamMatchConvocationAccess', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  return resolveTeamMatchConvocationAccess(event, user);
});

Parse.Cloud.define('setTeamMatchAthleteConvocationBy', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const value = normalizeAthleteConvocationBy(request.params.athleteConvocationBy);
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const admin = event.get('admin');
  if (!admin || admin.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas quem criou o confronto pode definir quem faz a convocacao.'
    );
  }
  event.set('athleteConvocationBy', value);
  await event.save(null, { useMasterKey: true });
  return { eventId: event.id, athleteConvocationBy: value };
});

Parse.Cloud.define('listTeamMatchConvocations', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  if (!eventId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento e time (home/away).');
  }
  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode gerenciar a convocacao deste time.'
    );
  }

  const invitations = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .include('invitedUser')
    .limit(200)
    .find({ useMasterKey: true });

  const registrations = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .include('user')
    .limit(200)
    .find({ useMasterKey: true });

  const byUserId = new Map();
  for (const invitation of invitations) {
    const invited = invitation.get('invitedUser');
    if (!invited || !invited.id) continue;
    byUserId.set(invited.id, {
      userId: invited.id,
      invitationId: invitation.id,
      registrationId: null,
      status: invitation.get('status') || 'pending',
      apelido:
        invitation.get('invitedUserApelido') ||
        (invited.get && (invited.get('apelido') || invited.get('name'))) ||
        'Atleta',
      avatarUrl: invitation.get('invitedUserAvatarUrl') || undefined,
      offeredAmount: Number(invitation.get('offeredAmount') || 0),
      teamSide,
    });
  }
  for (const registration of registrations) {
    const regUser = registration.get('user');
    if (!regUser || !regUser.id) continue;
    const existing = byUserId.get(regUser.id) || {
      userId: regUser.id,
      invitationId: null,
      status: 'accepted',
      apelido: registration.get('apelido') || 'Atleta',
      avatarUrl: registration.get('avatarUrl') || undefined,
      offeredAmount: Number(registration.get('contractOfferedAmount') || 0),
      teamSide,
    };
    existing.registrationId = registration.id;
    existing.status = 'accepted';
    if (!existing.apelido) existing.apelido = registration.get('apelido') || 'Atleta';
    byUserId.set(regUser.id, existing);
  }

  return {
    teamSide,
    teamName:
      teamSide === 'away'
        ? event.get('awayTeamName') || 'Visitante'
        : event.get('homeTeamName') || 'Mandante',
    rows: Array.from(byUserId.values()).sort((a, b) =>
      String(a.apelido).localeCompare(String(b.apelido), 'pt-BR')
    ),
  };
});

Parse.Cloud.define('createTeamMatchAthleteInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const invitedUserId = String(request.params.invitedUserId || '').trim();
  const teamSide = String(request.params.teamSide || '').trim();
  const offeredAmount = Number(request.params.offeredAmount || 0);
  const responseDeadline = request.params.responseDeadline
    ? new Date(request.params.responseDeadline)
    : null;
  if (!eventId || !invitedUserId || (teamSide !== 'home' && teamSide !== 'away')) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe evento, atleta e time (home/away).'
    );
  }
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(
      Parse.Error.VALIDATION_ERROR,
      'Informe um prazo futuro para resposta do convite.'
    );
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Valor da convocacao invalido.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode convocar atletas neste time.'
    );
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const sameSideExisting = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'athlete')
    .equalTo('teamSide', teamSide)
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (sameSideExisting) {
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'Este atleta ja possui convocacao ativa neste time para o confronto.'
    );
  }

  const invitation = await createTeamMatchInvitation(
    event,
    invitedUserId,
    user,
    teamSide,
    responseDeadline,
    offeredAmount
  );
  if (!invitation) {
    throw new Parse.Error(
      Parse.Error.DUPLICATE_VALUE,
      'Este atleta ja esta inscrito neste confronto.'
    );
  }

  const invitedUserApelido = String(request.params.invitedUserApelido || '').trim();
  const invitedUserFullName = String(request.params.invitedUserFullName || '').trim();
  const invitedUserAvatarUrl = String(request.params.invitedUserAvatarUrl || '').trim();
  if (invitedUserApelido) invitation.set('invitedUserApelido', invitedUserApelido);
  if (invitedUserFullName) invitation.set('invitedUserFullName', invitedUserFullName);
  if (invitedUserAvatarUrl) invitation.set('invitedUserAvatarUrl', invitedUserAvatarUrl);
  await invitation.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(invitedUserId, {
      title: 'Convocacao para confronto',
      alert:
        (event.get('name') || 'Confronto') +
        ': voce foi convocado. Responda na caixa de entrada.',
      data: {
        type: 'referee_invitation',
        invitationId: invitation.id,
        eventId: event.id,
        role: 'athlete',
      },
    });
  } catch (error) {
    console.error('createTeamMatchAthleteInvitation push failed', error);
  }

  return {
    invitationId: invitation.id,
    status: invitation.get('status') || 'pending',
    teamSide,
  };
});

Parse.Cloud.define('removeTeamMatchAthleteConvocation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const athleteUserId = String(request.params.athleteUserId || '').trim();
  const teamSideParam = String(request.params.teamSide || '').trim();
  if (!eventId || !athleteUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento e atleta.');
  }

  const event = await new Parse.Query('Event').get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }

  const athlete = Parse.User.createWithoutData(athleteUserId);
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', athlete)
    .equalTo('role', 'athlete')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  const registration = await new Parse.Query('EventRegistration')
    .equalTo('event', event)
    .equalTo('user', athlete)
    .first({ useMasterKey: true });

  const teamSide =
    teamSideParam === 'home' || teamSideParam === 'away'
      ? teamSideParam
      : (invitation && invitation.get('teamSide')) ||
        (registration && registration.get('teamSide')) ||
        '';
  if (teamSide !== 'home' && teamSide !== 'away') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Nao foi possivel identificar o time.');
  }

  const access = await resolveTeamMatchConvocationAccess(event, user);
  if (!access.manageSides.includes(teamSide)) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Voce nao pode excluir convocacoes deste time.'
    );
  }

  if (invitation) {
    invitation.set('status', 'cancelled');
    invitation.set('cancelledAt', new Date());
    invitation.set('cancelledBy', user);
    invitation.set('cancelReason', 'Removido da convocacao');
    await invitation.save(null, { useMasterKey: true });
  }
  if (registration) {
    await registration.destroy({ useMasterKey: true });
  }
  if (!invitation && !registration) {
    throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Convocacao nao encontrada.');
  }

  const removerName =
    (user.get('apelido') || user.get('name') || user.getUsername() || 'A comissao').trim();
  const teamName =
    teamSide === 'away'
      ? event.get('awayTeamName') || 'Visitante'
      : event.get('homeTeamName') || 'Mandante';

  const removalBody =
    removerName +
    ' removeu voce da convocacao de ' +
    teamName +
    ' no confronto ' +
    (event.get('name') || '') +
    '.';
  try {
    await sendPushToUser(athleteUserId, {
      title: 'Convocacao removida',
      alert: removalBody,
      data: {
        type: 'team_match_convocation_removed',
        eventId: event.id,
        teamSide,
        removedByUserId: user.id,
      },
    });
  } catch (error) {
    console.error('removeTeamMatchAthleteConvocation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    await createAppMessage({
      recipientId: athleteUserId,
      senderId: user.id,
      kind: 'team_match_convocation_removed',
      title: 'Convocacao removida',
      body: removalBody,
      relatedClass: 'Event',
      relatedId: event.id,
      actionRoute: `/event/${event.id}`,
    });
  }

  return { ok: true, eventId: event.id, athleteUserId, teamSide };
});

Parse.Cloud.define('getTeamMatchGoalkeeperAlerts', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  if (!eventId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o evento.');
  }

  const event = await new Parse.Query('Event')
    .include('homeTeam.president')
    .include('awayTeam.president')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    return { alerts: [] };
  }

  const alertSides = [];
  for (const side of ['home', 'away']) {
    const team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    const president = team && team.get ? team.get('president') : null;
    if (president && president.id === user.id) {
      alertSides.push(side);
    }
  }
  const coachSides = await resolveCoachManageSidesForTeamMatch(event, user);
  for (const side of coachSides) {
    if (!alertSides.includes(side)) alertSides.push(side);
  }
  if (!alertSides.length) {
    return { alerts: [] };
  }

  const participationFee = Number(event.get('participationFee') || 0);
  const isGk =
    typeof isGoalkeeperPosition === 'function'
      ? isGoalkeeperPosition
      : (position) => String(position || '').trim().toLowerCase() === 'goleiro';

  const alerts = [];
  for (const teamSide of alertSides) {
    const invitations = await new Parse.Query('RefereeInvitation')
      .equalTo('event', event)
      .equalTo('role', 'athlete')
      .equalTo('teamSide', teamSide)
      .containedIn('status', ['pending', 'accepted'])
      .include('invitedUser')
      .limit(200)
      .find({ useMasterKey: true });

    const registrations = await new Parse.Query('EventRegistration')
      .equalTo('event', event)
      .equalTo('teamSide', teamSide)
      .containedIn('role', ['athlete', 'goalkeeper'])
      .include('user')
      .include('athlete')
      .limit(200)
      .find({ useMasterKey: true });

    const regByUserId = new Map();
    for (const reg of registrations) {
      const uid = reg.get('user') && reg.get('user').id ? String(reg.get('user').id) : '';
      if (uid) regByUserId.set(uid, reg);
    }

    const candidateUserIds = new Set();
    for (const inv of invitations) {
      const iu = inv.get('invitedUser');
      if (iu && iu.id) candidateUserIds.add(String(iu.id));
    }
    for (const uid of regByUserId.keys()) {
      candidateUserIds.add(uid);
    }

    const unconfirmedNames = [];
    for (const userId of candidateUserIds) {
      let position = '';
      const reg = regByUserId.get(userId);
      if (reg) {
        const athlete = reg.get('athlete');
        if (athlete && athlete.get) {
          position = String(athlete.get('primaryPosition') || '');
        }
        if (reg.get('role') === 'goalkeeper') {
          position = position || 'goleiro';
        }
      }
      if (!isGk(position)) {
        try {
          const profile = await new Parse.Query('AthleteProfile')
            .equalTo('user', Parse.User.createWithoutData(userId))
            .first({ useMasterKey: true });
          if (profile) position = String(profile.get('primaryPosition') || '');
        } catch {
          // ignore
        }
      }
      if (!isGk(position)) continue;

      const confirmed =
        reg &&
        typeof computeRegistrationEffectiveConfirmation === 'function'
          ? computeRegistrationEffectiveConfirmation(reg, participationFee)
          : !!(reg && reg.get('isEffectivelyConfirmed'));
      if (confirmed) continue;

      let name = 'Goleiro';
      if (reg) {
        name =
          reg.get('apelido') ||
          reg.get('userDisplayName') ||
          reg.get('userApelido') ||
          name;
      } else {
        try {
          const u = await new Parse.Query(Parse.User).get(userId, { useMasterKey: true });
          name = u.get('apelido') || u.get('name') || u.getUsername() || name;
        } catch {
          // ignore
        }
      }
      unconfirmedNames.push(String(name));
    }

    if (!unconfirmedNames.length) continue;

    const teamName =
      teamSide === 'away'
        ? event.get('awayTeamName') || 'Visitante'
        : event.get('homeTeamName') || 'Mandante';
    alerts.push({
      teamSide,
      teamName,
      unconfirmedCount: unconfirmedNames.length,
      names: unconfirmedNames,
    });
  }

  return { alerts };
});

function normalizeRefereePaymentMode(value) {
  const v = String(value || '').trim();
  if (v === 'free' || v === 'split_50' || v === 'home_pays') return v;
  return 'free';
}

function refereePaymentModeLabel(mode) {
  if (mode === 'split_50') return '50% para cada presidente';
  if (mode === 'home_pays') return '100% mandante';
  return 'Arbitragem gratuita';
}

async function resolvePresidentUserIdForTeamSide(event, teamSide) {
  await event.fetchWithInclude(['homeTeam.president', 'awayTeam.president'], { useMasterKey: true });
  const team = event.get(teamSide === 'away' ? 'awayTeam' : 'homeTeam');
  const president = team && team.get ? team.get('president') : null;
  return president && president.id ? String(president.id) : '';
}

async function assertUserIsPresidentOfTeamSide(event, user, teamSide) {
  const presidentId = await resolvePresidentUserIdForTeamSide(event, teamSide);
  if (!presidentId || presidentId !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o presidente deste time pode enviar esta proposta de arbitragem.'
    );
  }
}

function mapRefereeHiringApprovalRow(invitation) {
  const event = invitation.get('event');
  const invited = invitation.get('invitedUser');
  const invitedBy = invitation.get('invitedBy');
  return {
    invitationId: invitation.id,
    eventId: event && event.id ? event.id : '',
    eventName: event && event.get ? event.get('name') || '' : '',
    eventStartTime:
      event && event.get && event.get('startTime') ? event.get('startTime').toISOString() : null,
    status: invitation.get('status') || 'pending',
    refereeHiringApprovalStatus: invitation.get('refereeHiringApprovalStatus') || '',
    refereeHiringRequestedByTeamSide: invitation.get('refereeHiringRequestedByTeamSide') || '',
    refereePaymentMode: invitation.get('refereePaymentMode') || 'free',
    refereePaymentModeLabel: refereePaymentModeLabel(invitation.get('refereePaymentMode')),
    offeredAmount: Number(invitation.get('offeredAmount') || 0),
    invitedUserId: invited && invited.id ? invited.id : '',
    invitedUserName:
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      (invited && invited.get
        ? invited.get('apelido') || invited.get('name') || invited.getUsername()
        : '') ||
      'Arbitro',
    invitedById: invitedBy && invitedBy.id ? invitedBy.id : '',
    invitedByName: invitation.get('invitedByName') || 'Presidente',
    responseDeadline:
      invitation.get('responseDeadline') && invitation.get('responseDeadline').toISOString
        ? invitation.get('responseDeadline').toISOString()
        : null,
  };
}

Parse.Cloud.define('createTeamMatchRefereeHiringInvitation', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const eventId = String(request.params.eventId || '').trim();
  const invitedUserId = String(request.params.invitedUserId || '').trim();
  const requestedByTeamSide =
    request.params.requestedByTeamSide === 'away' ? 'away' : request.params.requestedByTeamSide === 'home' ? 'home' : '';
  const refereePaymentMode = normalizeRefereePaymentMode(request.params.refereePaymentMode);
  const offeredAmount = Number(request.params.offeredAmount ?? 0);
  const responseDeadlineRaw = request.params.responseDeadline;
  const responseDeadline = responseDeadlineRaw ? new Date(responseDeadlineRaw) : null;

  if (!eventId || !invitedUserId || !requestedByTeamSide) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe evento, arbitro e time proponente.');
  }
  if (offeredAmount < 0) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe um valor valido.');
  }
  if (!responseDeadline || Number.isNaN(responseDeadline.getTime()) || responseDeadline <= new Date()) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe prazo valido para resposta.');
  }

  const event = await new Parse.Query('Event')
    .include('homeTeam.president')
    .include('awayTeam.president')
    .get(eventId, { useMasterKey: true });
  if (event.get('type') !== 'team_match') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Disponivel apenas para confrontos.');
  }
  if (event.get('isFinished')) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Evento ja encerrado.');
  }

  await assertUserIsPresidentOfTeamSide(event, user, requestedByTeamSide);

  const oppositeSide = requestedByTeamSide === 'home' ? 'away' : 'home';
  const approverUserId = await resolvePresidentUserIdForTeamSide(event, oppositeSide);
  if (!approverUserId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Presidente adversario nao encontrado.');
  }

  const invitedUser = Parse.User.createWithoutData(invitedUserId);
  const duplicate = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', invitedUser)
    .equalTo('role', 'referee')
    .containedIn('status', ['pending', 'accepted'])
    .first({ useMasterKey: true });
  if (duplicate) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Este arbitro ja possui convite ativo neste confronto.');
  }

  const invitation = new Parse.Object('RefereeInvitation');
  invitation.set('event', event);
  invitation.set('invitedUser', invitedUser);
  invitation.set('invitedBy', user);
  invitation.set('role', 'referee');
  invitation.set('status', 'pending');
  invitation.set('offeredAmount', offeredAmount);
  invitation.set('responseDeadline', responseDeadline);
  invitation.set('refereeHiringRequestedByTeamSide', requestedByTeamSide);
  invitation.set('refereeHiringApprovalStatus', 'pending');
  invitation.set('refereeHiringApproverUserId', approverUserId);
  invitation.set('refereePaymentMode', refereePaymentMode);
  invitation.set('presenceConfirmed', false);
  invitation.set('paymentConfirmedByAdmin', false);
  invitation.set('paymentConfirmedByReferee', false);
  invitation.set('workCompleted', false);
  invitation.set('paymentReleased', false);
  invitation.set('excusedFault', false);

  if (request.params.invitedUserApelido) {
    invitation.set('invitedUserApelido', String(request.params.invitedUserApelido));
  }
  if (request.params.invitedUserFullName) {
    invitation.set('invitedUserFullName', String(request.params.invitedUserFullName));
  }
  if (request.params.invitedUserAvatarUrl) {
    invitation.set('invitedUserAvatarUrl', String(request.params.invitedUserAvatarUrl));
  }

  const inviterApelido = (user.get('apelido') || '').trim();
  const inviterFullName = (user.get('name') || '').trim();
  invitation.set('invitedByName', inviterApelido || inviterFullName || user.getUsername() || 'Presidente');
  if (inviterApelido) invitation.set('invitedByApelido', inviterApelido);
  if (inviterFullName) invitation.set('invitedByFullName', inviterFullName);

  const saved = await invitation.save(null, { useMasterKey: true });

  try {
    await sendPushToUser(approverUserId, {
      title: 'Aprovar arbitragem',
      alert:
        (invitation.get('invitedByName') || 'O outro time') +
        ' propôs contratar um arbitro para o confronto. Toque para aprovar ou recusar.',
      data: {
        type: 'team_match_referee_hiring_approval',
        invitationId: saved.id,
        eventId: event.id,
      },
    });
  } catch (error) {
    console.error('createTeamMatchRefereeHiringInvitation push failed', error);
  }

  if (typeof createAppMessage === 'function') {
    const refereeName =
      invitation.get('invitedUserApelido') ||
      invitation.get('invitedUserFullName') ||
      'um arbitro';
    await createAppMessage({
      recipientId: approverUserId,
      senderId: user.id,
      kind: 'team_match_referee_hiring_approval',
      title: 'Aprovar contratacao de arbitro',
      body:
        `${invitation.get('invitedByName') || 'O outro time'} propos contratar ${refereeName} ` +
        `para "${event.get('name') || 'o confronto'}". Pagamento: ` +
        `${refereePaymentModeLabel(refereePaymentMode)}. Aprove ou recuse na Entrada.`,
      relatedClass: 'RefereeInvitation',
      relatedId: saved.id,
      actionRoute: '/inbox',
    });
  }

  return mapRefereeHiringApprovalRow(saved);
});

Parse.Cloud.define('respondTeamMatchRefereeHiringApproval', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const invitationId = String(request.params.invitationId || '').trim();
  const decision = request.params.decision === 'approved' ? 'approved' : 'rejected';
  if (!invitationId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o convite.');
  }

  const invitation = await new Parse.Query('RefereeInvitation')
    .include('event')
    .include('invitedUser')
    .include('invitedBy')
    .get(invitationId, { useMasterKey: true });

  if (invitation.get('role') !== 'referee') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Convite invalido.');
  }
  const approverId = String(invitation.get('refereeHiringApproverUserId') || '');
  if (approverId !== user.id) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Voce nao pode responder esta aprovacao.');
  }
  if (invitation.get('refereeHiringApprovalStatus') !== 'pending') {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Esta aprovacao ja foi respondida.');
  }

  invitation.set('refereeHiringApprovalStatus', decision);
  invitation.set('refereeHiringRespondedAt', new Date());

  const event = invitation.get('event');
  const invitedUser = invitation.get('invitedUser');
  const invitedBy = invitation.get('invitedBy');

  if (decision === 'rejected') {
    invitation.set('status', 'declined');
    invitation.set('responseAt', new Date());
    await invitation.save(null, { useMasterKey: true });
    if (invitedBy && invitedBy.id) {
      try {
        await sendPushToUser(invitedBy.id, {
          title: 'Arbitragem recusada',
          alert:
            'O presidente adversario nao concordou com a contratacao do arbitro. Envie uma nova proposta.',
          data: {
            type: 'team_match_referee_hiring_rejected',
            invitationId: invitation.id,
            eventId: event && event.id ? event.id : '',
          },
        });
      } catch (error) {
        console.error('respondTeamMatchRefereeHiringApproval reject push failed', error);
      }

      if (typeof createAppMessage === 'function') {
        await createAppMessage({
          recipientId: invitedBy.id,
          senderId: user.id,
          kind: 'team_match_referee_hiring_rejected',
          title: 'Arbitragem recusada pelo adversario',
          body:
            'O presidente adversario nao concordou com a contratacao do arbitro em ' +
            `"${(event && event.get && event.get('name')) || 'o confronto'}". ` +
            'Envie uma nova proposta no confronto.',
          relatedClass: 'RefereeInvitation',
          relatedId: invitation.id,
          actionRoute: event && event.id ? `/event/${event.id}` : '/inbox',
        });
      }
    }
    return mapRefereeHiringApprovalRow(invitation);
  }

  await invitation.save(null, { useMasterKey: true });

  if (invitedUser && invitedUser.id) {
    try {
      await sendPushToUser(invitedUser.id, {
        title: 'Convite de arbitragem',
        alert:
          'Voce foi convidado para arbitrar um confronto entre times. Toque para ver o convite.',
        data: {
          type: 'hiring_invite',
          invitationId: invitation.id,
          eventId: event && event.id ? event.id : '',
        },
      });
    } catch (error) {
      console.error('respondTeamMatchRefereeHiringApproval approve push failed', error);
    }

    if (typeof createAppMessage === 'function') {
      const dateLabel =
        typeof formatEventPushDate === 'function' && event && event.get
          ? formatEventPushDate(event.get('startTime'))
          : '';
      await createAppMessage({
        recipientId: invitedUser.id,
        senderId: invitedBy && invitedBy.id ? invitedBy.id : '',
        kind: 'hiring_invite',
        title: 'Convite para arbitrar confronto',
        body:
          `Os dois presidentes aprovaram sua arbitragem em "${(event && event.get && event.get('name')) || 'um confronto'}"` +
          (dateLabel ? ` (${dateLabel}).` : '.') +
          ' Aceite ou recuse o convite na Entrada.',
        relatedClass: 'RefereeInvitation',
        relatedId: invitation.id,
        actionRoute: '/inbox',
      });
    }
  }

  return mapRefereeHiringApprovalRow(invitation);
});

Parse.Cloud.define('listTeamMatchRefereeHiringApprovals', async (request) => {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const mailbox = request.params.mailbox === 'out' ? 'out' : 'in';

  if (mailbox === 'in') {
    const rows = await new Parse.Query('RefereeInvitation')
      .equalTo('refereeHiringApproverUserId', user.id)
      .equalTo('refereeHiringApprovalStatus', 'pending')
      .equalTo('role', 'referee')
      .include('event')
      .include('invitedUser')
      .include('invitedBy')
      .descending('createdAt')
      .limit(40)
      .find({ useMasterKey: true });
    return rows.map(mapRefereeHiringApprovalRow);
  }

  const rows = await new Parse.Query('RefereeInvitation')
    .equalTo('invitedBy', user)
    .equalTo('role', 'referee')
    .exists('refereeHiringApprovalStatus')
    .containedIn('refereeHiringApprovalStatus', ['pending', 'rejected'])
    .include('event')
    .include('invitedUser')
    .include('invitedBy')
    .descending('createdAt')
    .limit(40)
    .find({ useMasterKey: true });
  return rows.map(mapRefereeHiringApprovalRow);
});

Parse.Cloud.beforeSave('RefereeInvitation', async (request) => {
  const invitation = request.object;
  if (!invitation || !invitation.id) return;
  if (!invitation.dirty('status')) return;
  const nextStatus = invitation.get('status');
  if (nextStatus !== 'accepted') return;

  const eventPtr = invitation.get('event');
  if (!eventPtr || !eventPtr.id) return;
  let event = eventPtr;
  if (!event.get || !event.get('type')) {
    event = await new Parse.Query('Event').get(eventPtr.id, { useMasterKey: true });
  }
  if (event.get('type') !== 'team_match' || invitation.get('role') !== 'referee') return;

  const approval = invitation.get('refereeHiringApprovalStatus');
  if (approval && approval !== 'approved') {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Este convite de arbitro ainda aguarda aprovacao do presidente adversario.'
    );
  }
});

// --- 17-team-match-stats.js ---

/** Estatisticas de confrontos (times e usuarios) */

function teamMatchWinRatePercent(wins, draws, played) {
  if (!played || played <= 0) return 0;
  return Math.round(((wins * 3 + draws) / (played * 3)) * 1000) / 10;
}

async function eventCountsForTeamMatchRanking(event) {
  if (event.get('isFinished')) return true;
  const start = event.get('startTime');
  if (!start || start > new Date()) return false;
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      const actual = await buildEventActualPredictionResults(event);
      return !!(actual && actual.ready);
    }
  } catch {
    return false;
  }
  return false;
}

async function loadFinishedTeamMatchEventsForTeam(teamId, limit) {
  const teamPtr = Parse.Object.extend('AmateurTeam').createWithoutData(teamId);
  const homeQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('homeTeam', teamPtr);
  const awayQ = new Parse.Query('Event').equalTo('type', 'team_match').equalTo('awayTeam', teamPtr);
  const cap = Math.min(Math.max(Number(limit) || 500, 1), 500);
  const candidates = await Parse.Query.or(homeQ, awayQ)
    .lessThan('startTime', new Date())
    .descending('startTime')
    .limit(cap)
    .find({ useMasterKey: true });
  const events = [];
  for (const event of candidates) {
    if (await eventCountsForTeamMatchRanking(event)) {
      events.push(event);
    }
  }
  return events;
}

async function teamMatchResultForTeam(event, teamId) {
  let actual = { ready: false, homeScore: 0, awayScore: 0 };
  try {
    if (typeof buildEventActualPredictionResults === 'function') {
      actual = await buildEventActualPredictionResults(event);
    }
  } catch {
    return null;
  }
  if (!event.get('isFinished') && (!actual || actual.ready === false)) {
    return null;
  }
  const isHome = event.get('homeTeam') && event.get('homeTeam').id === teamId;
  const teamScore = isHome ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
  const oppScore = isHome ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
  if (teamScore > oppScore) return 'W';
  if (teamScore < oppScore) return 'L';
  return 'D';
}

async function computeAmateurTeamMatchRecord(teamId, limit) {
  const events = await loadFinishedTeamMatchEventsForTeam(teamId, limit);
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const event of events) {
    const r = await teamMatchResultForTeam(event, teamId);
    if (r === 'W') wins += 1;
    else if (r === 'L') losses += 1;
    else if (r === 'D') draws += 1;
  }
  const played = wins + losses + draws;
  return {
    matchesPlayed: played,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, played),
  };
}

async function resolveCoachTeamSideForStats(event, userId, reg) {
  const explicit = reg && reg.get ? reg.get('teamSide') : '';
  if (explicit === 'home' || explicit === 'away') return explicit;
  const invitation = await new Parse.Query('RefereeInvitation')
    .equalTo('event', event)
    .equalTo('invitedUser', Parse.User.createWithoutData(userId))
    .equalTo('role', 'coach')
    .equalTo('status', 'accepted')
    .descending('createdAt')
    .first({ useMasterKey: true });
  const invSide = invitation ? invitation.get('teamSide') : '';
  if (invSide === 'home' || invSide === 'away') return invSide;
  const invitedBy =
    (invitation && invitation.get('invitedBy')) || (reg && reg.get && reg.get('invitedBy')) || null;
  if (!invitedBy || !invitedBy.id) return '';
  const matches = [];
  for (const side of ['home', 'away']) {
    let team = event.get(side === 'away' ? 'awayTeam' : 'homeTeam');
    if (!team || !team.id) continue;
    let president = team.get ? team.get('president') : null;
    if (!president) {
      try {
        team = await new Parse.Query('AmateurTeam').get(team.id, { useMasterKey: true });
        president = team.get('president');
      } catch {
        president = null;
      }
    }
    if (president && president.id === invitedBy.id) matches.push(side);
  }
  return matches.length === 1 ? matches[0] : '';
}

async function computeUserTeamMatchRecord(userId, roleContext) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regQuery = new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .containedIn('role', roleContext === 'coach' ? ['coach'] : ['athlete', 'goalkeeper'])
    .limit(500);
  const registrations = await regQuery.find({ useMasterKey: true });
  if (!registrations.length) {
    return { matchesPlayed: 0, wins: 0, losses: 0, draws: 0, winRatePercent: 0 };
  }

  const eventIds = [...new Set(registrations.map((r) => r.get('event') && r.get('event').id).filter(Boolean))];
  const events = [];
  for (let i = 0; i < eventIds.length; i += 50) {
    const batch = eventIds.slice(i, i + 50);
    const q = new Parse.Query('Event');
    q.containedIn('objectId', batch);
    q.equalTo('type', 'team_match');
    q.lessThan('startTime', new Date());
    events.push(...(await q.find({ useMasterKey: true })));
  }
  const eventById = new Map(events.map((e) => [e.id, e]));
  const regByEvent = new Map();
  for (const reg of registrations) {
    const ev = reg.get('event');
    if (!ev || !ev.id) continue;
    regByEvent.set(ev.id, reg);
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const [eventId, reg] of regByEvent.entries()) {
    const event = eventById.get(eventId);
    if (!event) continue;
    if (!(await eventCountsForTeamMatchRanking(event))) continue;
    const participationFee = Number(event.get('participationFee') || 0);
    if (!computeRegistrationEffectiveConfirmation(reg, participationFee)) continue;

    if (roleContext === 'athlete') {
      const role = reg.get('role');
      let athlete = reg.get('athlete');
      if (athlete && !athlete.get && athlete.id) {
        try {
          athlete = await new Parse.Query('AthleteProfile').get(athlete.id, { useMasterKey: true });
        } catch {
          athlete = null;
        }
      }
      const pos = athlete && athlete.get ? String(athlete.get('primaryPosition') || '') : '';
      const isGk =
        role === 'goalkeeper' ||
        (typeof isGoalkeeperPosition === 'function'
          ? isGoalkeeperPosition(pos)
          : String(pos).trim().toLowerCase() === 'goleiro');
      // Top rankings excluem goleiros; record inclui todos os atletas confirmados.
    }

    const side =
      roleContext === 'coach'
        ? await resolveCoachTeamSideForStats(event, userId, reg)
        : reg.get('teamSide');
    if (side !== 'home' && side !== 'away') continue;

    let actual = { ready: false, homeScore: 0, awayScore: 0 };
    try {
      if (typeof buildEventActualPredictionResults === 'function') {
        actual = await buildEventActualPredictionResults(event);
      }
    } catch {
      continue;
    }
    if (!event.get('isFinished') && (!actual || actual.ready === false)) {
      continue;
    }
    const teamScore = side === 'home' ? Number(actual.homeScore || 0) : Number(actual.awayScore || 0);
    const oppScore = side === 'home' ? Number(actual.awayScore || 0) : Number(actual.homeScore || 0);
    if (teamScore > oppScore) wins += 1;
    else if (teamScore < oppScore) losses += 1;
    else draws += 1;
  }

  const played = wins + losses + draws;
  return {
    matchesPlayed: played,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, played),
  };
}

Parse.Cloud.define('getUserTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id || '').trim();
  const roleContext = request.params.roleContext === 'coach' ? 'coach' : 'athlete';
  if (!userId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o usuario.');
  }
  return computeUserTeamMatchRecord(userId, roleContext);
});

Parse.Cloud.define('getPresidentTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const userId = String(request.params.userId || request.user.id || '').trim();
  if (!userId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o usuario.');
  }
  const president = Parse.User.createWithoutData(userId);
  const teams = await new Parse.Query('AmateurTeam')
    .equalTo('president', president)
    .limit(20)
    .find({ useMasterKey: true });
  let matchesPlayed = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const team of teams) {
    const row = await computeAmateurTeamMatchRecord(team.id, 500);
    matchesPlayed += row.matchesPlayed;
    wins += row.wins;
    losses += row.losses;
    draws += row.draws;
  }
  return {
    matchesPlayed,
    wins,
    losses,
    draws,
    winRatePercent: teamMatchWinRatePercent(wins, draws, matchesPlayed),
    teamsPresided: teams.length,
  };
});

Parse.Cloud.define('getAmateurTeamMatchRecord', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }
  const teamId = String(request.params.teamId || '').trim();
  if (!teamId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe o time.');
  }
  return computeAmateurTeamMatchRecord(teamId, 500);
});

function incrementLocationBucket(map, key, label) {
  if (!key) return;
  const current = map.get(key) || { key, label, count: 0 };
  current.count += 1;
  map.set(key, current);
}

function buildEventLocationStats(events) {
  const byState = new Map();
  const byCity = new Map();
  const byNeighborhood = new Map();
  for (const event of events) {
    const address = event.get('address') || {};
    let state = String(address.state || address.uf || '').trim().toUpperCase();
    if (state === 'FE') state = 'DF';
    const city = String(address.city || '').trim();
    const neighborhood = String(address.neighborhood || address.district || '').trim();
    incrementLocationBucket(byState, state, state || '—');
    const cityKey = state && city ? `${state}|${city}` : city;
    incrementLocationBucket(byCity, cityKey, city ? `${city}${state ? ' - ' + state : ''}` : '—');
    const nbKey = cityKey && neighborhood ? `${cityKey}|${neighborhood}` : neighborhood;
    incrementLocationBucket(byNeighborhood, nbKey, neighborhood || '—');
  }
  const sortDesc = (entries) => entries.sort((a, b) => b.count - a.count);
  return {
    byState: sortDesc(Array.from(byState.values())),
    byCity: sortDesc(Array.from(byCity.values())),
    byNeighborhood: sortDesc(Array.from(byNeighborhood.values())),
  };
}

function teamMatchStandingPoints(wins, draws) {
  return Number(wins || 0) * 3 + Number(draws || 0);
}

function sliceTopRankWithTies(sorted, topN, scoreKey = 'combinedScore') {
  if (!sorted.length) return [];
  if (sorted.length <= topN) return sorted;
  const threshold = sorted[topN - 1][scoreKey];
  return sorted.filter((row) => (row[scoreKey] || 0) >= threshold);
}

async function enrichTopTeamRankEntries(entries) {
  const out = [];
  for (const entry of entries) {
    try {
      const team = await new Parse.Query('AmateurTeam')
        .include('president')
        .get(entry.teamId, { useMasterKey: true });
      const president = team.get('president');
      const shieldImage = team.get('shieldImage');
      let presidentAvatarUrl;
      let presidentName = '';
      if (president && president.get) {
        presidentName =
          president.get('apelido') || president.get('name') || president.getUsername() || '';
        if (typeof resolveStoredAvatarUrl === 'function') {
          presidentAvatarUrl = resolveStoredAvatarUrl(president) || undefined;
        } else {
          presidentAvatarUrl = (president.get('avatarUrl') || '').trim() || undefined;
        }
      }
      out.push({
        ...entry,
        teamName: team.get('name') || entry.teamName || 'Time',
        shieldImageUrl: shieldImage && shieldImage.url ? shieldImage.url() : undefined,
        foundedAt: team.get('foundedAt') ? team.get('foundedAt').toISOString() : null,
        homeVenue: team.get('homeVenue') || '',
        presidentId: president && president.id ? president.id : '',
        presidentName,
        presidentAvatarUrl,
      });
    } catch {
      out.push(entry);
    }
  }
  return out;
}

async function countAmateurTeamsCoached(userId) {
  const userPtr = Parse.User.createWithoutData(userId);
  const regs = await new Parse.Query('EventRegistration')
    .equalTo('user', userPtr)
    .equalTo('role', 'coach')
    .limit(2000)
    .find({ useMasterKey: true });
  const teamIds = new Set();
  for (const reg of regs) {
    let event = reg.get('event');
    if (!event || !event.id) continue;
    if (!event.get || !event.get('type')) {
      try {
        event = await new Parse.Query('Event').get(event.id, { useMasterKey: true });
      } catch {
        continue;
      }
    }
    if (event.get('type') !== 'team_match') continue;
    const side = await resolveCoachTeamSideForStats(event, userId, reg);
    if (side !== 'home' && side !== 'away') continue;
    const home = event.get('homeTeam');
    const away = event.get('awayTeam');
    const tid =
      side === 'home' && home && home.id
        ? home.id
        : side === 'away' && away && away.id
          ? away.id
          : null;
    if (tid) teamIds.add(String(tid));
  }
  return teamIds.size;
}

async function buildTopTeamsByMatchPoints(topN = 10) {
  const teams = await new Parse.Query('AmateurTeam').limit(300).find({ useMasterKey: true });
  const teamRecords = [];
  for (const team of teams) {
    const record = await computeAmateurTeamMatchRecord(team.id, 500);
    if (!record.matchesPlayed) continue;
    const points = teamMatchStandingPoints(record.wins, record.draws);
    teamRecords.push({
      teamId: team.id,
      teamName: team.get('name') || 'Time',
      ...record,
      combinedScore: points,
      totalScore: points,
    });
  }

  teamRecords.sort((a, b) => {
    const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
    if (diff !== 0) return diff;
    return (b.winRatePercent || 0) - (a.winRatePercent || 0);
  });
  const sliced = sliceTopRankWithTies(teamRecords, topN);
  return enrichTopTeamRankEntries(sliced);
}

async function buildTopCoachesByMatchPoints(topN = 10) {
  const coachRegs = await new Parse.Query('EventRegistration')
    .equalTo('role', 'coach')
    .limit(2000)
    .find({ useMasterKey: true });
  const coachIds = new Set();
  for (const reg of coachRegs) {
    const user = reg.get('user');
    if (user && user.id) coachIds.add(String(user.id));
  }

  const entries = [];
  for (const userId of coachIds) {
    const record = await computeUserTeamMatchRecord(userId, 'coach');
    if (!record.matchesPlayed) continue;
    const points = teamMatchStandingPoints(record.wins, record.draws);
    const teamsCoachedCount = await countAmateurTeamsCoached(userId);
    entries.push({
      userId,
      userName: 'Treinador',
      role: 'coach',
      matchesPlayed: record.matchesPlayed,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws,
      winRatePercent: record.winRatePercent,
      teamsCoachedCount,
      combinedScore: points,
      totalScore: points,
    });
  }

  entries.sort((a, b) => {
    const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
    if (diff !== 0) return diff;
    return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
  });

  let slice = sliceTopRankWithTies(entries, topN);
  if (typeof enrichMuralRankingNames === 'function') {
    const enriched = await enrichMuralRankingNames('app', undefined, { coach: slice });
    slice = enriched.coach || slice;
    if (typeof loadUserAgesForRanking === 'function') {
      const ageByUserId = await loadUserAgesForRanking(slice.map((row) => row.userId));
      slice = slice.map((row) => ({
        ...row,
        age: ageByUserId.get(row.userId) || undefined,
      }));
      slice.sort((a, b) => {
        const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
        if (diff !== 0) return diff;
        return (b.age || 0) - (a.age || 0);
      });
      slice = sliceTopRankWithTies(slice, topN);
    }
  }
  return slice;
}

/* ---------- Cards de destaque da aba Confrontos ---------- */

/** Teto de confrontos considerados nos cards (os mais recentes que contam). */
const TEAM_MATCH_SPOTLIGHT_EVENT_LIMIT = 300;
const TEAM_MATCH_BEST_DEFENSE_MIN_MATCHES = 3;
const TEAM_MATCH_DEFENDER_POSITIONS = ['zagueiro', 'lateral direito', 'lateral esquerdo'];

function normalizeTeamMatchPositionLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isTeamMatchDefenderPosition(value) {
  return TEAM_MATCH_DEFENDER_POSITIONS.includes(normalizeTeamMatchPositionLabel(value));
}

function teamMatchRoundOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

/** Mesmo criterio de pontuacao de desempenho usado no mural (sem o peso 3x do confronto). */
function teamMatchPerformancePoints(perf) {
  if (typeof computeEffectivePerformanceScore === 'function') {
    return Number(computeEffectivePerformanceScore(perf, 'referee') || 0);
  }
  const stored =
    typeof computeStoredPerformancePoints === 'function' ? computeStoredPerformancePoints(perf) : 0;
  return Number(perf.get('points') || 0) + Number(stored || 0);
}

function teamMatchRefereeGoals(perf) {
  if (typeof mapPerformanceToRefereeSumula === 'function') {
    return Number(mapPerformanceToRefereeSumula(perf).goals || 0);
  }
  return Number(perf.get('refereeGoals') || 0);
}

/** Ids que ligam inscricao e desempenho (participantUserId e ponteiro user). */
function teamMatchPersonKeysFromRegistration(registration) {
  const keys = [];
  const explicit = registration.get('participantUserId');
  if (explicit) keys.push(String(explicit));
  const user = registration.get('user');
  if (user && user.id) keys.push(String(user.id));
  return keys;
}

function teamMatchPersonKeysFromPerformance(perf) {
  if (typeof collectPerformanceParticipantKeys === 'function') {
    return collectPerformanceParticipantKeys(perf);
  }
  const keys = [];
  const explicit = perf.get('participantUserId');
  if (explicit) keys.push(String(explicit));
  const user = perf.get('user');
  if (user && user.id) keys.push(String(user.id));
  return keys;
}

/**
 * Consulta por ponteiro de evento usando os objetos ja carregados.
 * createWithoutData no containedIn nao casa com o ponteiro gravado e a lista volta vazia.
 */
async function findRowsForEvents(className, events, configure) {
  const rows = [];
  const pageSize = 1000;
  for (let i = 0; i < events.length; i += 40) {
    const batch = events.slice(i, i + 40);
    let skip = 0;
    for (;;) {
      const query = new Parse.Query(className);
      query.containedIn('event', batch);
      if (configure) configure(query);
      query.limit(pageSize);
      query.skip(skip);
      const page = await query.find({ useMasterKey: true });
      rows.push(...page);
      if (page.length < pageSize) break;
      skip += page.length;
      if (skip > 8000) break;
    }
  }
  return rows;
}

/** Lados (home/away) dos atletas efetivamente confirmados, em lote por evento. */
async function loadTeamMatchSidesByEvent(events) {
  const byEvent = new Map();
  const feeByEvent = new Map();
  for (const event of events) {
    byEvent.set(String(event.id), { home: new Set(), away: new Set() });
    feeByEvent.set(String(event.id), Number(event.get('participationFee') || 0));
  }
  const registrations = await findRowsForEvents('EventRegistration', events, (query) => {
    query.containedIn('role', ['athlete', 'goalkeeper']);
  });
  for (const registration of registrations) {
    const event = registration.get('event');
    const eventId = event && event.id ? String(event.id) : '';
    const sides = byEvent.get(eventId);
    if (!sides) continue;
    const side = registration.get('teamSide');
    if (side !== 'home' && side !== 'away') continue;
    if (
      typeof computeRegistrationEffectiveConfirmation === 'function' &&
      !computeRegistrationEffectiveConfirmation(registration, feeByEvent.get(eventId) || 0)
    ) {
      continue;
    }
    for (const participantId of teamMatchPersonKeysFromRegistration(registration)) {
      sides[side].add(participantId);
    }
  }
  return byEvent;
}

async function loadTeamMatchPersonDisplayById(userIds) {
  const ids = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const users = await new Parse.Query(Parse.User)
      .containedIn('objectId', ids.slice(i, i + 100))
      .limit(100)
      .find({ useMasterKey: true });
    for (const user of users) {
      byId.set(
        user.id,
        typeof personDisplayFromUser === 'function'
          ? personDisplayFromUser(user)
          : {
              name: String(user.get('apelido') || user.get('name') || user.getUsername() || ''),
              avatarUrl: String(user.get('avatarUrl') || ''),
            }
      );
    }
  }
  return byId;
}

async function loadTeamMatchDefenderUserIds(userIds) {
  const ids = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
  const defenders = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const profiles = await new Parse.Query('AthleteProfile')
      .containedIn(
        'user',
        ids.slice(i, i + 100).map((id) => Parse.User.createWithoutData(id))
      )
      .limit(500)
      .find({ useMasterKey: true });
    for (const profile of profiles) {
      if (!isTeamMatchDefenderPosition(profile.get('primaryPosition'))) continue;
      const user = profile.get('user');
      if (user && user.id) defenders.add(String(user.id));
    }
  }
  return defenders;
}

/**
 * Agrega os confrontos ja carregados (uma unica passada) e devolve os quatro cards
 * de destaque: melhor time, maior invencibilidade, melhor ataque e melhor defesa.
 */
async function buildTeamMatchSpotlightCards(events, performanceRaw) {
  const empty = {
    teamRows: [],
    bestTeam: null,
    longestUnbeaten: null,
    bestAttack: null,
    bestDefense: null,
  };
  if (!events.length) return empty;

  const eventById = new Map(events.map((event) => [String(event.id), event]));
  const sidesByEvent = await loadTeamMatchSidesByEvent(events);

  const perfByEvent = new Map();
  for (const perf of performanceRaw || []) {
    const event = perf.get('event');
    const eventId = event && event.id ? String(event.id) : '';
    if (!eventId || !eventById.has(eventId)) continue;
    if (!perfByEvent.has(eventId)) perfByEvent.set(eventId, []);
    perfByEvent.get(eventId).push(perf);
  }

  const teams = new Map();
  const ensureTeam = (teamId, teamName) => {
    let agg = teams.get(teamId);
    if (!agg) {
      agg = {
        teamId,
        teamName: teamName || 'Time',
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        matches: [],
        goalsByUser: new Map(),
        pointsByUser: new Map(),
      };
      teams.set(teamId, agg);
    }
    if (!agg.teamName && teamName) agg.teamName = teamName;
    return agg;
  };

  // events ja vem do mais recente para o mais antigo (descending startTime).
  for (const event of events) {
    const home = event.get('homeTeam');
    const away = event.get('awayTeam');
    const homeId = home && home.id ? String(home.id) : '';
    const awayId = away && away.id ? String(away.id) : '';
    if (!homeId && !awayId) continue;

    const sides = sidesByEvent.get(String(event.id)) || { home: new Set(), away: new Set() };
    const score = { home: 0, away: 0 };
    const goalsBySide = { home: new Map(), away: new Map() };
    const pointsBySide = { home: new Map(), away: new Map() };

    for (const perf of perfByEvent.get(String(event.id)) || []) {
      const keys = teamMatchPersonKeysFromPerformance(perf);
      if (!keys.length) continue;
      const side = keys.some((key) => sides.home.has(key))
        ? 'home'
        : keys.some((key) => sides.away.has(key))
          ? 'away'
          : '';
      if (!side) continue;
      const participantId =
        keys.find((key) => (side === 'home' ? sides.home.has(key) : sides.away.has(key))) ||
        keys[0];

      // Placar do confronto = soma dos refereeGoals por lado (mesma regra da sumula).
      const goals = teamMatchRefereeGoals(perf);
      if (goals > 0) {
        score[side] += goals;
        goalsBySide[side].set(participantId, (goalsBySide[side].get(participantId) || 0) + goals);
      }
      const points = teamMatchPerformancePoints(perf);
      if (points) {
        pointsBySide[side].set(participantId, (pointsBySide[side].get(participantId) || 0) + points);
      }
    }

    const startTime = event.get('startTime') || null;
    const applySide = (teamId, teamName, side) => {
      if (!teamId) return;
      const scored = side === 'home' ? score.home : score.away;
      const conceded = side === 'home' ? score.away : score.home;
      const agg = ensureTeam(teamId, teamName);
      agg.matchesPlayed += 1;
      agg.goalsFor += scored;
      agg.goalsAgainst += conceded;
      if (scored > conceded) agg.wins += 1;
      else if (scored < conceded) agg.losses += 1;
      else agg.draws += 1;
      agg.matches.push({
        result: scored > conceded ? 'W' : scored < conceded ? 'L' : 'D',
        startTime,
      });
      for (const [userId, goals] of goalsBySide[side].entries()) {
        agg.goalsByUser.set(userId, (agg.goalsByUser.get(userId) || 0) + goals);
      }
      for (const [userId, points] of pointsBySide[side].entries()) {
        agg.pointsByUser.set(userId, (agg.pointsByUser.get(userId) || 0) + points);
      }
    };

    applySide(homeId, event.get('homeTeamName') || '', 'home');
    applySide(awayId, event.get('awayTeamName') || '', 'away');
  }

  const rows = Array.from(teams.values());
  if (!rows.length) return empty;

  const withRate = rows.map((row) => ({
    ...row,
    winRatePercent: teamMatchWinRatePercent(row.wins, row.draws, row.matchesPlayed),
  }));

  // 1) Melhor time: mais confrontos realizados; empate pelo maior aproveitamento.
  const bestTeamRow =
    [...withRate].sort((a, b) => {
      const diff = b.matchesPlayed - a.matchesPlayed;
      if (diff !== 0) return diff;
      return b.winRatePercent - a.winRatePercent;
    })[0] || null;

  // 2) Maior invencibilidade: mesma regra de buildUnbeatenSummary (15-amateur-teams.js).
  const now = new Date();
  let longestUnbeatenRow = null;
  for (const row of withRate) {
    const streak = [];
    for (const match of row.matches) {
      if (match.result === 'L') break;
      streak.push(match);
    }
    if (!streak.length) continue;
    const since = streak[streak.length - 1].startTime
      ? new Date(streak[streak.length - 1].startTime)
      : now;
    const summary =
      typeof buildUnbeatenSummary === 'function'
        ? buildUnbeatenSummary(row.matches, now)
        : { unbeatenFor: '' };
    const candidate = {
      row,
      matchesInStreak: streak.length,
      sinceStartTime: since,
      unbeatenDays: Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86400000)),
      unbeatenLabel: summary.unbeatenFor || '',
    };
    if (
      !longestUnbeatenRow ||
      candidate.matchesInStreak > longestUnbeatenRow.matchesInStreak ||
      (candidate.matchesInStreak === longestUnbeatenRow.matchesInStreak &&
        candidate.unbeatenDays > longestUnbeatenRow.unbeatenDays)
    ) {
      longestUnbeatenRow = candidate;
    }
  }

  // 3) Melhor ataque: mais gols feitos.
  const bestAttackRow =
    [...withRate].sort((a, b) => {
      const diff = b.goalsFor - a.goalsFor;
      if (diff !== 0) return diff;
      const perMatch =
        (b.goalsFor / (b.matchesPlayed || 1)) - (a.goalsFor / (a.matchesPlayed || 1));
      if (perMatch !== 0) return perMatch;
      return b.matchesPlayed - a.matchesPlayed;
    })[0] || null;

  // 4) Melhor defesa: menos gols sofridos, com minimo de confrontos para evitar quem jogou uma vez.
  const maxPlayed = withRate.reduce((max, row) => Math.max(max, row.matchesPlayed), 0);
  const minMatches = Math.max(1, Math.min(TEAM_MATCH_BEST_DEFENSE_MIN_MATCHES, maxPlayed));
  const defenseCandidates = withRate.filter((row) => row.matchesPlayed >= minMatches);
  const bestDefenseRow =
    [...defenseCandidates].sort((a, b) => {
      const diff = a.goalsAgainst - b.goalsAgainst;
      if (diff !== 0) return diff;
      const perMatch =
        (a.goalsAgainst / (a.matchesPlayed || 1)) - (b.goalsAgainst / (b.matchesPlayed || 1));
      if (perMatch !== 0) return perMatch;
      return b.matchesPlayed - a.matchesPlayed;
    })[0] || null;

  const selectedIds = Array.from(
    new Set(
      [
        bestTeamRow && bestTeamRow.teamId,
        longestUnbeatenRow && longestUnbeatenRow.row.teamId,
        bestAttackRow && bestAttackRow.teamId,
        bestDefenseRow && bestDefenseRow.teamId,
      ].filter(Boolean)
    )
  );
  const enriched = await enrichTopTeamRankEntries(
    selectedIds.map((teamId) => ({
      teamId,
      teamName: (teams.get(teamId) || {}).teamName || 'Time',
    }))
  );
  const enrichedById = new Map(enriched.map((entry) => [entry.teamId, entry]));
  const teamIdentity = (teamId) => {
    const entry = enrichedById.get(teamId) || {};
    return {
      teamId,
      teamName: entry.teamName || (teams.get(teamId) || {}).teamName || 'Time',
      shieldImageUrl: entry.shieldImageUrl,
      presidentId: entry.presidentId || '',
      presidentName: entry.presidentName || '',
      presidentAvatarUrl: entry.presidentAvatarUrl,
    };
  };

  // Artilheiro do melhor ataque e defensor do melhor defesa (lote unico de usuarios).
  let topScorerEntry = null;
  if (bestAttackRow) {
    const sorted = Array.from(bestAttackRow.goalsByUser.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length && sorted[0][1] > 0) {
      topScorerEntry = { userId: sorted[0][0], goals: sorted[0][1] };
    }
  }

  let topDefenderEntry = null;
  if (bestDefenseRow && bestDefenseRow.pointsByUser.size) {
    const defenderIds = await loadTeamMatchDefenderUserIds(
      Array.from(bestDefenseRow.pointsByUser.keys())
    );
    const sorted = Array.from(bestDefenseRow.pointsByUser.entries())
      .filter(([userId]) => defenderIds.has(userId))
      .sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      topDefenderEntry = { userId: sorted[0][0], points: sorted[0][1] };
    }
  }

  const personById = await loadTeamMatchPersonDisplayById([
    topScorerEntry && topScorerEntry.userId,
    topDefenderEntry && topDefenderEntry.userId,
  ]);
  const personOf = (userId) => personById.get(userId) || { name: '', avatarUrl: '' };

  return {
    teamRows: withRate.map((row) => ({
      teamId: row.teamId,
      teamName: row.teamName,
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      winRatePercent: row.winRatePercent,
    })),
    bestTeam: bestTeamRow
      ? {
          ...teamIdentity(bestTeamRow.teamId),
          matchesPlayed: bestTeamRow.matchesPlayed,
          wins: bestTeamRow.wins,
          draws: bestTeamRow.draws,
          losses: bestTeamRow.losses,
          winRatePercent: bestTeamRow.winRatePercent,
        }
      : null,
    longestUnbeaten: longestUnbeatenRow
      ? {
          ...teamIdentity(longestUnbeatenRow.row.teamId),
          unbeatenDays: longestUnbeatenRow.unbeatenDays,
          unbeatenLabel: longestUnbeatenRow.unbeatenLabel,
          matchesInStreak: longestUnbeatenRow.matchesInStreak,
          sinceStartTime: longestUnbeatenRow.sinceStartTime.toISOString(),
        }
      : null,
    bestAttack: bestAttackRow
      ? {
          ...teamIdentity(bestAttackRow.teamId),
          goalsFor: bestAttackRow.goalsFor,
          matchesPlayed: bestAttackRow.matchesPlayed,
          goalsPerMatch: teamMatchRoundOneDecimal(
            bestAttackRow.goalsFor / (bestAttackRow.matchesPlayed || 1)
          ),
          topScorer: topScorerEntry
            ? {
                userId: topScorerEntry.userId,
                name: personOf(topScorerEntry.userId).name || 'Atleta',
                avatarUrl: personOf(topScorerEntry.userId).avatarUrl || '',
                goals: topScorerEntry.goals,
                goalsPerMatch: teamMatchRoundOneDecimal(
                  topScorerEntry.goals / (bestAttackRow.matchesPlayed || 1)
                ),
              }
            : null,
        }
      : null,
    bestDefense: bestDefenseRow
      ? {
          ...teamIdentity(bestDefenseRow.teamId),
          goalsAgainst: bestDefenseRow.goalsAgainst,
          matchesPlayed: bestDefenseRow.matchesPlayed,
          goalsAgainstPerMatch: teamMatchRoundOneDecimal(
            bestDefenseRow.goalsAgainst / (bestDefenseRow.matchesPlayed || 1)
          ),
          topDefender: topDefenderEntry
            ? {
                userId: topDefenderEntry.userId,
                name: personOf(topDefenderEntry.userId).name || 'Atleta',
                avatarUrl: personOf(topDefenderEntry.userId).avatarUrl || '',
                points: teamMatchRoundOneDecimal(topDefenderEntry.points),
                pointsPerMatch: teamMatchRoundOneDecimal(
                  topDefenderEntry.points / (bestDefenseRow.matchesPlayed || 1)
                ),
              }
            : null,
        }
      : null,
  };
}

Parse.Cloud.define('getMuralTeamMatchDashboard', async (request) => {
  if (!request.user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login.');
  }

  const locationFilter =
    typeof normalizeMuralLocationFilter === 'function'
      ? normalizeMuralLocationFilter(request.params)
      : { state: '', city: '', neighborhood: '', active: false };

  const candidateQuery = new Parse.Query('Event')
    .equalTo('type', 'team_match')
    .lessThan('startTime', new Date())
    .descending('startTime')
    .limit(500);
  if (locationFilter.active && typeof applyMuralLocationFilterToEventQuery === 'function') {
    candidateQuery.exists('address');
    applyMuralLocationFilterToEventQuery(candidateQuery, locationFilter);
  }
  const candidateEvents = await candidateQuery.find({ useMasterKey: true });
  const finishedEvents = [];
  for (const event of candidateEvents) {
    if (await eventCountsForTeamMatchRanking(event)) {
      finishedEvents.push(event);
    }
  }

  const totalConfrontos = finishedEvents.length;
  const locationStats = buildEventLocationStats(finishedEvents);

  const spotlightEvents = finishedEvents.slice(0, TEAM_MATCH_SPOTLIGHT_EVENT_LIMIT);
  const performanceRaw = await findRowsForEvents('EventPerformance', spotlightEvents);

  const spotlight = await buildTeamMatchSpotlightCards(spotlightEvents, performanceRaw);

  let teamRecords;
  if (locationFilter.active) {
    // Com recorte de regiao os registros vem da agregacao dos confrontos filtrados.
    teamRecords = spotlight.teamRows;
  } else {
    const teams = await new Parse.Query('AmateurTeam').limit(300).find({ useMasterKey: true });
    teamRecords = [];
    for (const team of teams) {
      const record = await computeAmateurTeamMatchRecord(team.id, 500);
      if (!record.matchesPlayed) continue;
      teamRecords.push({
        teamId: team.id,
        teamName: team.get('name') || 'Time',
        ...record,
      });
    }
  }

  const pickTeamExtreme = (field, preferHigh) => {
    const sorted = [...teamRecords].sort((a, b) =>
      preferHigh ? b[field] - a[field] : a[field] - b[field]
    );
    return sorted[0] || null;
  };

  const teamHighlights = {
    mostMatches: pickTeamExtreme('matchesPlayed', true),
    mostWins: pickTeamExtreme('wins', true),
    mostLosses: pickTeamExtreme('losses', true),
    mostDraws: pickTeamExtreme('draws', true),
    bestWinRate: [...teamRecords].sort((a, b) => b.winRatePercent - a.winRatePercent)[0] || null,
  };

  const performanceRows =
    typeof mapPerformanceRowsForMural === 'function'
      ? await mapPerformanceRowsForMural('app', undefined, performanceRaw)
      : [];
  const teamMatchPerfRows =
    typeof normalizePerformanceScoresForBucket === 'function'
      ? normalizePerformanceScoresForBucket(performanceRows, 'teamMatch')
      : performanceRows;

  const voteRows =
    typeof mapMuralVoteRowsForScope === 'function'
      ? await mapMuralVoteRowsForScope('app', undefined, locationFilter)
      : [];
  const teamMatchVoteRows =
    typeof filterVoteRowsByEventBucket === 'function' && typeof unweightVoteRows === 'function'
      ? unweightVoteRows(filterVoteRowsByEventBucket(voteRows, 'teamMatch'))
      : voteRows;

  let rankingsTeamMatch =
    typeof buildPeladaMuralRankings === 'function'
      ? buildPeladaMuralRankings(teamMatchPerfRows, teamMatchVoteRows, 10)
      : { athlete: [], goalkeeper: [], referee: [] };
  if (typeof enrichMuralRankingNames === 'function') {
    rankingsTeamMatch = await enrichMuralRankingNames('app', undefined, rankingsTeamMatch);
  }
  if (typeof finalizeEventGoalkeeperRankings === 'function') {
    rankingsTeamMatch = await finalizeEventGoalkeeperRankings(rankingsTeamMatch);
  }

  const topAthletes = (rankingsTeamMatch.athlete || []).slice(0, 10);
  const topGoalkeepers = (rankingsTeamMatch.goalkeeper || []).slice(0, 10);
  const topReferees = (rankingsTeamMatch.referee || []).slice(0, 10);

  const topScorers =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'goals', 10)
      : [];
  const topAssists =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'assists', 10)
      : [];
  const topPasses =
    typeof buildPerformanceTopEntries === 'function'
      ? buildPerformanceTopEntries(performanceRaw, 'passesCompleted', 10)
      : [];

  let topTeams = [];
  if (locationFilter.active) {
    // Reaproveita a agregacao filtrada em vez de varrer todos os times do app.
    const ranked = teamRecords
      .map((row) => ({
        ...row,
        combinedScore: teamMatchStandingPoints(row.wins, row.draws),
        totalScore: teamMatchStandingPoints(row.wins, row.draws),
      }))
      .sort((a, b) => {
        const diff = (b.combinedScore || 0) - (a.combinedScore || 0);
        if (diff !== 0) return diff;
        return (b.winRatePercent || 0) - (a.winRatePercent || 0);
      });
    topTeams = await enrichTopTeamRankEntries(sliceTopRankWithTies(ranked, 10));
  } else if (typeof buildTopTeamsByMatchPoints === 'function') {
    topTeams = await buildTopTeamsByMatchPoints(10);
  }
  const topCoaches =
    typeof buildTopCoachesByMatchPoints === 'function' ? await buildTopCoachesByMatchPoints(10) : [];

  return {
    totalConfrontos,
    locationStats,
    teamHighlights,
    topAthletes,
    topGoalkeepers,
    topReferees,
    topScorers,
    topAssists,
    topPasses,
    topTeams,
    topCoaches,
    appliedLocation: {
      state: locationFilter.state,
      city: locationFilter.city,
      neighborhood: locationFilter.neighborhood,
    },
    bestTeam: spotlight.bestTeam,
    longestUnbeaten: spotlight.longestUnbeaten,
    bestAttack: spotlight.bestAttack,
    bestDefense: spotlight.bestDefense,
  };
});

// --- 18-app-mailbox.js ---

/**
 * Caixa de mensagens do app (classe AppMessage).
 *
 * Registro permanente do que o usuario recebeu (Entrada) e enviou (Saida).
 * As pendencias com botao continuam vindo das classes de origem (RefereeInvitation,
 * MatchChallenge, TeamMatchJoinRequest...) — aqui fica o historico que nao desaparece
 * quando o assunto e resolvido.
 *
 * Escrita somente pela nuvem: use createAppMessage / createAppMessages ao lado do push.
 * sendContactMessage (suporte) fica de fora. Socio de pelada e apresentacao de perfil entram aqui.
 */

const APP_MESSAGE_CLASS = 'AppMessage';
const APP_MESSAGE_LIST_DEFAULT_LIMIT = 50;
const APP_MESSAGE_LIST_MAX_LIMIT = 100;
const APP_MESSAGE_MARK_ALL_BATCH = 200;
const APP_MESSAGE_FANOUT_MAX = 300;
const APP_MESSAGE_TITLE_MAX = 140;
const APP_MESSAGE_BODY_MAX = 1000;
const APP_MESSAGE_SEARCH_MAX = 600;
const APP_MESSAGE_SYSTEM_NAME = 'Controle de Bola';

function normalizeAppMailboxText(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeAppMailboxRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appMailboxUserApelido(user) {
  if (!user || !user.get) return '';
  return String(user.get('apelido') || '').trim();
}

function appMailboxUserFullName(user) {
  if (!user || !user.get) return '';
  return String(user.get('name') || '').trim();
}

function appMailboxUserDisplayName(user) {
  const apelido = appMailboxUserApelido(user);
  if (apelido) return apelido;
  const name = appMailboxUserFullName(user);
  if (name) return name;
  if (!user || !user.get) return '';
  try {
    return String(user.getUsername() || '').trim();
  } catch {
    return '';
  }
}

function appMailboxUserAvatarUrl(user) {
  if (!user || !user.get) return '';
  if (typeof resolveUserAvatarUrl === 'function') return resolveUserAvatarUrl(user);
  return String(user.get('avatarUrl') || '').trim();
}

/** Nome + avatar dos dois lados, em lote, para o searchText. Nunca lanca. */
async function loadAppMailboxUserCards(userIds) {
  const cards = new Map();
  const ids = [
    ...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
  ];
  if (!ids.length) return cards;

  try {
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await new Parse.Query(Parse.User)
        .containedIn('objectId', ids.slice(i, i + 100))
        .select(['apelido', 'name', 'username', 'avatarUrl', 'avatar'])
        .limit(100)
        .find({ useMasterKey: true });
      for (const row of rows) {
        cards.set(row.id, {
          name: appMailboxUserDisplayName(row),
          apelido: appMailboxUserApelido(row),
          fullName: appMailboxUserFullName(row),
          avatarUrl: appMailboxUserAvatarUrl(row),
        });
      }
    }
  } catch (error) {
    console.error('loadAppMailboxUserCards failed', error);
  }

  return cards;
}

function buildAppMessageSearchText(parts) {
  const merged = (parts || [])
    .map((part) => normalizeAppMailboxText(part))
    .filter(Boolean)
    .join(' ');
  return merged.slice(0, APP_MESSAGE_SEARCH_MAX);
}

async function saveAppMessageRow(payload, cards) {
  const recipientId = String((payload && payload.recipientId) || '').trim();
  if (!recipientId) return null;

  const senderId = String((payload && payload.senderId) || '').trim();
  // Nao faz sentido guardar mensagem do usuario para ele mesmo.
  if (senderId && senderId === recipientId) return null;

  const title = String((payload && payload.title) || '')
    .trim()
    .slice(0, APP_MESSAGE_TITLE_MAX);
  const body = String((payload && payload.body) || '')
    .trim()
    .slice(0, APP_MESSAGE_BODY_MAX);
  if (!title && !body) return null;

  const recipientCard = cards ? cards.get(recipientId) : null;
  const senderCard = senderId && cards ? cards.get(senderId) : null;

  const row = new Parse.Object(APP_MESSAGE_CLASS);
  row.set('recipient', Parse.User.createWithoutData(recipientId));
  if (senderId) row.set('sender', Parse.User.createWithoutData(senderId));
  row.set('kind', String((payload && payload.kind) || 'app_message').trim().slice(0, 60));
  row.set('title', title);
  row.set('body', body);
  row.set('sentAt', new Date());
  row.set('relatedClass', String((payload && payload.relatedClass) || '').trim().slice(0, 60));
  row.set('relatedId', String((payload && payload.relatedId) || '').trim().slice(0, 60));
  row.set('actionRoute', String((payload && payload.actionRoute) || '').trim().slice(0, 200));
  row.set(
    'searchText',
    buildAppMessageSearchText([
      title,
      body,
      recipientCard ? recipientCard.apelido : '',
      recipientCard ? recipientCard.fullName : '',
      recipientCard ? recipientCard.name : '',
      senderCard ? senderCard.apelido : '',
      senderCard ? senderCard.fullName : '',
      senderCard ? senderCard.name : '',
      senderId ? '' : APP_MESSAGE_SYSTEM_NAME,
    ])
  );

  // Leitura so para os dois lados; escrita somente via Cloud (Master Key).
  const acl = new Parse.ACL();
  acl.setPublicReadAccess(false);
  acl.setPublicWriteAccess(false);
  acl.setReadAccess(recipientId, true);
  if (senderId) acl.setReadAccess(senderId, true);
  row.setACL(acl);

  await row.save(null, { useMasterKey: true });
  return row;
}

/**
 * Grava uma mensagem na caixa do destinatario.
 * Nunca lanca: a notificacao nao pode derrubar o fluxo que a chamou.
 */
async function createAppMessage(payload) {
  try {
    const recipientId = String((payload && payload.recipientId) || '').trim();
    if (!recipientId) return null;
    const senderId = String((payload && payload.senderId) || '').trim();
    if (senderId && senderId === recipientId) return null;

    const cards = await loadAppMailboxUserCards([recipientId, senderId]);
    return await saveAppMessageRow(payload, cards);
  } catch (error) {
    console.error('createAppMessage failed', error);
    return null;
  }
}

/** Mesma mensagem para varios destinatarios (nomes resolvidos em um lote). */
async function createAppMessages(recipientIds, payload) {
  try {
    const senderId = String((payload && payload.senderId) || '').trim();
    const ids = [
      ...new Set((recipientIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
    ]
      .filter((id) => id !== senderId)
      .slice(0, APP_MESSAGE_FANOUT_MAX);
    if (!ids.length) return 0;

    const cards = await loadAppMailboxUserCards([...ids, senderId]);
    let created = 0;
    for (const recipientId of ids) {
      try {
        const row = await saveAppMessageRow({ ...payload, recipientId }, cards);
        if (row) created += 1;
      } catch (error) {
        console.error('createAppMessages row failed', error);
      }
    }
    return created;
  } catch (error) {
    console.error('createAppMessages failed', error);
    return 0;
  }
}

function mapAppMessageRow(row, box) {
  const sender = row.get('sender');
  const recipient = row.get('recipient');
  const counterpart = box === 'out' ? recipient : sender;
  const counterpartApelido = appMailboxUserApelido(counterpart);
  const counterpartFullName = appMailboxUserFullName(counterpart);
  const counterpartName = appMailboxUserDisplayName(counterpart);
  const sentAt = row.get('sentAt') || row.createdAt;
  const readAt = row.get('readAt');

  return {
    objectId: row.id,
    box,
    kind: row.get('kind') || '',
    title: row.get('title') || '',
    body: row.get('body') || '',
    sentAt: sentAt instanceof Date ? sentAt.toISOString() : null,
    readAt: readAt instanceof Date ? readAt.toISOString() : null,
    unread: !readAt,
    relatedClass: row.get('relatedClass') || '',
    relatedId: row.get('relatedId') || '',
    actionRoute: row.get('actionRoute') || '',
    counterpartUserId: counterpart && counterpart.id ? counterpart.id : '',
    counterpartApelido,
    counterpartFullName,
    counterpartName:
      counterpartName || (box === 'out' ? 'Destinatario' : APP_MESSAGE_SYSTEM_NAME),
    counterpartAvatarUrl: appMailboxUserAvatarUrl(counterpart),
  };
}

/** A classe so passa a existir na 1a mensagem (ou no configure). Antes disso, caixa vazia. */
function isMissingAppMessageClassError(error) {
  const code = error && error.code;
  const message = String((error && error.message) || '');
  return code === Parse.Error.INVALID_CLASS_NAME || /class .*(does ?n'?o?t exist)/i.test(message);
}

function assertAppMailboxUser(request) {
  const user = request.user;
  if (!user) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Faca login para ver suas mensagens.');
  }
  return user;
}

Parse.Cloud.define('listAppMessages', async (request) => {
  const user = assertAppMailboxUser(request);

  const box = request.params.box === 'out' ? 'out' : 'in';
  const search = String(request.params.search || '').trim();

  const rawLimit = Number(request.params.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.trunc(rawLimit), APP_MESSAGE_LIST_MAX_LIMIT)
      : APP_MESSAGE_LIST_DEFAULT_LIMIT;

  const rawSkip = Number(request.params.skip);
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.trunc(rawSkip) : 0;

  const query = new Parse.Query(APP_MESSAGE_CLASS);
  if (box === 'out') {
    query.equalTo('sender', user);
  } else {
    query.equalTo('recipient', user);
  }

  const term = normalizeAppMailboxText(search);
  if (term) {
    query.matches('searchText', escapeAppMailboxRegExp(term), 'i');
  }

  query.include(box === 'out' ? 'recipient' : 'sender');
  query.descending('sentAt');
  query.skip(skip);
  query.limit(limit);

  let rows = [];
  try {
    rows = await query.find({ useMasterKey: true });
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return [];
  }
  return rows.map((row) => mapAppMessageRow(row, box));
});

Parse.Cloud.define('markAppMessageRead', async (request) => {
  const user = assertAppMailboxUser(request);
  const messageId = String(request.params.messageId || '').trim();
  if (!messageId) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Informe a mensagem.');
  }

  const row = await new Parse.Query(APP_MESSAGE_CLASS).get(messageId, { useMasterKey: true });
  const recipient = row.get('recipient');
  if (!recipient || recipient.id !== user.id) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Apenas o destinatario pode marcar esta mensagem como lida.'
    );
  }

  let readAt = row.get('readAt');
  if (!(readAt instanceof Date)) {
    readAt = new Date();
    row.set('readAt', readAt);
    await row.save(null, { useMasterKey: true });
  }

  return { ok: true, messageId, readAt: readAt.toISOString() };
});

Parse.Cloud.define('markAllAppMessagesRead', async (request) => {
  const user = assertAppMailboxUser(request);

  let rows = [];
  try {
    rows = await new Parse.Query(APP_MESSAGE_CLASS)
      .equalTo('recipient', user)
      .doesNotExist('readAt')
      .limit(APP_MESSAGE_MARK_ALL_BATCH)
      .find({ useMasterKey: true });
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return { ok: true, updated: 0, hasMore: false };
  }

  if (!rows.length) {
    return { ok: true, updated: 0, hasMore: false };
  }

  const readAt = new Date();
  for (const row of rows) {
    row.set('readAt', readAt);
  }
  await Parse.Object.saveAll(rows, { useMasterKey: true });

  return {
    ok: true,
    updated: rows.length,
    hasMore: rows.length === APP_MESSAGE_MARK_ALL_BATCH,
  };
});

Parse.Cloud.define('countUnreadAppMessages', async (request) => {
  const user = assertAppMailboxUser(request);

  try {
    const count = await new Parse.Query(APP_MESSAGE_CLASS)
      .equalTo('recipient', user)
      .doesNotExist('readAt')
      .count({ useMasterKey: true });
    return { count };
  } catch (error) {
    if (!isMissingAppMessageClassError(error)) throw error;
    return { count: 0 };
  }
});

Parse.Cloud.define('configureAppMailboxClassPermissions', async (request) => {
  if (!request.master && !request.user) {
    throw new Parse.Error(
      Parse.Error.OPERATION_FORBIDDEN,
      'Faca login no app ou chame com Master Key / REST API Key.'
    );
  }

  const authRead = { requiresAuthentication: true };
  const denied = {};
  const clp = {
    find: authRead,
    get: authRead,
    count: authRead,
    create: denied,
    update: denied,
    delete: denied,
    addField: denied,
    protectedFields: {},
  };

  // 1a execucao cria a classe com os campos; nas seguintes apenas o CLP e reaplicado.
  let created = false;
  try {
    const schema = new Parse.Schema(APP_MESSAGE_CLASS);
    schema.addPointer('recipient', '_User');
    schema.addPointer('sender', '_User');
    schema.addString('kind');
    schema.addString('title');
    schema.addString('body');
    schema.addDate('sentAt');
    schema.addDate('readAt');
    schema.addString('relatedClass');
    schema.addString('relatedId');
    schema.addString('actionRoute');
    schema.addString('searchText');
    schema.setCLP(clp);
    await schema.save();
    created = true;
  } catch {
    const schema = new Parse.Schema(APP_MESSAGE_CLASS);
    schema.setCLP(clp);
    await schema.update();
  }

  return {
    ok: true,
    className: APP_MESSAGE_CLASS,
    created,
    updated: !created,
    message: 'CLP atualizado para AppMessage (leitura autenticada, escrita so via Cloud).',
  };
});
