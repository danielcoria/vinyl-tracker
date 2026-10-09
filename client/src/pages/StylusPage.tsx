// ============================================================================
// StylusPage.tsx: THE STYLUS WEAR TRACKER (/stylus)
//
//   AT-VM540ML · installed Oct 1, 2026                    [Edit] [Install new]
//   ⚠ Replace soon                          412 of 500 h · 82%
//   [██████████████████████████████░░░░░░]
//   About 88 hours left, roughly 120 more plays at your usual length.
//
//   Past styluses: name, dates, hours used...
//
// Wear comes from the listening diary, so there's nothing else to keep track of.
// ============================================================================

import { useState } from 'react';
import type { Stylus, StylusInput } from '@vinyl/shared';
import { describeError } from '../api/client';
import { useAddStylus, useDeleteStylus, useStyluses, useUpdateStylus } from '../api/styluses';
import { formatShortDate } from '../features/spins/dates';
import { formatStylusHours, STATUS_DISPLAY } from '../features/stylus/status';
import { StylusForm } from '../features/stylus/StylusForm';
import { StylusMeter } from '../features/stylus/StylusMeter';

export function StylusPage() {
  const styluses = useStyluses();
  const addStylus = useAddStylus();
  const [installing, setInstalling] = useState(false);

  if (styluses.isPending) return <p className="muted">Loading…</p>;
  if (styluses.isError) {
    return (
      <div className="error-box" role="alert">
        <p>Couldn't load your styluses: {describeError(styluses.error)}</p>
      </div>
    );
  }

  const active = styluses.data.find((s) => s.retiredAt === null) ?? null;
  const past = styluses.data.filter((s) => s.retiredAt !== null);

  function install(input: StylusInput) {
    addStylus.mutate(input, { onSuccess: () => setInstalling(false) });
  }

  const installForm = (
    <StylusForm
      submitLabel={active ? 'Install new stylus' : 'Add stylus'}
      isSaving={addStylus.isPending}
      serverError={addStylus.error ? describeError(addStylus.error) : null}
      onSubmit={install}
      onCancel={active ? () => setInstalling(false) : undefined}
    />
  );

  return (
    <section className="stylus-page">
      <div className="page-header">
        <h1>Stylus</h1>
        {active && !installing && (
          <button type="button" className="button" onClick={() => setInstalling(true)}>
            Install a new stylus
          </button>
        )}
      </div>

      {!active && (
        <div className="stats-card">
          <h2>Track your stylus</h2>
          <p className="muted">
            A stylus wears out after a few hundred to a thousand-plus hours of play, and a worn one
            can damage your records. Add yours, and every play you log counts toward its wear.
          </p>
          {installForm}
        </div>
      )}

      {active && installing && (
        <div className="stats-card">
          <h2>Install a new stylus</h2>
          <p className="muted">
            “{active.name}” will move to your past styluses on the day the new one is installed.
          </p>
          {installForm}
        </div>
      )}

      {active && <ActiveStylus stylus={active} />}

      {past.length > 0 && <PastStyluses styluses={past} />}
    </section>
  );
}

function ActiveStylus({ stylus }: { stylus: Stylus }) {
  const [editing, setEditing] = useState(false);
  const updateStylus = useUpdateStylus(stylus.id);
  const hoursLeft = stylus.ratedHours - stylus.hoursUsed;

  return (
    <section className="stats-card stylus-active" aria-label="Stylus in use">
      <div className="card-header">
        <div>
          <h2>{stylus.name}</h2>
          <p className="muted">
            In use since {formatShortDate(stylus.installedAt)} · {stylus.spinCount}{' '}
            {stylus.spinCount === 1 ? 'play' : 'plays'} logged
          </p>
        </div>
        {!editing && (
          <button type="button" className="button button-small" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <StylusForm
          stylus={stylus}
          submitLabel="Save changes"
          isSaving={updateStylus.isPending}
          serverError={updateStylus.error ? describeError(updateStylus.error) : null}
          onSubmit={({ name, ratedHours, initialHours }) =>
            updateStylus.mutate(
              { name, ratedHours, initialHours },
              { onSuccess: () => setEditing(false) },
            )
          }
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <StylusMeter stylus={stylus} />
          <p className="stylus-estimate">{estimate(stylus, hoursLeft)}</p>
        </>
      )}
    </section>
  );
}

/** A plain-words summary of how much life is left. */
function estimate(stylus: Stylus, hoursLeft: number): string {
  if (hoursLeft <= 0) {
    return `It's ${formatStylusHours(-hoursLeft)} past its rating. A worn stylus can damage your records, so it's time for a new one.`;
  }
  const plays = stylus.averageSpinSeconds
    ? Math.floor((hoursLeft * 3600) / stylus.averageSpinSeconds)
    : null;
  const left = `About ${formatStylusHours(hoursLeft)} left`;
  return plays === null
    ? `${left}.`
    : `${left}, roughly ${plays.toLocaleString()} more ${plays === 1 ? 'play' : 'plays'} at your usual length.`;
}

function PastStyluses({ styluses }: { styluses: Stylus[] }) {
  const deleteStylus = useDeleteStylus();

  function handleDelete(stylus: Stylus) {
    if (window.confirm(`Delete “${stylus.name}” from your past styluses?`)) {
      deleteStylus.mutate(stylus.id);
    }
  }

  return (
    <section className="stats-card" aria-labelledby="past-heading">
      <h2 id="past-heading">Past styluses</h2>
      {deleteStylus.isError && (
        <p className="field-error" role="alert">
          {describeError(deleteStylus.error)}
        </p>
      )}
      <ul className="stylus-history">
        {styluses.map((stylus) => (
          <li key={stylus.id}>
            <div>
              <strong>{stylus.name}</strong>
              <span className="muted">
                {' '}
                · {formatShortDate(stylus.installedAt)} –{' '}
                {stylus.retiredAt ? formatShortDate(stylus.retiredAt) : ''}
              </span>
            </div>
            <span>
              {formatStylusHours(stylus.hoursUsed)}{' '}
              <span className="muted">
                · {stylus.percentUsed}% of its rating ({STATUS_DISPLAY[stylus.status].icon})
              </span>
            </span>
            <button
              type="button"
              className="button button-icon"
              aria-label={`Delete ${stylus.name}`}
              onClick={() => handleDelete(stylus)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
