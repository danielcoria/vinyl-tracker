// ============================================================================
// RecordDetailPage.tsx: ONE RECORD'S PAGE (/records/:id)
//
// Shows everything about a record, with buttons to edit or delete it.
// ============================================================================

import { Link, useNavigate } from 'react-router';
import type { Condition, VinylRecord } from '@vinyl/shared';
import { ApiRequestError, describeError } from '../api/client';
import { useDeleteRecord, useRecord } from '../api/records';
import { CONDITION_LABELS, formatArtists, formatDuration } from '../features/collection/format';
import { RecordCover } from '../features/collection/RecordCover';
import { useRecordId } from '../features/collection/useRecordId';
import { NotFoundPage } from './NotFoundPage';

const MISSING_MESSAGE = "This record doesn't exist. It may have been deleted.";

export function RecordDetailPage() {
  const id = useRecordId();
  // Hooks must run on every render, so we only check `id` after calling them.
  if (id === null) return <NotFoundPage message={MISSING_MESSAGE} />;
  return <RecordDetail id={id} />;
}

function RecordDetail({ id }: { id: number }) {
  const record = useRecord(id);
  const deleteRecord = useDeleteRecord();
  const navigate = useNavigate();

  if (record.isPending) return <p className="muted">Loading…</p>;
  if (record.isError) {
    if (record.error instanceof ApiRequestError && record.error.status === 404) {
      return <NotFoundPage message={MISSING_MESSAGE} />;
    }
    return (
      <div className="error-box" role="alert">
        <p>Couldn't load this record: {describeError(record.error)}</p>
      </div>
    );
  }

  const r = record.data;

  function handleDelete() {
    // window.confirm shows the browser's built-in OK/Cancel box.
    if (!window.confirm(`Delete “${r.title}”? This can't be undone.`)) return;
    deleteRecord.mutate(r.id, {
      // replace: true -> the back button won't return to the deleted record.
      onSuccess: () => navigate('/', { replace: true }),
    });
  }

  return (
    <article>
      <Link to="/" className="back-link">
        ← Collection
      </Link>

      <div className="record-detail">
        <RecordCover record={r} />

        <div>
          <h1>{r.title}</h1>
          <p className="artist">{formatArtists(r.artists)}</p>

          <dl className="facts">
            {facts(r).map(([label, value]) => (
              <Fact key={label} label={label} value={value} />
            ))}
          </dl>

          <TagList label="Genres" tags={r.genres} />
          <TagList label="Styles" tags={r.styles} />

          {r.notes && (
            <>
              <h2 className="visually-hidden">Notes</h2>
              <p className="notes">{r.notes}</p>
            </>
          )}

          {deleteRecord.isError && (
            <div className="error-box" role="alert">
              <p>Couldn't delete this record: {describeError(deleteRecord.error)}</p>
            </div>
          )}

          <div className="actions">
            <Link to={`/records/${r.id}/edit`} className="button">
              Edit
            </Link>
            {r.discogsReleaseId === null ? (
              // Opens the Discogs search, already filled in with this record's artist and title.
              <Link to={findOnDiscogsUrl(r)} className="button">
                Find on Discogs
              </Link>
            ) : (
              // target="_blank" opens Discogs in a new tab.
              <a
                href={`https://www.discogs.com/release/${r.discogsReleaseId}`}
                className="button"
                target="_blank"
                rel="noreferrer"
              >
                View on Discogs ↗
              </a>
            )}
            <button
              type="button"
              className="button button-danger"
              onClick={handleDelete}
              disabled={deleteRecord.isPending}
            >
              {deleteRecord.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** The Discogs search page in "link" mode, searching for this record's artist and title. */
function findOnDiscogsUrl(r: VinylRecord): string {
  const q = [r.artists[0]?.name, r.title].filter(Boolean).join(' ');
  return `/discogs?${new URLSearchParams({ link: String(r.id), q })}`;
}

/** The label/value pairs to show, skipping any the record doesn't have. */
function facts(r: VinylRecord): [string, string][] {
  const rows: [string, string | null][] = [
    ['Year', r.year === null ? null : String(r.year)],
    ['Label', [r.label, r.catalogNumber].filter(Boolean).join(' · ') || null],
    ['Format', r.format],
    ['Length', r.runtimeSeconds === null ? null : formatDuration(r.runtimeSeconds)],
    ['Media', conditionText(r.mediaCondition)],
    ['Sleeve', conditionText(r.sleeveCondition)],
    ['Added', formatDate(r.addedAt)],
  ];
  return rows.filter((row): row is [string, string] => row[1] !== null);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function TagList({ label, tags }: { label: string; tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="field tag-group">
      <span className="label">{label}</span>
      <ul className="tags" aria-label={label}>
        {tags.map((tag) => (
          <li key={tag} className="tag">
            {tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

function conditionText(grade: Condition | null): string | null {
  return grade === null ? null : `${grade} (${CONDITION_LABELS[grade]})`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
