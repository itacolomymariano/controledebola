import { Component, forwardRef, Input, OnDestroy } from '@angular/core';
import {
  ControlValueAccessor,
  FormBuilder,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import {
  BIRTH_DATE_MONTHS,
  buildBirthDateFromParts,
  buildBirthDayOptions,
  buildBirthYearOptions,
  birthDateToIsoString,
  splitBirthDateIso,
} from '../../../core/utils/birth-date.util';

@Component({
  selector: 'app-birth-date-picker',
  templateUrl: './birth-date-picker.component.html',
  styleUrls: ['./birth-date-picker.component.scss'],
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BirthDatePickerComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => BirthDatePickerComponent),
      multi: true,
    },
  ],
})
export class BirthDatePickerComponent implements ControlValueAccessor, Validator, OnDestroy {
  @Input() label = 'Data de nascimento';

  readonly months = BIRTH_DATE_MONTHS;
  readonly years = buildBirthYearOptions();

  days: number[] = buildBirthDayOptions(1, new Date().getFullYear());

  form = this.fb.group({
    day: [null as number | null],
    month: [null as number | null],
    year: [null as number | null],
  });

  private sub?: Subscription;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  constructor(
    private readonly fb: FormBuilder,
    private readonly platform: Platform
  ) {
    this.sub = this.form.valueChanges.subscribe(() => {
      this.syncDayOptions();
      this.emitValue();
      this.notifyValidationChange();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  writeValue(value: string | null): void {
    const parts = splitBirthDateIso(value);
    this.form.setValue(
      {
        day: parts.day,
        month: parts.month,
        year: parts.year,
      },
      { emitEvent: false }
    );
    this.syncDayOptions();
  }

  registerOnChange(fn: (value: string) => void): void {
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
      return;
    }
    this.form.enable({ emitEvent: false });
  }

  validate(): ValidationErrors | null {
    const { day, month, year } = this.form.getRawValue();
    if (day == null && month == null && year == null) {
      return null;
    }
    if (day == null || month == null || year == null) {
      return { incompleteBirthDate: true };
    }
    return buildBirthDateFromParts(day, month, year) ? null : { invalidBirthDate: true };
  }

  markAsTouched(): void {
    this.form.markAllAsTouched();
    this.onTouched();
  }

  get selectInterface(): 'action-sheet' | 'popover' {
    return this.platform.is('mobile') ? 'action-sheet' : 'popover';
  }

  private emitValue(): void {
    const { day, month, year } = this.form.getRawValue();
    if (day == null && month == null && year == null) {
      this.onChange('');
      return;
    }

    const date = buildBirthDateFromParts(day, month, year);
    this.onChange(date ? birthDateToIsoString(date) : '');
  }

  private notifyValidationChange(): void {
    queueMicrotask(() => this.onValidatorChange());
  }

  private syncDayOptions(): void {
    const month = this.form.get('month')?.value;
    const year = this.form.get('year')?.value;
    this.days = buildBirthDayOptions(Number(month || 0), Number(year || new Date().getFullYear()));

    const day = this.form.get('day')?.value;
    if (day != null && !this.days.includes(day)) {
      this.form.patchValue({ day: null }, { emitEvent: false });
    }
  }
}
