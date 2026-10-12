// ============================================================================
// TonightPage.tsx: "WHAT SHOULD I PLAY TONIGHT?" (/tonight)
//
// Pick how much time you have, a genre and a mood; the page shows three
// records from your own shelf with the reasons they were picked. "Shuffle"
// shows three different ones. The choices live in the address
// (/tonight?minutes=45&mood=neglected), so a reload keeps them.
// ============================================================================

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SUGGESTION_COUNT, SUGGESTION_MOODS, type SuggestionMood } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useSuggestions } from '../api/suggestions';
import { SuggestionCard } from '../features/tonight/SuggestionCard';

const TIMES: { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'No limit' },
  { minutes: 20, label: '20 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '90 min' },
];

const MOOD_LABELS: Record<SuggestionMood, string> = {
  any: 'Anything',
  favorites: 'Favorites',
  neglected: 'Neglected',
};

function isMood(value: string | null): value is SuggestionMood {
  return SUGGESTION_MOODS.some((mood) => mood === value);
}

export function TonightPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const minutesParam = Number(searchParams.get('minutes'));
  const minutes = TIMES.some((t) => t.minutes === minutesParam) ? minutesParam : null;
  const genre = searchParams.get('genre');
  const moodParam = searchParams.get('mood');
  const mood: SuggestionMood = isMood(moodParam) ? moodParam : 'any';

  // Records already shown, left out by Shuffle. They only count for the question
  // they were shown for: changing the time, genre or mood starts fresh.
  const question = `${minutes}|${genre}|${mood}`;
  const [shown, setShown] = useState<{ question: string; ids: number[] }>({ question, ids: [] });
  const exclude = shown.question === question ? shown.ids : [];

  const result = useSuggestions({ minutes, genre, mood, exclude });

  function setParam(name: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(name);
    else next.set(name, value);
    setSearchParams(next, { replace: true });
  }

  const picks = result.data?.suggestions ?? [];
  const matchCount = result.data?.matchCount ?? 0;
  const seenAll = exclude.length + picks.length >= matchCount;

  return (
    <section className="tonight">
      <div className="page-header">
        <h1>What should I play tonight?</h1>
      </div>

      <div className="tonight-ask">
        <div className="field">
          <span className="label" id="tonight-time">
            Time you have
          </span>
          <div className="segmented" role="group" aria-labelledby="tonight-time">
            {TIMES.map((time) => (
              <button
                key={time.label}
                type="button"
                aria-pressed={time.minutes === minutes}
                onClick={() =>
                  setParam('minutes', time.minutes === null ? null : String(time.minutes))
                }
              >
                {time.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label" id="tonight-mood">
            In the mood for
          </span>
          <div className="segmented" role="group" aria-labelledby="tonight-mood">
            {SUGGESTION_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={m === mood}
                onClick={() => setParam('mood', m === 'any' ? null : m)}
              >
                {MOOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="tonight-genre">Genre</label>
          <select
            id="tonight-genre"
            value={genre ?? ''}
            onChange={(event) => setParam('genre', event.target.value || null)}
          >
            <option value="">Any genre</option>
            {/* Keep a genre from the address selectable even before the list has loaded. */}
            {[...new Set([...(genre ? [genre] : []), ...(result.data?.genres ?? [])])].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {result.isPending ? (
        <p className="muted">Looking through your shelf…</p>
      ) : result.isError ? (
        <div className="error-box" role="alert">
          <p>Couldn't get suggestions: {describeError(result.error)}</p>
        </div>
      ) : matchCount === 0 ? (
        <div className="empty-state">
          {result.data.genres.length === 0 && genre === null && minutes === null ? (
            <>
              <h2>Nothing to suggest yet</h2>
              <p>Suggestions come from your own shelf. Add a few records first.</p>
              <Link to="/discogs" className="button button-primary">
                Add from Discogs
              </Link>
            </>
          ) : (
            <>
              <h2>Nothing on your shelf fits</h2>
              <p>Try more time, another genre, or no limit.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <ul
            className={result.isPlaceholderData ? 'suggestions is-refreshing' : 'suggestions'}
            aria-label="Suggestions"
          >
            {picks.map((suggestion) => (
              <SuggestionCard
                key={suggestion.record.id}
                suggestion={suggestion}
                minutes={minutes}
              />
            ))}
          </ul>

          <div className="tonight-more">
            {seenAll ? (
              exclude.length > 0 && (
                <>
                  <span className="muted">That's everything that fits.</span>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setShown({ question, ids: [] })}
                  >
                    Start over
                  </button>
                </>
              )
            ) : (
              <button
                type="button"
                className="button"
                disabled={result.isPlaceholderData}
                onClick={() =>
                  setShown({ question, ids: [...exclude, ...picks.map((s) => s.record.id)] })
                }
              >
                ↻ Shuffle
              </button>
            )}
            <span className="muted">
              {matchCount <= SUGGESTION_COUNT
                ? `${matchCount} of your records ${matchCount === 1 ? 'fits' : 'fit'}`
                : `Picked from ${matchCount} records that fit`}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
