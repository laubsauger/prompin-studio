import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'gen-studio.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unsorted',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    metadata JSON,
    thumbnailPath TEXT
  );

  CREATE TABLE IF NOT EXISTS folders (
    path TEXT PRIMARY KEY,
    color TEXT,
    metadata JSON
  );
`);

// Migration for existing databases
try {
  db.exec('ALTER TABLE assets ADD COLUMN thumbnailPath TEXT');
} catch (error) {
  // Column likely exists or other error, ignore
}

export default db;
