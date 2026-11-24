export function isInvalidSessionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: number; message?: string };
  return err.code === 209 || /invalid session token/i.test(err.message ?? '');
}

export function isInvalidCloudFunctionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: number; message?: string };
  const message = err.message ?? '';
  const lower = message.toLowerCase();
  return (
    err.code === 141 ||
    /invalid function/i.test(message) ||
    lower.includes('function not found') ||
    (lower.includes('object not found') && lower.includes('function'))
  );
}

export function isCloudFunctionUnavailableError(error: unknown): boolean {
  if (isInvalidCloudFunctionError(error)) return true;
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: number; message?: string; status?: number };
  const message = (err.message ?? '').toLowerCase();
  return (
    err.status === 404 ||
    err.code === 119 ||
    err.code === 101 ||
    message.includes('object not found') ||
    message.includes('requested function')
  );
}

export type ParseErrorI18n = {
  t(key: string, params?: Record<string, string | number>): string;
};

let defaultParseErrorI18n: ParseErrorI18n | null = null;

/** Register app I18nService so parseErrorMessage works without an explicit argument. */
export function setParseErrorI18n(i18n: ParseErrorI18n | null): void {
  defaultParseErrorI18n = i18n;
}

function tr(
  i18n: ParseErrorI18n | undefined,
  key: string,
  params?: Record<string, string | number>
): string {
  const svc = i18n ?? defaultParseErrorI18n;
  return svc ? svc.t(key, params) : key;
}

/** Mensagens de validação em services (usa I18nService registrado em init). */
export function serviceError(key: string, params?: Record<string, string | number>): string {
  return tr(undefined, key, params);
}

/** Parse 137 (DUPLICATE_VALUE) e usado por varias regras; so a mensagem do servidor diz qual. */
export function duplicateValueMessage(message: string, i18n?: ParseErrorI18n): string {
  if (/\bcpf\b/i.test(message)) return tr(i18n, 'error.cpfTaken');
  if (!message || /apelido|nickname|duplicate value for a field/i.test(message)) {
    return tr(i18n, 'error.nicknameTaken');
  }
  return message;
}

export function parseErrorMessage(error: unknown, i18n?: ParseErrorI18n): string {
  const message = extractErrorMessage(error);

  if (!message && (error == null || typeof error === 'object')) {
    return tr(i18n, 'error.generic');
  }

  if (typeof error === 'string' && !message) {
    return error || tr(i18n, 'error.generic');
  }

  const err = (error && typeof error === 'object' ? error : {}) as { code?: number; message?: string };

  switch (err.code) {
    case 101:
      if (/invalid\s+username|username\/password|password/i.test(message)) {
        return tr(i18n, 'error.invalidCredentials');
      }
      return message || tr(i18n, 'error.notFoundOrForbidden');
    case 202:
      return tr(i18n, 'error.usernameTaken');
    case 203:
      return tr(i18n, 'error.emailTaken');
    case 205:
      return tr(i18n, 'error.emailNotFound');
    case 125:
      return tr(i18n, 'error.invalidEmail');
    case 142:
      if (isNameFieldValidationMessage(message)) {
        return tr(i18n, 'error.fullNameMin2');
      }
      if (/^email\b/i.test(message) || /\bemail\s+(is\s+)?required/i.test(message)) {
        return tr(i18n, 'error.emailEnterValid');
      }
      return message || tr(i18n, 'error.invalidFields');
    case 137:
      return duplicateValueMessage(message, i18n);
    case 209:
      return tr(i18n, 'error.sessionExpired');
    default:
      break;
  }

  if (isInvalidSessionError(error)) {
    return tr(i18n, 'error.sessionExpired');
  }

  if (/invalid\s+username|username\/password/i.test(message)) {
    return tr(i18n, 'error.invalidCredentials');
  }

  if (/^unauthorized$/i.test(message.trim()) || /\bnot authorized\b/i.test(message)) {
    return tr(i18n, 'error.unauthorized');
  }

  if (/permission denied|needs to be authenticated/i.test(message)) {
    return tr(i18n, 'error.signupServerUnavailable');
  }

  if (isNetworkConnectivityError(message)) {
    return tr(i18n, 'error.networkConnectivity');
  }

  if (
    /unexpected end of json input/i.test(message) ||
    /failed to execute 'json' on 'response'/i.test(message)
  ) {
    return tr(i18n, 'error.signupInvalidResponse');
  }

  if (isNameFieldValidationMessage(message)) {
    return tr(i18n, 'error.fullNameMin2');
  }

  return message || tr(i18n, 'error.operation');
}

export function isNetworkError(error: unknown): boolean {
  return isNetworkConnectivityError(extractErrorMessage(error));
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return '';

  const err = error as { message?: string; error?: string; statusText?: string };
  return (err.message ?? err.error ?? err.statusText ?? '').trim();
}

function isNameFieldValidationMessage(message: string): boolean {
  return (
    /^name\b/i.test(message) ||
    /\bfield\s+name\b/i.test(message) ||
    /\bname\s+(is\s+)?required/i.test(message)
  );
}

function isNetworkConnectivityError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('unable to resolve host') ||
    lower.includes('no address associated with hostname') ||
    lower.includes('failed to connect') ||
    lower.includes('network is unreachable') ||
    lower.includes('connection refused') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('err_connection') ||
    lower.includes('err_timed_out') ||
    lower.includes('timeout') ||
    lower.includes('enetunreach') ||
    lower.includes('econnrefused')
  );
}