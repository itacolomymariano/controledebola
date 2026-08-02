import { FormGroup } from '@angular/forms';

export function collectLegendFormValidationMessages(
  form: FormGroup,
  options?: { memorialDateEnabled?: boolean }
): string[] {
  const messages: string[] = [];

  if (form.get('name')?.invalid) {
    messages.push('Informe o nome.');
  }
  if (form.get('apelido')?.invalid) {
    messages.push('Informe o apelido.');
  }

  appendBirthDateMessages(form, 'birthDate', 'data de nascimento', messages);
  appendBirthDateMessages(form, 'foundedDate', 'data de nascimento do time', messages);
  appendBirthDateMessages(form, 'endedDate', 'data que encerrou as atividades', messages);

  if (options?.memorialDateEnabled) {
    appendBirthDateMessages(form, 'memorialDate', 'data da partida (falecimento)', messages);
  }

  const addressControl = form.get('address') ?? form.get('location');
  if (addressControl?.hasError('addressIncomplete')) {
    messages.push('Informe e confirme o endereco completo (busque pelo CEP ou mapa).');
  }

  return messages;
}

function appendBirthDateMessages(
  form: FormGroup,
  controlName: string,
  label: string,
  messages: string[]
): void {
  const control = form.get(controlName);
  if (!control) return;

  if (control.hasError('incompleteBirthDate')) {
    messages.push(`Selecione dia, mes e ano da ${label}.`);
  } else if (control.hasError('invalidBirthDate')) {
    messages.push(`${capitalize(label)} invalida.`);
  }
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
