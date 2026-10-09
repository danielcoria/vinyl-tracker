// ============================================================================
// serve-client.ts: THE SERVER ALSO DELIVERS THE WEBSITE (in production)
//
// Online, one program does everything: it answers /api/... AND sends the
// built website (client/dist, made by `npm run build`). In development, Vite
// serves the website instead, so this isn't used.
//
//   /assets/index-Ab12.js   files from client/dist. Their names change whenever
//                           their content changes, so browsers may keep them
//                           for a year.
//   /records/5, /stats...   any other page address gets index.html, and React
//                           Router shows the right screen ("single-page app").
//                           index.html is never cached, so updates show up.
// ============================================================================

import path from 'node:path';
import express, { Router } from 'express';

export function serveClient(distDir: string) {
  const router = Router();

  router.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        const inAssets = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader(
          'Cache-Control',
          inAssets ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
  );

  // Every other page: the app itself. (/api addresses never get here; see app.ts.)
  router.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'index.html'));
  });

  return router;
}
