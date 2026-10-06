// ============================================================================
// setup.ts: RUNS BEFORE EVERY WEBSITE TEST
//
// Adds extra checks like toBeInTheDocument(), and clears the fake page
// after each test so tests start fresh.
// ============================================================================

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
