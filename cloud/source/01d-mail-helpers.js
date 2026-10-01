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
