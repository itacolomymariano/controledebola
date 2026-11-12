import { Pipe, PipeTransform } from '@angular/core';
import {
  muralAthleteLocationLine,
  MuralAthleteLocationFields,
} from '../../core/utils/mural-athlete-location.util';

@Pipe({
  name: 'muralAthleteLocationLine',
  standalone: false,
})
export class MuralAthleteLocationLinePipe implements PipeTransform {
  transform(value: MuralAthleteLocationFields | null | undefined): string {
    if (!value) return '';
    return muralAthleteLocationLine(value);
  }
}
