import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TeamUniformOption, UNIFORMS_BY_SERIE } from '../../../core/data/team-uniforms.data';

@Component({
  selector: 'app-uniform-picker',
  templateUrl: './uniform-picker.component.html',
  styleUrls: ['./uniform-picker.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UniformPickerComponent),
      multi: true,
    },
  ],
  standalone: false,
})
export class UniformPickerComponent implements ControlValueAccessor {
  @Input() disabled = false;

  uniformsA = UNIFORMS_BY_SERIE.A;
  uniformsB = UNIFORMS_BY_SERIE.B;
  uniformsC = UNIFORMS_BY_SERIE.C;
  selectedId = '';

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  select(uniform: TeamUniformOption): void {
    if (this.disabled) return;
    this.selectedId = uniform.id;
    this.onChange(uniform.id);
    this.onTouched();
  }

  isSelected(uniform: TeamUniformOption): boolean {
    return this.selectedId === uniform.id;
  }

  writeValue(value: string | null): void {
    this.selectedId = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
