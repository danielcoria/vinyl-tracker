// ============================================================================
// form-values.ts: CONVERTS BETWEEN THE FORM AND A RECORD
//
// Form inputs always hold text ("1971", "42:49", ""), but the server wants real
// values (1971, 2569 seconds, null). This file converts both ways:
//   toFormValues(record)  record -> what the form shows (for editing)
//   validateForm(values)  what you typed -> a record to send, or a list of
//                         problems to show next to each field
// It checks input with recordInputSchema from shared/, the same rules the
// server uses, so you see mistakes before anything is sent.
// ============================================================================

import {
  recordInputSchema,
  type Condition,
  type RecordInput,
  type VinylRecord,
} from '@vinyl/shared';
import { formatDuration, parseDuration } from './format';

export type FormValues = {
  title: string;
  artists: string[];
  year: string;
  label: string;
  catalogNumber: string;
  format: string;
  runtime: string;
  mediaCondition: Condition | '';
  sleeveCondition: Condition | '';
  genres: string[];
  styles: string[];
  coverImageUrl: string;
  notes: string;
};

/** A problem message for each field that has one, e.g. { title: 'Title is required' }. */
export type FieldErrors = Partial<Record<keyof FormValues, string>>;

export const EMPTY_FORM: FormValues = {
  title: '',
  artists: [''],
  year: '',
  label: '',
  catalogNumber: '',
  format: '',
  runtime: '',
  mediaCondition: '',
  sleeveCondition: '',
  genres: [],
  styles: [],
  coverImageUrl: '',
  notes: '',
};

export function toFormValues(record: VinylRecord): FormValues {
  return {
    title: record.title,
    artists: record.artists.length > 0 ? record.artists.map((a) => a.name) : [''],
    year: record.year === null ? '' : String(record.year),
    label: record.label ?? '',
    catalogNumber: record.catalogNumber ?? '',
    format: record.format ?? '',
    runtime: record.runtimeSeconds === null ? '' : formatDuration(record.runtimeSeconds),
    mediaCondition: record.mediaCondition ?? '',
    sleeveCondition: record.sleeveCondition ?? '',
    genres: record.genres,
    styles: record.styles,
    coverImageUrl: record.coverImageUrl ?? '',
    notes: record.notes ?? '',
  };
}

type Result = { ok: true; input: RecordInput } | { ok: false; errors: FieldErrors };

export function validateForm(values: FormValues): Result {
  const errors: FieldErrors = {};

  // Length is typed as "42:49", so it needs converting before the shared rules can check it.
  const runtimeText = values.runtime.trim();
  const runtimeSeconds = runtimeText === '' ? null : parseDuration(runtimeText);
  if (runtimeSeconds === null && runtimeText !== '') {
    errors.runtime = 'Use minutes:seconds, like 42:49';
  }

  const input: RecordInput = {
    title: values.title,
    // Ignore empty artist boxes (e.g. an extra row you added but didn't fill in).
    artists: values.artists.filter((name) => name.trim() !== ''),
    year: values.year.trim() === '' ? null : Number(values.year),
    label: values.label,
    catalogNumber: values.catalogNumber,
    format: values.format,
    runtimeSeconds,
    mediaCondition: values.mediaCondition || null,
    sleeveCondition: values.sleeveCondition || null,
    genres: values.genres,
    styles: values.styles,
    coverImageUrl: values.coverImageUrl,
    notes: values.notes,
  };

  // safeParse checks without throwing: it returns either success or a list of issues.
  const parsed = recordInputSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_FOR_INPUT_KEY[String(issue.path[0])];
      // Keep only the first problem per field.
      if (field && !errors[field]) errors[field] = issue.message;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input };
}

/** Which form field to show a problem next to, for each field the server knows. */
const FIELD_FOR_INPUT_KEY: Record<string, keyof FormValues> = {
  title: 'title',
  artists: 'artists',
  year: 'year',
  label: 'label',
  catalogNumber: 'catalogNumber',
  format: 'format',
  runtimeSeconds: 'runtime',
  mediaCondition: 'mediaCondition',
  sleeveCondition: 'sleeveCondition',
  genres: 'genres',
  styles: 'styles',
  coverImageUrl: 'coverImageUrl',
  notes: 'notes',
};
