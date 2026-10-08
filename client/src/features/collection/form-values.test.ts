// ============================================================================
// form-values.test.ts: TESTS FOR CONVERTING BETWEEN THE FORM AND A RECORD
// ============================================================================

import { describe, expect, it } from 'vitest';
import { makeRecord } from '../../test/fake-api';
import { EMPTY_FORM, toFormValues, validateForm, type FormValues } from './form-values';

const valid: FormValues = { ...EMPTY_FORM, title: 'Blue', artists: ['Joni Mitchell'] };

describe('toFormValues', () => {
  it('turns a record into text for the form', () => {
    const values = toFormValues(
      makeRecord({ year: 1959, runtimeSeconds: 2744, label: null, sleeveCondition: null }),
    );
    expect(values).toMatchObject({
      year: '1959',
      runtime: '45:44',
      label: '',
      sleeveCondition: '',
      artists: ['Miles Davis'],
    });
  });
});

describe('validateForm', () => {
  it('turns form text into a record to send', () => {
    const result = validateForm({
      ...valid,
      artists: ['Joni Mitchell', '   '],
      year: '1971',
      runtime: '36:15',
      mediaCondition: 'VG+',
    });

    expect(result).toEqual({
      ok: true,
      input: expect.objectContaining({
        title: 'Blue',
        artists: ['Joni Mitchell'], // the empty extra row is ignored
        year: 1971,
        runtimeSeconds: 2175,
        mediaCondition: 'VG+',
        sleeveCondition: null,
      }),
    });
  });

  it('treats empty number fields as "not set"', () => {
    const result = validateForm(valid);
    expect(result.ok && result.input).toMatchObject({ year: null, runtimeSeconds: null });
  });

  it('reports a problem next to each field', () => {
    const result = validateForm({
      ...EMPTY_FORM,
      year: '1850',
      runtime: 'forty',
      coverImageUrl: 'cover.jpg',
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        title: 'Title is required',
        artists: 'At least one artist is required',
        year: 'Year must be 1900 or later',
        runtime: 'Use minutes:seconds, like 42:49',
        coverImageUrl: 'Enter a full web address, starting with https://',
      },
    });
  });
});
