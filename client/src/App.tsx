// ============================================================================
// App.tsx: WHICH SCREEN TO SHOW FOR EACH ADDRESS
//
// Every screen sits inside <Layout> (the header and footer), and the address
// in the browser decides which page goes in the middle:
//   /                 -> CollectionPage (your records)
//   /records/new      -> NewRecordPage (add a record)
//   /records/5        -> RecordDetailPage (record number 5)
//   /records/5/edit   -> EditRecordPage (edit record number 5)
//   /discogs          -> DiscogsPage (search Discogs and import)
//   /diary            -> DiaryPage (every logged play, newest first)
//   /stats            -> StatsPage (totals, top artists/records, genres by month)
//   /dust             -> DustPage (records you haven't played in a while)
//   anything else     -> NotFoundPage
// ============================================================================

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { DiaryPage } from './pages/DiaryPage';
import { DiscogsPage } from './pages/DiscogsPage';
import { DustPage } from './pages/DustPage';
import { EditRecordPage } from './pages/EditRecordPage';
import { NewRecordPage } from './pages/NewRecordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecordDetailPage } from './pages/RecordDetailPage';

// "Lazy" = only downloaded when someone opens the Stats page. It brings in the
// chart library (Recharts), which is big, so other pages load faster without it.
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));

export function App() {
  return (
    <Routes>
      {/* A route with no path wraps the ones inside it: Layout shows them via <Outlet />. */}
      <Route element={<Layout />}>
        <Route index element={<CollectionPage />} />
        {/* "new" is listed before ":id" so /records/new isn't treated as a record number. */}
        <Route path="records/new" element={<NewRecordPage />} />
        {/* ":id" is a placeholder: /records/5 shows the page with id = "5". */}
        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="records/:id/edit" element={<EditRecordPage />} />
        <Route path="discogs" element={<DiscogsPage />} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="dust" element={<DustPage />} />
        <Route
          path="stats"
          element={
            // Shown for a moment while the Stats page downloads.
            <Suspense fallback={<p className="muted">Loading…</p>}>
              <StatsPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
