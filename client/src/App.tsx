// ============================================================================
// App.tsx: WHICH SCREEN TO SHOW FOR EACH ADDRESS
//
// Every screen sits inside <Layout> (the header and footer), and the address
// in the browser decides which page goes in the middle:
//   /    -> CollectionPage (your records)
//   anything else -> NotFoundPage
// ============================================================================

import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { CollectionPage } from './pages/CollectionPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      {/* A route with no path wraps the ones inside it: Layout shows them via <Outlet />. */}
      <Route element={<Layout />}>
        <Route index element={<CollectionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
