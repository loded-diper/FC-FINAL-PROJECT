import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const { openDatabase } = await import('./db.js');
const { createApp } = await import('./app.js');
const db = openDatabase();
const port = Number(process.env.PORT || 3001);
const server = createApp(db).listen(port, '0.0.0.0', () => console.log(`CampusConnect listening on port ${port}`));
function stop() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
