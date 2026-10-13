// ============================================================================
// ScrobblingCard.tsx: CONNECT LAST.FM SO VINYL PLAYS COUNT THERE TOO
//
// "Scrobbling" is Last.fm's word for adding a played song to your history.
// Once connected, plays logged here are sent to Last.fm song by song.
//
// The "Connect" button is a plain link: the browser leaves for Last.fm, the
// person approves the app there, and Last.fm sends them back to this page
// with ?scrobbling=connected (or failed) in the address.
// ============================================================================

import { useSearchParams } from 'react-router';
import { describeError } from '../../api/client';
import { LASTFM_CONNECT_URL, useDisconnectLastfm, useScrobblingStatus } from '../../api/scrobbling';

/** What to say after coming back from Last.fm. */
const RESULTS: Record<string, { text: string; ok: boolean }> = {
  connected: { text: 'Connected. Plays you log from now on go to Last.fm.', ok: true },
  failed: {
    text: "Last.fm didn't confirm the connection. Nothing was changed; you can try again.",
    ok: false,
  },
  unavailable: { text: "Scrobbling isn't available here yet (see below).", ok: false },
};

export function ScrobblingCard() {
  const status = useScrobblingStatus();
  const disconnect = useDisconnectLastfm();
  const [searchParams] = useSearchParams();
  const result = RESULTS[searchParams.get('scrobbling') ?? ''];

  // Nothing to offer while loading, or if the status can't be read.
  if (!status.data) return null;
  const { available, unavailableReason, connected, username } = status.data;

  return (
    <section className="scrobbling-card" aria-label="Scrobbling">
      <h2>Scrobbling</h2>

      {result && (
        <p className={result.ok ? 'save-note' : 'error-box'} role={result.ok ? 'status' : 'alert'}>
          {result.text}
        </p>
      )}

      {connected ? (
        <>
          <p>
            Plays you log are added to <strong>{username}</strong>'s Last.fm history, song by song,
            so your records count alongside what you stream.
          </p>
          <p className="muted">
            Only records with a tracklist can be sent, and Last.fm takes plays from the last two
            weeks. A play logged as “I'm starting now” is sent when it's over.
          </p>
          <button
            type="button"
            className="button button-small"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Stop scrobbling'}
          </button>
          {disconnect.isError && (
            <p className="field-error" role="alert">
              Couldn't disconnect: {describeError(disconnect.error)}
            </p>
          )}
        </>
      ) : available ? (
        <>
          <p>
            Send the records you play to your Last.fm history, so they count alongside what you
            stream. You'll approve it on Last.fm's own site; your Last.fm password is never typed
            here.
          </p>
          {/* A plain link, not a router <Link>: the browser really leaves for Last.fm. */}
          <a href={LASTFM_CONNECT_URL} className="button button-primary">
            Connect to Last.fm
          </a>
        </>
      ) : (
        <p className="muted">
          {unavailableReason === 'demo-account' ? (
            "Scrobbling isn't offered on the shared demo account. Create your own account to try it."
          ) : (
            <>
              Scrobbling isn't set up on this server yet. It needs Last.fm's “shared secret” in the
              server's <code>.env</code> file (<code>LASTFM_SHARED_SECRET</code>), then a restart.
              The README explains where to find it.
            </>
          )}
        </p>
      )}
    </section>
  );
}
