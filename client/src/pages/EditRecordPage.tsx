// ============================================================================
// EditRecordPage.tsx: THE "EDIT A RECORD" SCREEN (/records/:id/edit)
//
// Loads the record, shows the form filled in with its details, and saves your
// changes back to the server. Then it returns to the record's page.
// ============================================================================

import { Link, useNavigate } from 'react-router';
import { ApiRequestError, describeError } from '../api/client';
import { useRecord, useUpdateRecord } from '../api/records';
import { toFormValues } from '../features/collection/form-values';
import { RecordForm } from '../features/collection/RecordForm';
import { useRecordId } from '../features/collection/useRecordId';
import { NotFoundPage } from './NotFoundPage';

const MISSING_MESSAGE = "This record doesn't exist. It may have been deleted.";

export function EditRecordPage() {
  const id = useRecordId();
  if (id === null) return <NotFoundPage message={MISSING_MESSAGE} />;
  return <EditRecord id={id} />;
}

function EditRecord({ id }: { id: number }) {
  const record = useRecord(id);
  const updateRecord = useUpdateRecord(id);
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

  return (
    <section>
      <Link to={`/records/${id}`} className="back-link">
        ← {record.data.title}
      </Link>
      <h1>Edit record</h1>
      <RecordForm
        initialValues={toFormValues(record.data)}
        submitLabel="Save changes"
        cancelTo={`/records/${id}`}
        isSaving={updateRecord.isPending}
        serverError={updateRecord.error ? describeError(updateRecord.error) : null}
        onSubmit={(input) =>
          updateRecord.mutate(input, {
            onSuccess: () => navigate(`/records/${id}`),
          })
        }
      />
    </section>
  );
}
