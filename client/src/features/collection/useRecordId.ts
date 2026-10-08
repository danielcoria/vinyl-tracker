// ============================================================================
// useRecordId.ts: READS THE RECORD NUMBER FROM THE ADDRESS
//
// For /records/5 or /records/5/edit this returns 5. For something that isn't
// a record number (like /records/abc) it returns null, so the page can show
// "not found" instead of asking the server.
// ============================================================================

import { useParams } from 'react-router';

export function useRecordId(): number | null {
  // useParams gives the parts of the address named in App.tsx, like ":id".
  const { id } = useParams();
  const number = Number(id);
  return Number.isInteger(number) && number > 0 ? number : null;
}
