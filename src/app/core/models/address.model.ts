import { AbstractControl, ValidationErrors } from '@angular/forms';

export interface Address {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressSuggestion {
  id: string;
  label: string;
  address: Address;
}

export const emptyAddress = (): Address => ({
  street: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
});

export function normalizeZipCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function formatZipCode(value: string): string {
  const digits = normalizeZipCode(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** Corrige UFs mal derivadas (ex.: "Federal District" → FE). */
const BRAZIL_UF_CORRECTIONS: Record<string, string> = {
  FE: 'DF',
};

export function normalizeBrazilUf(value: string | undefined | null): string {
  const uf = String(value ?? '')
    .trim()
    .toUpperCase();
  if (!uf) return '';
  return BRAZIL_UF_CORRECTIONS[uf] ?? uf;
}

/** Normaliza UF em enderecos ja salvos (ex.: FE → DF). */
export function normalizeAddress(address: Address): Address {
  return {
    ...address,
    state: normalizeBrazilUf(address.state),
  };
}

export function isAddressComplete(address: Address | null | undefined): boolean {
  if (!address) return false;
  const zip = normalizeZipCode(address.zipCode);
  const state = normalizeBrazilUf(address.state);
  return (
    !!address.street?.trim() &&
    !!address.neighborhood?.trim() &&
    !!address.city?.trim() &&
    state.length === 2 &&
    zip.length === 8 &&
    typeof address.latitude === 'number' &&
    typeof address.longitude === 'number' &&
    !Number.isNaN(address.latitude) &&
    !Number.isNaN(address.longitude)
  );
}

export function addressCompleteValidator(control: AbstractControl): ValidationErrors | null {
  return isAddressComplete(control.value as Address) ? null : { addressIncomplete: true };
}

const LOCATION_EPSILON = 0.0001;

export function isSameAddressLocation(a: Address, b: Address): boolean {
  const hasCoords =
    typeof a.latitude === 'number' &&
    typeof a.longitude === 'number' &&
    typeof b.latitude === 'number' &&
    typeof b.longitude === 'number' &&
    !Number.isNaN(a.latitude) &&
    !Number.isNaN(a.longitude) &&
    !Number.isNaN(b.latitude) &&
    !Number.isNaN(b.longitude);

  if (hasCoords) {
    return (
      Math.abs(a.latitude! - b.latitude!) < LOCATION_EPSILON &&
      Math.abs(a.longitude! - b.longitude!) < LOCATION_EPSILON
    );
  }

  const normalize = (value: string | undefined): string => value?.trim().toLowerCase() ?? '';
  return (
    normalize(a.street) === normalize(b.street) &&
    normalizeZipCode(a.zipCode) === normalizeZipCode(b.zipCode) &&
    normalize(a.city) === normalize(b.city)
  );
}

export function getMissingAddressFields(address: Address | null | undefined): string[] {
  if (!address) return ['Endereco'];

  const missing: string[] = [];
  if (!address.street?.trim()) missing.push('Logradouro');
  if (!address.neighborhood?.trim()) missing.push('Bairro');
  if (!address.city?.trim()) missing.push('Cidade');
  if (normalizeBrazilUf(address.state).length !== 2) missing.push('UF');
  if (normalizeZipCode(address.zipCode).length !== 8) missing.push('CEP');
  if (typeof address.latitude !== 'number' || Number.isNaN(address.latitude)) {
    missing.push('Localizacao (selecione na lista)');
  }
  if (typeof address.longitude !== 'number' || Number.isNaN(address.longitude)) {
    missing.push('Localizacao (selecione na lista)');
  }
  return [...new Set(missing)];
}
