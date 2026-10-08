// ============================================================================
// NewRecordPage.tsx: THE "ADD A RECORD" SCREEN (/records/new)
//
// Shows an empty form. When you save, the record is sent to the server and
// you're taken to its new page.
// ============================================================================

import { Link, useNavigate } from 'react-router';
import { describeError } from '../api/client';
import { useCreateRecord } from '../api/records';
import { EMPTY_FORM } from '../features/collection/form-values';
import { RecordForm } from '../features/collection/RecordForm';

export function NewRecordPage() {
  const createRecord = useCreateRecord();
  const navigate = useNavigate();

  return (
    <section>
      <Link to="/" className="back-link">
        ← Collection
      </Link>
      <h1>Add a record</h1>
      <RecordForm
        initialValues={EMPTY_FORM}
        submitLabel="Add record"
        cancelTo="/"
        isSaving={createRecord.isPending}
        serverError={createRecord.error ? describeError(createRecord.error) : null}
        onSubmit={(input) =>
          createRecord.mutate(input, {
            onSuccess: (record) => navigate(`/records/${record.id}`),
          })
        }
      />
    </section>
  );
}
