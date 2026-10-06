import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';

const config = loadConfig();
const db = createDb(config.databasePath);
const app = createApp({ db });

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
  console.log(`Discogs token: ${config.discogs.token ? 'configured' : 'missing'}`);
});
