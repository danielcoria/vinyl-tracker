// ============================================================================
// App.tsx: WHICH SCREEN TO SHOW FOR EACH ADDRESS
//
// Every screen sits inside <Layout> (the header and footer), and the address
// in the browser decides which page goes in the middle:
//   /             -> CollectionPage (your records)
//   /records/5    -> RecordDetailPage (record number 5)
//   anything else -> NotFoundPage
// ============================================================================

import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecordDetailPage } from './pages/RecordDetailPage';

export function App() {
  return (
    <Routes>
      {/* A route with no path wraps the ones inside it: Layout shows them via <Outlet />. */}
      <Route element={<Layout />}>
        <Route index element={<CollectionPage />} />
        {/* ":id" is a placeholder: /records/5 shows the page with id = "5". */}
        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
