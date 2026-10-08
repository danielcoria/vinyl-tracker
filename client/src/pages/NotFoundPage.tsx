// ============================================================================
// NotFoundPage.tsx: SHOWN WHEN THE ADDRESS DOESN'T MATCH ANY SCREEN
// ============================================================================

import { Link } from 'react-router';

export function NotFoundPage({ message = "This page doesn't exist." }: { message?: string }) {
  return (
    <section className="empty-state">
      <h1>Not found</h1>
      <p>{message}</p>
      <Link to="/" className="button">
        Back to your collection
      </Link>
    </section>
  );
}
