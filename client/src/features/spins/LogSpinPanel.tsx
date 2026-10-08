// ============================================================================
// LogSpinPanel.tsx: THE "LOG A PLAY" PANEL ON A RECORD'S PAGE
//
//   [✓] Side A  23:55     When:  (•) I just finished
//   [✓] Side B  21:06            ( ) I'm starting now
//                                ( ) Pick a time [__________]
//   Length: 45:01   Notes: [______]   [Log play] [Cancel]
//
// Every side starts ticked, so a full play is one click. The length fills
// itself in from the sides you tick (you can still change it). Records with
// no sides in their tracklist just log the whole record.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { spinInputSchema, type Track, type VinylRecord } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useLogSpin } from '../../api/spins';
import { formatDuration, parseDuration } from '../collection/format';
import { toLocalInputValue } from './dates';
import { formatSides, groupBySide, playLength, sideLetters } from './sides';

type When = 'finished' | 'starting' | 'custom';

type Props = {
  record: VinylRecord;
  tracks: Track[];
  /** Called after a play is logged (with a short description) or on Cancel (with null). */
  onClose: (logged: string | null) => void;
};

export function LogSpinPanel({ record, tracks, onClose }: Props) {
  const id = useId();
  const logSpin = useLogSpin();
  const letters = sideLetters(tracks);
  const sideGroups = groupBySide(tracks).filter((g) => g.side !== null);

  const [chosen, setChosen] = useState<string[]>(letters);
  const [when, setWhen] = useState<When>('finished');
  const [customTime, setCustomTime] = useState(() => toLocalInputValue(new Date()));
  const [notes, setNotes] = useState('');
  // The length box follows the ticked sides until the person types their own.
  const [typedLength, setTypedLength] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const autoLength = playLength(tracks, chosen, record.runtimeSeconds);
  const lengthText = typedLength ?? (autoLength === null ? '' : formatDuration(autoLength));

  function toggleSide(side: string) {
    // Keep sides in record order (A before B) however they're clicked.
    setChosen((current) =>
      current.includes(side)
        ? current.filter((s) => s !== side)
        : letters.filter((s) => s === side || current.includes(s)),
    );
    setTypedLength(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);

    if (letters.length > 0 && chosen.length === 0) return setProblem('Pick at least one side.');
    const durationSeconds = parseDuration(lengthText);
    if (!durationSeconds) return setProblem('Enter how long you played, like 42:49.');

    // We store when the play STARTED. "Just finished" means it started one length ago.
    const now = Date.now();
    const startedAt =
      when === 'finished'
        ? new Date(now - durationSeconds * 1000)
        : when === 'starting'
          ? new Date(now)
          : new Date(customTime);
    if (Number.isNaN(startedAt.getTime())) return setProblem('Pick a valid date and time.');

    const sides = letters.length === 0 || chosen.length === letters.length ? null : chosen;
    const input = {
      recordId: record.id,
      sides,
      playedAt: startedAt.toISOString(),
      durationSeconds,
      notes,
    };
    // Check with the same rules the server uses (e.g. not in the future).
    const parsed = spinInputSchema.safeParse(input);
    if (!parsed.success) return setProblem(parsed.error.issues[0]?.message ?? 'Check the details.');

    logSpin.mutate(input, { onSuccess: () => onClose(formatSides(sides)) });
  }

  return (
    <form className="log-panel" onSubmit={handleSubmit} aria-label="Log a play">
      {sideGroups.length > 0 && (
        <fieldset>
          <legend>Sides played</legend>
          {sideGroups.map(({ side, durationSeconds }) =>
            side === null ? null : (
              <label key={side} className="check">
                <input
                  type="checkbox"
                  checked={chosen.includes(side)}
                  onChange={() => toggleSide(side)}
                />
                Side {side}
                {durationSeconds !== null && (
                  <span className="muted"> {formatDuration(durationSeconds)}</span>
                )}
              </label>
            ),
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>When</legend>
        <label className="check">
          <input
            type="radio"
            name={`${id}-when`}
            checked={when === 'finished'}
            onChange={() => setWhen('finished')}
          />
          I just finished
        </label>
        <label className="check">
          <input
            type="radio"
            name={`${id}-when`}
            checked={when === 'starting'}
            onChange={() => setWhen('starting')}
          />
          I'm starting now
        </label>
        <label className="check">
          <input
            type="radio"
            name={`${id}-when`}
            checked={when === 'custom'}
            onChange={() => setWhen('custom')}
          />
          Pick a start time
        </label>
        {when === 'custom' && (
          <input
            type="datetime-local"
            aria-label="Start time"
            value={customTime}
            onChange={(event) => setCustomTime(event.target.value)}
          />
        )}
      </fieldset>

      <div className="form-row">
        <div className="field">
          <label htmlFor={`${id}-length`}>Length</label>
          <input
            id={`${id}-length`}
            value={lengthText}
            placeholder="42:49"
            onChange={(event) => setTypedLength(event.target.value)}
          />
          <span className="hint">minutes:seconds</span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-notes`}>Notes</label>
          <input
            id={`${id}-notes`}
            value={notes}
            placeholder="Optional"
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {(problem || logSpin.error) && (
        <div className="error-box" role="alert">
          <p>{problem ?? (logSpin.error ? describeError(logSpin.error) : '')}</p>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={logSpin.isPending}>
          {logSpin.isPending ? 'Logging…' : 'Log play'}
        </button>
        <button type="button" className="button" onClick={() => onClose(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
