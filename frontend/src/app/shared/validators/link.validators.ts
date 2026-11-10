import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const destinationValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  try {
    const value: unknown = control.value;
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value) || /[\s\\]/.test(value) || /%(?![\da-f]{2})/i.test(value)) return { destination: true };
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return { destination: true };
    return null;
  } catch { return { destination: true }; }
};

export const futureDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (!control.value) return null;
  const time = Date.parse(String(control.value));
  return Number.isFinite(time) && time > Date.now() ? null : { futureDate: true };
};
