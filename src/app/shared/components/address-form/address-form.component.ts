import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, forwardRef } from '@angular/core';
import {
  ControlValueAccessor,
  FormBuilder,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import {
  Subscription,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';
import {
  Address,
  AddressSuggestion,
  emptyAddress,
  formatZipCode,
  getMissingAddressFields,
  isAddressComplete,
  normalizeBrazilUf,
  normalizeZipCode,
} from '../../../core/models/address.model';
import { AddressGeocodingService } from '../../../core/services/address-geocoding.service';

@Component({
  selector: 'app-address-form',
  templateUrl: './address-form.component.html',
  styleUrls: ['./address-form.component.scss'],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AddressFormComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AddressFormComponent),
      multi: true,
    },
  ],
})
export class AddressFormComponent implements OnInit, OnDestroy, ControlValueAccessor, Validator {
  @Input() title = 'Endereco';
  @Output() readonly addressChange = new EventEmitter<void>();

  form = this.fb.group({
    streetQuery: [''],
    street: ['', Validators.required],
    neighborhood: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    zipCode: ['', Validators.required],
    latitude: [null as number | null],
    longitude: [null as number | null],
  });

  suggestions: AddressSuggestion[] = [];
  searching = false;
  geocoded = false;
  searchError = '';
  applying = false;

  private subs = new Subscription();
  private onChange: (value: Address) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor(
    private readonly fb: FormBuilder,
    private readonly geocoding: AddressGeocodingService
  ) {}

  ngOnInit(): void {
    this.lockAutoFields();

    this.subs.add(
      this.form.valueChanges.subscribe(() => {
        this.emitValue();
        this.notifyValidationChange();
      })
    );

    this.subs.add(
      this.form.get('streetQuery')!.valueChanges
        .pipe(debounceTime(450), distinctUntilChanged())
        .subscribe((query) => {
          void this.handleStreetQueryChange((query ?? '').trim());
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onStreetQueryInput(event: CustomEvent): void {
    const value = (event.detail.value as string) ?? this.form.get('streetQuery')?.value ?? '';
    if (value.trim().length > 0) {
      this.geocoded = false;
      this.form.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
      this.notifyValidationChange();
    }
  }

  private async handleStreetQueryChange(query: string): Promise<void> {
    if (query.length > 0) {
      this.geocoded = false;
      this.form.patchValue({ latitude: null, longitude: null }, { emitEvent: false });
    }

    if (query.length < 4) {
      this.suggestions = [];
      this.searchError = '';
      this.searching = false;
      this.notifyValidationChange();
      return;
    }

    this.searching = true;
    this.searchError = '';

    try {
      this.suggestions = await this.geocoding.searchStreet(query);
    } catch (error: unknown) {
      this.suggestions = [];
      this.searchError = error instanceof Error ? error.message : 'Erro na busca.';
    } finally {
      this.searching = false;
      this.notifyValidationChange();
    }
  }

  writeValue(value: Address | null): void {
    if (!value) {
      this.form.reset(emptyAddress(), { emitEvent: false });
      this.geocoded = false;
      return;
    }

    this.form.patchValue(
      {
        streetQuery: value.street ?? '',
        street: value.street ?? '',
        neighborhood: value.neighborhood ?? '',
        city: value.city ?? '',
        state: normalizeBrazilUf(value.state),
        zipCode: value.zipCode ?? '',
        latitude: value.latitude ?? null,
        longitude: value.longitude ?? null,
      },
      { emitEvent: false }
    );
    this.geocoded = isAddressComplete(value);
  }

  registerOnChange(fn: (value: Address) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
      this.lockAutoFields();
    }
  }

  validate(): ValidationErrors | null {
    return isAddressComplete(this.readAddress()) ? null : { addressIncomplete: true };
  }

  selectSuggestion(suggestion: AddressSuggestion): void {
    void this.applySuggestion(suggestion);
  }

  async onZipBlur(): Promise<void> {
    const zip = normalizeZipCode(this.form.get('zipCode')?.value ?? '');
    if (zip.length !== 8) return;

    this.form.patchValue({ zipCode: formatZipCode(zip) }, { emitEvent: false });

    if (this.geocoded) {
      this.emitValue();
      this.notifyValidationChange();
      return;
    }

    const partial = await this.geocoding.lookupZipCode(zip);
    if (!partial) {
      this.notifyValidationChange();
      return;
    }

    this.form.patchValue({
      street: this.form.get('street')?.value || partial.street || '',
      neighborhood: this.form.get('neighborhood')?.value || partial.neighborhood || '',
      city: partial.city ?? this.form.get('city')?.value,
      state: partial.state ?? this.form.get('state')?.value,
    });

    this.emitValue();
    this.notifyValidationChange();
  }

  markTouched(): void {
    this.onTouched();
  }

  get isComplete(): boolean {
    return isAddressComplete(this.readAddress());
  }

  get missingFields(): string[] {
    return getMissingAddressFields(this.readAddress());
  }

  private async applySuggestion(suggestion: AddressSuggestion): Promise<void> {
    this.suggestions = [];
    this.applying = true;
    this.geocoded = true;

    const addr = suggestion.address;
    this.form.patchValue(
      {
        streetQuery: addr.street,
        street: addr.street,
        neighborhood: addr.neighborhood,
        city: addr.city,
        state: addr.state,
        zipCode: addr.zipCode || this.form.get('zipCode')?.value,
        latitude: addr.latitude ?? null,
        longitude: addr.longitude ?? null,
      },
      { emitEvent: false }
    );

    if (addr.latitude != null && addr.longitude != null) {
      const enriched = await this.geocoding.reverseGeocode(addr.latitude, addr.longitude);
      this.mergePartialAddress(enriched);
    }

    await this.fillZipIfMissing();
    this.emitValue();
    this.notifyValidationChange();
    this.onTouched();
    this.applying = false;
  }

  private mergePartialAddress(partial: Partial<Address>): void {
    const current = this.form.getRawValue();
    this.form.patchValue(
      {
        street: current.street || partial.street || '',
        neighborhood: current.neighborhood || partial.neighborhood || '',
        city: current.city || partial.city || '',
        state: current.state || partial.state || '',
        zipCode: current.zipCode || partial.zipCode || '',
      },
      { emitEvent: false }
    );
  }

  private async fillZipIfMissing(): Promise<void> {
    const zip = normalizeZipCode(this.form.get('zipCode')?.value ?? '');
    if (zip.length === 8) {
      this.form.patchValue({ zipCode: formatZipCode(zip) }, { emitEvent: false });
      return;
    }

    const city = this.form.get('city')?.value;
    const state = this.form.get('state')?.value;
    const street = this.form.get('street')?.value;
    if (!city || !state || !street) return;

    try {
      const results = await this.geocoding.searchStreet(`${street}, ${city}, ${state}`);
      const match = results.find((r) => r.address.city === city) ?? results[0];
      if (match?.address.zipCode) {
        this.form.patchValue({ zipCode: match.address.zipCode }, { emitEvent: false });
      }
    } catch {
      // usuario pode preencher CEP manualmente
    }
  }

  private readAddress(): Address {
    const v = this.form.getRawValue();
    return {
      street: (v.street ?? '').trim(),
      neighborhood: (v.neighborhood ?? '').trim(),
      city: (v.city ?? '').trim(),
      state: normalizeBrazilUf(v.state),
      zipCode: formatZipCode(v.zipCode ?? ''),
      latitude: v.latitude ?? undefined,
      longitude: v.longitude ?? undefined,
    };
  }

  private emitValue(): void {
    this.onChange(this.readAddress());
    this.addressChange.emit();
    queueMicrotask(() => this.onValidatorChange());
  }

  private notifyValidationChange(): void {
    queueMicrotask(() => this.onValidatorChange());
  }

  private lockAutoFields(): void {
    for (const name of ['street', 'neighborhood', 'city', 'state', 'zipCode']) {
      this.form.get(name)?.disable({ emitEvent: false });
    }
  }
}
