/// <reference types="vitest/config" />
// ============================================================================
// vite.config.ts: SETTINGS FOR VITE (the website's development tool)
//
// Vite does two jobs:
//   - `npm run dev`: runs the website at http://localhost:5173 and reloads it
//     instantly when you save a file
//   - `npm run build`: bundles everything into small files in client/dist/,
//     ready to put online
// This file also holds settings for Vitest, the tool that runs our tests.
// ============================================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Teach Vite how to understand React's JSX syntax.
  plugins: [react()],
  server: {
    port: 5173,
    // "Proxy": when the website asks for anything starting with /api, Vite
    // forwards it to our server on port 3001. So the website never needs the
    // Discogs token; only the server has it.
    proxy: { '/api': 'http://localhost:3001' },
  },
  test: {
    // Tests run in Node, not a real browser. jsdom fakes a browser page so
    // React components can be drawn and checked in tests.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests that fill in whole forms can take a few seconds when every test file
    // runs at once; 15 s (instead of 5) avoids false failures on busy machines.
    testTimeout: 15_000,
  },
});
