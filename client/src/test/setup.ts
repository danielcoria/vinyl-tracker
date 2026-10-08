// ============================================================================
// setup.ts: RUNS BEFORE EVERY WEBSITE TEST
//
// Adds extra checks like toBeInTheDocument(), and after each test clears the
// fake page and removes any fake `fetch`, so tests start fresh.
// ============================================================================

import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// How long `findBy...` and `waitFor` wait for something to appear before failing.
// The default (1 second) is too tight when many test files run at once on a busy
// machine (like GitHub's CI). Tests still continue the moment it appears.
configure({ asyncUtilTimeout: 3000 });

// The pretend browser used in tests (jsdom) has no ResizeObserver, which charts
// use to measure their size. This stand-in does nothing, so charts just draw empty.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
