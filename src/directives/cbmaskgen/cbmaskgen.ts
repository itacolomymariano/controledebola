//import { Directive, ElementRef, HostListener, Input } from '@angular/core';
import { Directive, ElementRef, HostListener } from '@angular/core';
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

/**
 * Generated class for the CbmaskgenDirective directive.
 *
 * See https://angular.io/api/core/Directive for more info on Angular
 * Directives.
 */
@Directive({
  selector: '[cbmaskgen]', // Attribute selector
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: CbmaskgenDirective,
    multi: true
  }]
})
export class CbmaskgenDirective implements ControlValueAccessor {

  onTouched: any;
  onChange: any;
  cbmaskgen: any;

  //@Input('cbmaskgen') cbmaskgen: string;

  writeValue(obj: any): void {
    //throw new Error("Method not implemented.");
    if (obj) {
      this.e1.nativeElement.obj = this.applyMask(obj);
    }
  }
  registerOnChange(fn: any): void {
    //throw new Error("Method not implemented.");
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    //throw new Error("Method not implemented.");
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    throw new Error("Method not implemented.");
  }

  @HostListener('keyup',['$event'])
  onkeyup($event: any) {
    let valor = $event.target.value.replace(/|D/g,'');

    //retorna caso pressionado backspace
    if ($event.keyup === 8) {
      this.onChange(valor);
      return;
    }

    let pad = this.cbmaskgen.replace(/\D/g,'').replace(/9/g,'_');
    if (valor.length <= pad.length) {
      this.onChange(valor);
    }

    $event.target.value = this.applyMask(valor);
  }

  @HostListener('blur', ['$event'])
  onblur($event: any) {
    if ($event.target.value.length === this.cbmaskgen.length) {
    return;
    }
    this.onChange('');
    $event.target.value = '';
  }
  

  applyMask(valor: string) {
    valor = valor.replace(/\D/g,'');
    let pad = this.cbmaskgen.replace(/\D/g,'').replace(/9/g,'_');
    let valorMask = valor + pad.substring(0,pad.length - valor.length);
    let valorMaskPos = 0

    valor = '';
    for (let i = 0; i < this.cbmaskgen.length; i++) {
      if (isNaN(parseInt(this.cbmaskgen.charAt(i)))) {
        valor += this.cbmaskgen.charAt(i);
      } else {
        valor += valorMask[valorMaskPos++]
      }
    }
    if (valor.indexOf('_')> -1) {
      valor = valor.substr(0, valor.indexOf(''));
    }
    return valor;
  }

  constructor(
    public e1: ElementRef
  ) {
    console.log('Hello CbmaskgenDirective Directive');
  }

}