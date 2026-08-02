import { Injectable } from '@angular/core';
import { Address, AddressSuggestion, formatZipCode, normalizeZipCode } from '../models/address.model';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

interface PhotonFeature {
  properties: Record<string, string | undefined>;
  geometry: { coordinates: [number, number] };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

const BRAZIL_STATE_TO_UF: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'federal district': 'DF',
  brasilia: 'DF',
  'brasilia df': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

/** Correcoes de UF mal derivadas (ex.: "Federal District" → FE). */
const BRAZIL_UF_CORRECTIONS: Record<string, string> = {
  FE: 'DF',
};

/** Brasil — limita resultados da busca por logradouro. */
const BRAZIL_BBOX = '-73.99,-33.75,-34.79,5.27';

@Injectable({ providedIn: 'root' })
export class AddressGeocodingService {
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';
  private readonly photonUrl = 'https://photon.komoot.io';
  private readonly appUserAgent = 'ControleDeBola/1.0 (football app; geocoding)';

  async searchStreet(query: string): Promise<AddressSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 4) return [];

    try {
      const photonResults = await this.searchPhoton(trimmed);
      if (photonResults.length > 0) return photonResults;
    } catch {
      // tenta fallback abaixo
    }

    return this.searchNominatim(trimmed);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<Partial<Address>> {
    try {
      const photon = await this.reversePhoton(latitude, longitude);
      if (Object.keys(photon).length > 0) return photon;
    } catch {
      // tenta fallback abaixo
    }

    return this.reverseNominatim(latitude, longitude);
  }

  async lookupZipCode(zipCode: string): Promise<Partial<Address> | null> {
    const digits = normalizeZipCode(zipCode);
    if (digits.length !== 8) return null;

    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      cep?: string;
    };

    if (data.erro) return null;

    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
      zipCode: formatZipCode(data.cep ?? digits),
    };
  }

  private async searchPhoton(query: string): Promise<AddressSuggestion[]> {
    const url = new URL(`${this.photonUrl}/api/`);
    url.searchParams.set('q', `${query}, Brasil`);
    url.searchParams.set('limit', '8');
    url.searchParams.set('bbox', BRAZIL_BBOX);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Nao foi possivel buscar enderecos. Tente novamente.');
    }

    const data = (await response.json()) as PhotonResponse;
    return data.features
      .map((feature, index) => this.photonToSuggestion(feature, index))
      .filter((item): item is AddressSuggestion => item !== null);
  }

  private async reversePhoton(latitude: number, longitude: number): Promise<Partial<Address>> {
    const url = new URL(`${this.photonUrl}/reverse`);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return {};

    const data = (await response.json()) as PhotonResponse;
    const feature = data.features?.[0];
    if (!feature) return {};

    const suggestion = this.photonToSuggestion(feature, 0);
    return suggestion?.address ?? {};
  }

  private async searchNominatim(query: string): Promise<AddressSuggestion[]> {
    const url = new URL(`${this.nominatimUrl}/search`);
    url.searchParams.set('q', `${query}, Brasil`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', '8');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR',
        'User-Agent': this.appUserAgent,
      },
    });

    if (!response.ok) {
      throw new Error('Nao foi possivel buscar enderecos. Tente novamente.');
    }

    const results = (await response.json()) as NominatimResult[];
    return results
      .map((item) => this.nominatimToSuggestion(item))
      .filter((item): item is AddressSuggestion => item !== null);
  }

  private async reverseNominatim(latitude: number, longitude: number): Promise<Partial<Address>> {
    const url = new URL(`${this.nominatimUrl}/reverse`);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'pt-BR',
        'User-Agent': this.appUserAgent,
      },
    });

    if (!response.ok) return {};

    const item = (await response.json()) as NominatimResult;
    return this.parseNominatimAddress(item);
  }

  private photonToSuggestion(feature: PhotonFeature, index: number): AddressSuggestion | null {
    const props = feature.properties;
    const countryCode = (props['countrycode'] as string | undefined)?.toUpperCase();
    if (countryCode && countryCode !== 'BR') return null;

    const streetName = props['street'] || props['name'] || '';
    const houseNumber = props['housenumber'];
    const street = [streetName, houseNumber].filter(Boolean).join(', ');
    const neighborhood =
      props['district'] || props['locality'] || props['suburb'] || props['neighbourhood'] || '';
    const city = props['city'] || props['town'] || props['village'] || props['county'] || '';
    const state = this.resolveState(props['state'] ?? '');

    if (!street || !city || !state) return null;

    const [longitude, latitude] = feature.geometry.coordinates;
    const zipCode = props['postcode'] ? formatZipCode(props['postcode']) : '';
    const osmType = props['osm_type'] ?? 'node';
    const osmId = props['osm_id'] ?? String(index);

    const labelParts = [street, neighborhood, city, state].filter(Boolean);

    return {
      id: `photon-${osmType}-${osmId}-${index}`,
      label: `${labelParts.join(', ')}${zipCode ? ` · ${zipCode}` : ''}`,
      address: {
        street,
        neighborhood,
        city,
        state,
        zipCode,
        latitude,
        longitude,
      },
    };
  }

  private nominatimToSuggestion(item: NominatimResult): AddressSuggestion | null {
    const parsed = this.parseNominatimAddress(item);
    if (!parsed.street || !parsed.city || !parsed.state) return null;

    return {
      id: String(item.place_id),
      label: item.display_name,
      address: {
        ...parsed,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
      },
    };
  }

  private parseNominatimAddress(item: NominatimResult): Address {
    const a = item.address ?? {};
    const street =
      [a['road'], a['house_number']].filter(Boolean).join(', ') ||
      a['pedestrian'] ||
      a['footway'] ||
      '';
    const neighborhood =
      a['suburb'] ||
      a['neighbourhood'] ||
      a['quarter'] ||
      a['city_district'] ||
      a['residential'] ||
      '';
    const city = a['city'] || a['town'] || a['village'] || a['municipality'] || a['county'] || '';
    const state = this.resolveState(a['state'] ?? '');
    const zipCode = a['postcode'] ? formatZipCode(a['postcode']) : '';

    return {
      street,
      neighborhood,
      city,
      state,
      zipCode,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    };
  }

  private resolveState(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.length === 2) {
      const uf = trimmed.toUpperCase();
      return BRAZIL_UF_CORRECTIONS[uf] ?? uf;
    }

    const normalized = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (BRAZIL_STATE_TO_UF[normalized]) {
      return BRAZIL_STATE_TO_UF[normalized];
    }

    // Photon/Nominatim em ingles: "Federal District" virava "FE" via slice(0, 2).
    if (normalized.includes('distrito federal') || normalized.includes('federal district')) {
      return 'DF';
    }
    if (normalized === 'brasilia' || normalized.startsWith('brasilia ')) {
      return 'DF';
    }

    const fallback = trimmed.slice(0, 2).toUpperCase();
    return BRAZIL_UF_CORRECTIONS[fallback] ?? fallback;
  }
}
