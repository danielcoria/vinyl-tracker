// ============================================================================
// LastfmConnect.tsx: THE BOX FOR ENTERING A LAST.FM USERNAME
//
// Only the username is needed: Last.fm's "top albums" are public. It's saved
// as a setting, and can be changed or disconnected later.
// ============================================================================

import { useId, useState, type FormEvent } from 'react';
import { lastfmUsernameSchema } from '@vinyl/shared';
import { describeError } from '../../api/client';
import { useUpdateSettings } from '../../api/dust';

type Props = {
  /** The username saved now, if any. */
  current: string | null;
  /** Called after saving (or disconnecting). */
  onDone?: () => void;
};

export function LastfmConnect({ current, onDone }: Props) {
  const id = useId();
  const updateSettings = useUpdateSettings();
  const [username, setUsername] = useState(current ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Check with the same rule the server uses.
    const parsed = lastfmUsernameSchema.safeParse(username);
    if (!parsed.success)
      return setProblem(parsed.error.issues[0]?.message ?? 'Check the username.');
    setProblem(null);
    updateSettings.mutate({ lastfmUsername: parsed.data }, { onSuccess: onDone });
  }

  return (
    <form className="lastfm-connect" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${id}-username`}>Last.fm username</label>
        <input
          id={`${id}-username`}
          value={username}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setUsername(event.target.value)}
        />
        <span className="hint">
          Only the username is needed (no password). It's the name in your Last.fm profile's
          address: last.fm/user/<em>name</em>.
        </span>
      </div>
      {(problem || updateSettings.isError) && (
        <p className="field-error" role="alert">
          {problem ?? (updateSettings.error ? describeError(updateSettings.error) : '')}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={updateSettings.isPending}>
          {updateSettings.isPending ? 'Saving…' : current ? 'Save' : 'Compare with my shelf'}
        </button>
        {current && (
          <button
            type="button"
            className="button"
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ lastfmUsername: null }, { onSuccess: onDone })}
          >
            Disconnect
          </button>
        )}
      </div>
    </form>
  );
}
