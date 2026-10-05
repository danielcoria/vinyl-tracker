import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  // shared/ ships TypeScript source, so bundle it into the server output.
  noExternal: ['@vinyl/shared'],
});
