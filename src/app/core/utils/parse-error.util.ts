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

export function parseErrorMessage(error: unknown): string {
  const message = extractErrorMessage(error);

  if (!message && (error == null || typeof error === 'object')) {
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }

  if (typeof error === 'string' && !message) {
    return error || 'Ocorreu um erro inesperado. Tente novamente.';
  }

  const err = (error && typeof error === 'object' ? error : {}) as { code?: number; message?: string };

  switch (err.code) {
    case 101:
      if (/invalid\s+username|username\/password|password/i.test(message)) {
        return 'E-mail/celular ou senha incorretos.';
      }
      return message || 'Registro nao encontrado ou sem permissao de acesso.';
    case 202:
      return 'Nome de usuario ja cadastrado. Use outro e-mail ou celular.';
    case 203:
      return 'E-mail ja cadastrado.';
    case 205:
      return 'Nenhum usuario encontrado com este e-mail.';
    case 125:
      return 'E-mail invalido.';
    case 142:
      if (isNameFieldValidationMessage(message)) {
        return 'Informe o nome completo (minimo 2 caracteres).';
      }
      if (/^email\b/i.test(message) || /\bemail\s+(is\s+)?required/i.test(message)) {
        return 'Informe um e-mail valido.';
      }
      return message || 'Dados invalidos. Verifique os campos.';
    case 137:
      return 'Apelido ja utilizado neste evento. Escolha outro.';
    case 209:
      return 'Sessao expirada. Faca login novamente.';
    default:
      break;
  }

  if (isInvalidSessionError(error)) {
    return 'Sessao expirada. Faca login novamente.';
  }

  if (/invalid\s+username|username\/password/i.test(message)) {
    return 'E-mail/celular ou senha incorretos.';
  }

  if (/permission denied|needs to be authenticated/i.test(message)) {
    return (
      'Cadastro indisponivel no servidor. Publique o Cloud Code (cloud/main.js) no Back4App ' +
      'ou libere Create em _User para usuarios nao autenticados.'
    );
  }

  if (isNetworkConnectivityError(message)) {
    return networkConnectivityMessage();
  }

  if (
    /unexpected end of json input/i.test(message) ||
    /failed to execute 'json' on 'response'/i.test(message)
  ) {
    return (
      'Resposta invalida do servidor ao concluir o cadastro. ' +
      'Verifique sua conexao e tente novamente em alguns instantes.'
    );
  }

  if (isNameFieldValidationMessage(message)) {
    return 'Informe o nome completo (minimo 2 caracteres).';
  }

  return message || 'Nao foi possivel concluir a operacao.';
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

function networkConnectivityMessage(): string {
  return (
    'Sem conexao com a internet ou falha ao acessar o servidor. ' +
    'Verifique Wi-Fi/dados moveis, desative VPN ou DNS privado (Samsung: Conexoes > DNS privado > Automatico) e tente novamente.'
  );
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
