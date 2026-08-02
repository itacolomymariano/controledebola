import { FormGroup } from '@angular/forms';

export function buildMissingFieldsMessage(
  form: FormGroup,
  labels: Record<string, string>
): string {
  const missing: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const control = form.get(key);
    if (control?.invalid) {
      missing.push(label);
    }
  }
  if (!missing.length) return '';
  return `Falta preencher: ${missing.join(', ')}.`;
}
