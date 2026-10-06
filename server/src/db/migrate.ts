// Applies pending migrations. The server also does this on startup;
// this script exists for running it explicitly (e.g. before a deploy).
import { loadConfig } from '../config.js';
import { createDb } from './client.js';

const { databasePath } = loadConfig();
createDb(databasePath);
console.log(`Migrations applied to ${databasePath}`);
