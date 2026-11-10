import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { destinationValidator, futureDateValidator } from './link.validators';

describe('destination validation', () => {
  it.each(['https://example.com/a?q=1', 'http://localhost:8080/path'])('accepts %s', url => {
    expect(destinationValidator(new FormControl(url))).toBeNull();
  });
  it.each(['javascript:alert(1)', 'ftp://example.com', 'https://user:pass@example.com', 'example.com', ' https://example.com', 'https://example.com/a b'])('rejects %s', url => {
    expect(destinationValidator(new FormControl(url))).toEqual({ destination: true });
  });
  it('leaves required validation to the required validator', () => {
    expect(destinationValidator(new FormControl(''))).toBeNull();
  });
});

describe('expiration validation', () => {
  it('accepts an optional or future date', () => {
    expect(futureDateValidator(new FormControl(''))).toBeNull();
    expect(futureDateValidator(new FormControl(new Date(Date.now() + 60000).toISOString()))).toBeNull();
  });
  it('rejects past and malformed dates', () => {
    expect(futureDateValidator(new FormControl('2020-01-01'))).toEqual({ futureDate: true });
    expect(futureDateValidator(new FormControl('invalid'))).toEqual({ futureDate: true });
  });
});
