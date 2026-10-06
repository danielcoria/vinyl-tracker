// ============================================================================
// tsup.config.ts: SETTINGS FOR BUILDING THE SERVER
//
// npm run build turns our TypeScript into plain JavaScript in server/dist/,
// which is what runs when the app is put online. tsup is the tool that does it.
// ============================================================================

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  // shared/ ships TypeScript source, so bundle it into the server output.
  noExternal: ['@vinyl/shared'],
});
