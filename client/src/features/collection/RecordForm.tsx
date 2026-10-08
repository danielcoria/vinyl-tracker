// ============================================================================
// RecordForm.tsx: THE FORM FOR ADDING OR EDITING A RECORD
//
// Used by both the "Add a record" and "Edit" pages. It keeps what you type,
// checks it when you press Save (showing problems next to each field), and
// only then hands a clean record to the page, which sends it to the server.
// ============================================================================

import {
  useId,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import { CONDITION_GRADES, type Condition, type RecordInput } from '@vinyl/shared';
import { CONDITION_LABELS } from './format';
import { validateForm, type FieldErrors, type FormValues } from './form-values';
import { TagInput } from './TagInput';

/** Fields that are a single text box. */
type TextField =
  'title' | 'year' | 'label' | 'catalogNumber' | 'format' | 'runtime' | 'coverImageUrl' | 'notes';

function isCondition(value: string): value is Condition {
  return CONDITION_GRADES.some((grade) => grade === value);
}

type Props = {
  initialValues: FormValues;
  submitLabel: string;
  /** Where Cancel goes. */
  cancelTo: string;
  onSubmit: (input: RecordInput) => void;
  isSaving: boolean;
  /** A problem reported by the server (e.g. it was unreachable). */
  serverError?: string | null;
};

export function RecordForm({
  initialValues,
  submitLabel,
  cancelTo,
  onSubmit,
  isSaving,
  serverError,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  // useId makes ids that are unique on the page, used to link labels to inputs.
  const id = useId();

  /** Update one field. `K` means "whichever field name you pass, with its matching type". */
  function set<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    // Stop the browser's default behavior (reloading the page).
    event.preventDefault();
    const result = validateForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.input);
  }

  /** Links an input to its problem message, so screen readers announce it. */
  function errorProps(field: keyof FormValues) {
    return {
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
    };
  }

  /** Everything a plain text box needs: id, current value, and what to do on typing. */
  function textInput(field: TextField) {
    return {
      id: `${id}-${field}`,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        set(field, event.target.value),
      ...errorProps(field),
    };
  }

  /** The same for the two condition menus. */
  function conditionSelect(field: 'mediaCondition' | 'sleeveCondition') {
    return {
      id: `${id}-${field}`,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLSelectElement>) =>
        set(field, isCondition(event.target.value) ? event.target.value : ''),
      ...errorProps(field),
    };
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      {(hasErrors || serverError) && (
        <div className="error-box" role="alert">
          {hasErrors && <p>Please fix the highlighted fields.</p>}
          {serverError && <p>{serverError}</p>}
        </div>
      )}

      <Field id={`${id}-title`} label="Title" error={errors.title}>
        <input {...textInput('title')} />
      </Field>

      <Field
        id={`${id}-artists`}
        label="Artists"
        error={errors.artists}
        hint="In the order they're credited."
        asGroup
      >
        <div className="list-inputs">
          {values.artists.map((name, index) => (
            // Index keys are fine here: rows are only added at the end or removed by button.
            <div className="list-input-row" key={index}>
              <input
                id={index === 0 ? `${id}-artists` : undefined}
                aria-label={`Artist ${index + 1}`}
                value={name}
                {...errorProps('artists')}
                onChange={(event) =>
                  set(
                    'artists',
                    values.artists.map((a, i) => (i === index ? event.target.value : a)),
                  )
                }
              />
              {values.artists.length > 1 && (
                <button
                  type="button"
                  className="button button-icon"
                  aria-label={`Remove artist ${index + 1}`}
                  onClick={() =>
                    set(
                      'artists',
                      values.artists.filter((_, i) => i !== index),
                    )
                  }
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {values.artists.length < 10 && (
            <button
              type="button"
              className="button"
              onClick={() => set('artists', [...values.artists, ''])}
            >
              + Add another artist
            </button>
          )}
        </div>
      </Field>

      <div className="form-row">
        <Field id={`${id}-year`} label="Year" error={errors.year}>
          <input {...textInput('year')} type="number" inputMode="numeric" placeholder="1971" />
        </Field>
        <Field id={`${id}-format`} label="Format" error={errors.format}>
          <input {...textInput('format')} placeholder='LP, 2xLP, 7"' />
        </Field>
        <Field id={`${id}-runtime`} label="Length" error={errors.runtime} hint="minutes:seconds">
          <input {...textInput('runtime')} placeholder="42:49" />
        </Field>
      </div>

      <div className="form-row">
        <Field id={`${id}-label`} label="Label" error={errors.label}>
          <input {...textInput('label')} placeholder="Blue Note" />
        </Field>
        <Field id={`${id}-catalogNumber`} label="Catalog number" error={errors.catalogNumber}>
          <input {...textInput('catalogNumber')} placeholder="BLP 4003" />
        </Field>
      </div>

      <div className="form-row">
        <Field id={`${id}-mediaCondition`} label="Media condition" error={errors.mediaCondition}>
          <ConditionSelect {...conditionSelect('mediaCondition')} />
        </Field>
        <Field id={`${id}-sleeveCondition`} label="Sleeve condition" error={errors.sleeveCondition}>
          <ConditionSelect {...conditionSelect('sleeveCondition')} />
        </Field>
      </div>

      <div className="form-row">
        <Field id={`${id}-genres`} label="Genres" error={errors.genres} hint="Press Enter to add.">
          <TagInput
            id={`${id}-genres`}
            tags={values.genres}
            onChange={(tags) => set('genres', tags)}
            placeholder="Jazz"
          />
        </Field>
        <Field id={`${id}-styles`} label="Styles" error={errors.styles} hint="Press Enter to add.">
          <TagInput
            id={`${id}-styles`}
            tags={values.styles}
            onChange={(tags) => set('styles', tags)}
            placeholder="Hard Bop"
          />
        </Field>
      </div>

      <Field id={`${id}-coverImageUrl`} label="Cover image address" error={errors.coverImageUrl}>
        <input {...textInput('coverImageUrl')} type="url" placeholder="https://…" />
      </Field>

      <Field id={`${id}-notes`} label="Notes" error={errors.notes}>
        <textarea {...textInput('notes')} placeholder="Where you found it, pressing details…" />
      </Field>

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : submitLabel}
        </button>
        <Link to={cancelTo} className="button">
          Cancel
        </Link>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** For fields made of several inputs (artists): use a group label instead of <label>. */
  asGroup?: boolean;
  children: ReactNode;
};

/** A label, the input(s), an optional hint, and the problem message if there is one. */
function Field({ id, label, error, hint, asGroup, children }: FieldProps) {
  return (
    <div
      className="field"
      role={asGroup ? 'group' : undefined}
      aria-labelledby={asGroup ? `${id}-label` : undefined}
    >
      {asGroup ? (
        <span className="label" id={`${id}-label`}>
          {label}
        </span>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      {hint && <span className="hint">{hint}</span>}
      {children}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

type ConditionSelectProps = Omit<ComponentProps<'select'>, 'children'>;

/** A menu of the condition grades, e.g. "VG+ (Very Good Plus)", plus "Not graded". */
function ConditionSelect(props: ConditionSelectProps) {
  return (
    <select {...props}>
      <option value="">Not graded</option>
      {CONDITION_GRADES.map((grade) => (
        <option key={grade} value={grade}>
          {grade} ({CONDITION_LABELS[grade]})
        </option>
      ))}
    </select>
  );
}
