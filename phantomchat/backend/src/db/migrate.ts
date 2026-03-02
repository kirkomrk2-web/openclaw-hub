/**
 * Database migration runner.
 * Initializes the PhantomChat database schema.
 */

import { initDB, closeDB } from './connection.js';

async function migrate() {
  console.log('Running PhantomChat database migrations...');
  await initDB();
  console.log('Migrations complete.');
  await closeDB();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
