// ============================================================================
// main.tsx: THE STARTING POINT OF THE WEBSITE
//
// When you open the site, the browser loads index.html, which loads this file.
// Its only job is to "plug" our React app into the page.
// ============================================================================

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './index.css';

// TanStack Query is the library that fetches data from our server, remembers
// the answers (caching), and re-fetches when needed. This creates its memory.
const queryClient = new QueryClient();

// Find the empty <div id="root"> in index.html. React will draw everything inside it.
const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Draw the app. The tags wrapping <App /> add features to everything inside them:
//   <StrictMode>          extra warnings during development (no effect in production)
//   <QueryClientProvider> lets any component inside fetch data with TanStack Query
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
