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

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS asset_tags (
    assetId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    PRIMARY KEY (assetId, tagId),
    FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
  );

  -- Create indexes for search performance
  CREATE INDEX IF NOT EXISTS idx_assets_path ON assets(path);
  CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
  CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
  CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(createdAt);
  CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updatedAt);

  -- Full-text search virtual table
  CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    id UNINDEXED,
    path,
    metadata,
    content=assets,
    content_rowid=rowid,
    tokenize='porter unicode61'
  );

  -- Triggers to keep FTS index in sync
  CREATE TRIGGER IF NOT EXISTS assets_fts_insert AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, id, path, metadata)
    VALUES (new.rowid, new.id, new.path, new.metadata);
  END;

  CREATE TRIGGER IF NOT EXISTS assets_fts_delete AFTER DELETE ON assets BEGIN
    DELETE FROM assets_fts WHERE rowid = old.rowid;
  END;

  CREATE TRIGGER IF NOT EXISTS assets_fts_update AFTER UPDATE ON assets BEGIN
    DELETE FROM assets_fts WHERE rowid = old.rowid;
    INSERT INTO assets_fts(rowid, id, path, metadata)
    VALUES (new.rowid, new.id, new.path, new.metadata);
  END;
`);

// Migration for existing databases
try {
  db.exec('ALTER TABLE assets ADD COLUMN thumbnailPath TEXT');
} catch (error) {
  // Column likely exists or other error, ignore
}

export default db;
