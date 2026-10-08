// ============================================================================
// setup.ts: RUNS BEFORE EVERY WEBSITE TEST
//
// Adds extra checks like toBeInTheDocument(), and after each test clears the
// fake page and removes any fake `fetch`, so tests start fresh.
// ============================================================================

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
