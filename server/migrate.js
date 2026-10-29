import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { openDatabase } = await import('./db.js');
const db = openDatabase();
console.log('SQLite migration complete. Schema version:', db.prepare('PRAGMA user_version').get().user_version);
db.close();
