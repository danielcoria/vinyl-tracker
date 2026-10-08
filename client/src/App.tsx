// ============================================================================
// App.tsx: WHICH SCREEN TO SHOW FOR EACH ADDRESS
//
// Every screen sits inside <Layout> (the header and footer), and the address
// in the browser decides which page goes in the middle:
//   /                 -> CollectionPage (your records)
//   /records/new      -> NewRecordPage (add a record)
//   /records/5        -> RecordDetailPage (record number 5)
//   /records/5/edit   -> EditRecordPage (edit record number 5)
//   anything else     -> NotFoundPage
// ============================================================================

import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { EditRecordPage } from './pages/EditRecordPage';
import { NewRecordPage } from './pages/NewRecordPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecordDetailPage } from './pages/RecordDetailPage';

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
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
