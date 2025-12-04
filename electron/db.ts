import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqliteVss = require('sqlite-vss');

const dbPath = path.join(app.getPath('userData'), 'gen-studio.db');
const db = new Database(dbPath);

// Load sqlite-vss extension
export let vectorSearchEnabled = false;
try {
  // Load vector0 extension first (required dependency)
  db.loadExtension(sqliteVss.getVectorLoadablePath());
  // Then load vss0 extension
  db.loadExtension(sqliteVss.getVssLoadablePath());
  vectorSearchEnabled = true;
  console.log('[DB] sqlite-vss extension loaded successfully.');
} catch (e) {
  console.warn('[DB] Failed to load sqlite-vss extension. Vector search will be disabled.', e);
}

db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    rootPath TEXT NOT NULL DEFAULT 'legacy',
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unsorted',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    metadata JSON,
    thumbnailPath TEXT,
    UNIQUE(rootPath, path)
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
  -- We use a standard FTS table instead of external content (content=assets)
  -- because external content + concurrent writes causes corruption in this environment.
  -- We also handle updates manually to avoid triggers.
  
  DROP TABLE IF EXISTS assets_fts; -- Force recreation to remove content=assets option
  CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    id UNINDEXED,
    path,
    metadata,
    tokenize='porter unicode61'
  );

  -- Cleanup old triggers
  DROP TRIGGER IF EXISTS assets_fts_insert;
  DROP TRIGGER IF EXISTS assets_fts_delete;
  DROP TRIGGER IF EXISTS assets_fts_update;
  
  DROP TRIGGER IF EXISTS assets_vss_insert;
  DROP TRIGGER IF EXISTS assets_vss_update;
  DROP TRIGGER IF EXISTS assets_vss_update_null;

  -- We also keep FTS delete trigger as it is safe
  CREATE TRIGGER IF NOT EXISTS assets_fts_delete AFTER DELETE ON assets BEGIN
    DELETE FROM assets_fts WHERE rowid = old.rowid;
  END;
`);

if (vectorSearchEnabled) {
  db.exec(`
    -- Vector search virtual table
    -- 384 dimensions for all-MiniLM-L6-v2
    CREATE VIRTUAL TABLE IF NOT EXISTS vss_assets USING vss0(
      embedding(384)
    );

    -- We keep VSS delete trigger as it is safe and convenient
    CREATE TRIGGER IF NOT EXISTS assets_vss_delete AFTER DELETE ON assets BEGIN
      DELETE FROM vss_assets WHERE rowid = old.rowid;
    END;
  `);
} else {
  // If VSS is disabled, ensure we don't have leftover triggers that might fail
  db.exec(`DROP TRIGGER IF EXISTS assets_vss_delete;`);
}

// Safely create rootPath index (fails if column missing, which is fine as migration will handle it)
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_assets_rootPath ON assets(rootPath)');
} catch (e) {
  // Column likely missing, migration will handle it
}

console.log('[DB] Initializing Database...');

// Migration for rootPath and removing UNIQUE(path)
try {
  // Check if rootPath column exists using pragma
  const columns = db.pragma('table_info(assets)') as { name: string }[];
  const hasRootPath = columns.some(c => c.name === 'rootPath');
  console.log('[DB] hasRootPath:', hasRootPath);

  if (!hasRootPath) {
    console.log('[DB] Migrating database: adding rootPath and updating constraints...');

    // Cleanup potential leftovers from failed migrations
    db.exec('DROP TABLE IF EXISTS assets_old');
    db.exec('DROP TABLE IF EXISTS asset_tags_new');

    const runMigration = db.transaction(() => {
      // Disable FKs temporarily
      db.pragma('foreign_keys = OFF');

      // 1. Rename existing tables
      db.exec('ALTER TABLE assets RENAME TO assets_old');

      // Drop indexes that were attached to the old table to free up the names
      db.exec('DROP INDEX IF EXISTS idx_assets_path');
      db.exec('DROP INDEX IF EXISTS idx_assets_type');
      db.exec('DROP INDEX IF EXISTS idx_assets_status');
      db.exec('DROP INDEX IF EXISTS idx_assets_created');
      db.exec('DROP INDEX IF EXISTS idx_assets_updated');

      // 2. Create new assets table
      db.exec(`
                CREATE TABLE assets (
                    id TEXT PRIMARY KEY,
                    path TEXT NOT NULL,
                    rootPath TEXT NOT NULL DEFAULT 'legacy',
                    type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'unsorted',
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL,
                    metadata JSON,
                    thumbnailPath TEXT,
                    UNIQUE(rootPath, path)
                )
            `);

      // 3. Copy data
      db.exec(`
                INSERT INTO assets (id, path, type, status, createdAt, updatedAt, metadata, thumbnailPath)
                SELECT id, path, type, status, createdAt, updatedAt, metadata, thumbnailPath
                FROM assets_old
            `);

      // 4. Recreate indexes and triggers
      db.exec(`
                CREATE INDEX idx_assets_path ON assets(path);
                CREATE INDEX idx_assets_type ON assets(type);
                CREATE INDEX idx_assets_status ON assets(status);
                CREATE INDEX idx_assets_created ON assets(createdAt);
                CREATE INDEX idx_assets_updated ON assets(updatedAt);
                CREATE INDEX idx_assets_rootPath ON assets(rootPath);
            `);

      // 5. Handle asset_tags
      db.exec('CREATE TABLE IF NOT EXISTS asset_tags_new (assetId TEXT NOT NULL, tagId TEXT NOT NULL, PRIMARY KEY (assetId, tagId), FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE, FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE)');
      // Check if asset_tags exists before selecting from it
      const hasAssetTags = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='asset_tags'").get();
      if (hasAssetTags) {
        db.exec('INSERT INTO asset_tags_new SELECT * FROM asset_tags');
        db.exec('DROP TABLE asset_tags');
      }
      db.exec('ALTER TABLE asset_tags_new RENAME TO asset_tags');

      // 6. Drop old table
      db.exec('DROP TABLE assets_old');

      // 7. Recreate FTS triggers
      db.exec('DROP TABLE IF EXISTS assets_fts');
      db.exec(`
                CREATE VIRTUAL TABLE assets_fts USING fts5(
                    id UNINDEXED,
                    path,
                    metadata,
                    content=assets,
                    content_rowid=rowid,
                    tokenize='porter unicode61'
                )
            `);

      db.exec(`
                CREATE TRIGGER assets_fts_insert AFTER INSERT ON assets BEGIN
                    INSERT INTO assets_fts(rowid, id, path, metadata)
                    VALUES (new.rowid, new.id, new.path, new.metadata);
                END;
            `);
      db.exec(`
                CREATE TRIGGER assets_fts_delete AFTER DELETE ON assets BEGIN
                    DELETE FROM assets_fts WHERE rowid = old.rowid;
                END;
            `);
      db.exec(`
                CREATE TRIGGER assets_fts_update AFTER UPDATE ON assets BEGIN
                    DELETE FROM assets_fts WHERE rowid = old.rowid;
                    INSERT INTO assets_fts(rowid, id, path, metadata)
                    VALUES (new.rowid, new.id, new.path, new.metadata);
                END;
            `);

      // Populate FTS
      db.exec(`
                INSERT INTO assets_fts(rowid, id, path, metadata)
                SELECT rowid, id, path, metadata FROM assets
            `);

      db.pragma('foreign_keys = ON');
    });

    runMigration();
    console.log('Migration complete.');
  }
} catch (error) {
  console.error('Migration failed:', error);
  // Re-throw to ensure the app knows something is wrong, or at least log it visibly
  throw error;
}

// Legacy migration for thumbnailPath (keep just in case)
try {
  db.exec('ALTER TABLE assets ADD COLUMN thumbnailPath TEXT');
} catch (error) {
  // Column likely exists
}

export default db;
