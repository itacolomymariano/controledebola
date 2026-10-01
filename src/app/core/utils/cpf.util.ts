/** Normaliza CPF para apenas digitos. */
export function normalizeCpfDigits(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

/** Valida CPF brasileiro (11 digitos + digitos verificadores). */
export function isValidCpf(value: string | null | undefined): boolean {
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

export function formatCpfMask(value: string | null | undefined): string {
  const digits = normalizeCpfDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
