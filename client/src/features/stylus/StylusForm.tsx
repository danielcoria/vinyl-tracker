// ============================================================================
// StylusForm.tsx: THE FORM FOR ADDING OR EDITING A STYLUS
//
// Name, the maker's rated hours, hours already on it, and (for a new stylus)
// the day it was installed. Checked with the same rules the server uses.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { stylusInputSchema, type Stylus, type StylusInput } from '@vinyl/shared';
import { toLocalInputValue } from '../spins/dates';

type Props = {
  /** Editing an existing stylus (no install date), or adding a new one. */
  stylus?: Stylus;
  submitLabel: string;
  isSaving: boolean;
  serverError: string | null;
  onSubmit: (input: StylusInput) => void;
  onCancel?: () => void;
};

export function StylusForm({
  stylus,
  submitLabel,
  isSaving,
  serverError,
  onSubmit,
  onCancel,
}: Props) {
  const id = useId();
  const [name, setName] = useState(stylus?.name ?? '');
  const [ratedHours, setRatedHours] = useState(String(stylus?.ratedHours ?? 500));
  const [initialHours, setInitialHours] = useState(String(stylus?.initialHours ?? 0));
  // A date box wants "2026-10-08"; we take the date part of the local date-time.
  const [installedOn, setInstalledOn] = useState(() => toLocalInputValue(new Date()).slice(0, 10));
  const [problem, setProblem] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input: StylusInput = {
      name,
      ratedHours: Number(ratedHours),
      initialHours: initialHours.trim() === '' ? 0 : Number(initialHours),
      // Installed "today" means right now; an earlier day means the start of that day.
      installedAt:
        installedOn === toLocalInputValue(new Date()).slice(0, 10)
          ? new Date().toISOString()
          : new Date(`${installedOn}T00:00`).toISOString(),
    };
    const parsed = stylusInputSchema.safeParse(input);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    setProblem(null);
    onSubmit(input);
  }

  return (
    <form className="stylus-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-name`}>Stylus</label>
        <input
          id={`${id}-name`}
          value={name}
          placeholder="Audio-Technica VM540ML"
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-rated`}>Rated hours</label>
          <input
            id={`${id}-rated`}
            type="number"
            inputMode="numeric"
            value={ratedHours}
            onChange={(event) => setRatedHours(event.target.value)}
          />
          <span className="hint">
            Check the maker's rating. Typical: conical 300–500 h, elliptical 500–800 h, micro-line
            1,000 h or more.
          </span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-initial`}>Hours already on it</label>
          <input
            id={`${id}-initial`}
            type="number"
            inputMode="numeric"
            value={initialHours}
            onChange={(event) => setInitialHours(event.target.value)}
          />
          <span className="hint">0 for a new stylus. Your best guess for a used one.</span>
        </div>
        {!stylus && (
          <div className="field">
            <label htmlFor={`${id}-installed`}>Installed on</label>
            <input
              id={`${id}-installed`}
              type="date"
              value={installedOn}
              onChange={(event) => setInstalledOn(event.target.value)}
            />
            <span className="hint">Plays logged from this day on count toward its wear.</span>
          </div>
        )}
      </div>

      {(problem || serverError) && (
        <div className="error-box" role="alert">
          <p>{problem ?? serverError}</p>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
