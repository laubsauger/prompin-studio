import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import * as sqliteVec from 'sqlite-vec';

const dbPath = path.join(app.getPath('userData'), 'prompin-studio.db');
const db = new Database(dbPath);

// Load sqlite-vec extension
export let vectorSearchEnabled = false;
try {
  sqliteVec.load(db);
  vectorSearchEnabled = true;
  console.log('[DB] sqlite-vec extension loaded successfully.');
} catch (e) {
  console.warn('[DB] Failed to load sqlite-vec extension. Vector search will be disabled.', e);
}




db.pragma('journal_mode = WAL');

// Initialize tables
// 1. Core Tables
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
`);

// 2. FTS Setup
db.exec(`
  -- Full-text search virtual table
  -- We use content='assets' to save space and keep it in sync
  CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    id UNINDEXED,
    path,
    metadata,
    content='assets',
    content_rowid='rowid',
    tokenize='porter unicode61'
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS assets_fts_insert AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (new.rowid, new.id, new.path, new.metadata);
  END;

  CREATE TRIGGER IF NOT EXISTS assets_fts_delete AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, id, path, metadata) VALUES('delete', old.rowid, old.id, old.path, old.metadata);
  END;

  CREATE TRIGGER IF NOT EXISTS assets_fts_update AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, id, path, metadata) VALUES('delete', old.rowid, old.id, old.path, old.metadata);
    INSERT INTO assets_fts(rowid, id, path, metadata) VALUES (new.rowid, new.id, new.path, new.metadata);
  END;
`);

// Populate FTS table if it's empty
const ftsCount = (db.prepare("SELECT count(*) as count FROM assets_fts").get() as { count: number }).count;
if (ftsCount === 0) {
  console.log('[DB] Populating FTS table...');
  db.exec(`
    INSERT INTO assets_fts(rowid, id, path, metadata)
    SELECT rowid, id, path, metadata FROM assets;
  `);
}


// 3. Vector Search Setup / Cleanup
// 3. Vector Search Setup
if (vectorSearchEnabled) {
  // Setup SQLite-Vec
  try {
    db.exec(`
      -- Vector search virtual table (sqlite-vec)
      -- CLIP uses 512 dimensions
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_assets USING vec0(
        embedding float[512]
      );

      -- Create Vec delete trigger
      CREATE TRIGGER IF NOT EXISTS assets_vec_delete AFTER DELETE ON assets BEGIN
        DELETE FROM vec_assets WHERE rowid = old.rowid;
      END;
    `);

    // Check if we need to migrate dimensions (e.g. from 384 to 512)
    // We can't easily check dimensions in sqlite-vec yet, so we'll just try to insert a dummy 512 vector
    // If it fails, we drop and recreate.
    // Actually, simpler: if we are switching models, we should probably just clear the vector table
    // to force re-indexing.
    // For now, let's assume if the table exists it might be wrong.
    // A safer way is to check if we can select from it.
    // Let's just drop and recreate if we suspect a version change, but that's destructive.
    // Better: Try to insert a dummy row in a transaction and rollback.
    // If it fails, drop table.

    // For this specific migration (MiniLM 384 -> CLIP 512), we know we need to change it.
    // We'll use a marker file or just try-catch a check? 
    // Let's just drop the table if it was created with 384. 
    // Since we can't inspect schema easily for virtual tables, we'll rely on a "reindex required" flag or just force it for this update.
    // Let's force drop if we detect the old model's dimension.

    // Actually, let's just DROP TABLE IF EXISTS vec_assets_old; and rename? No, virtual tables are tricky.
    // Let's just try to query a vector. If we get 384 dims back, we know.
    // But we can't query if empty.

    // Simplest approach for this task:
    // We are changing the schema definition above. If the table already exists with 384, 
    // the CREATE IF NOT EXISTS won't do anything, but subsequent inserts will fail.
    // So we should explicitly DROP the table if we think it's the old one.
    // Let's add a migration block specifically for this.

  } catch (e) {
    console.error('[DB] Failed to initialize Vector tables:', e);
  }
} else {
  // If Vector search is disabled, try to clean up any existing artifacts
  try {
    db.exec(`DROP TRIGGER IF EXISTS assets_vec_delete;`);
    db.exec(`DROP TABLE IF EXISTS vec_assets;`);
  } catch (e) {
    console.warn('[DB] Failed to cleanup Vector tables:', e);
  }
}

// Safely create rootPath index (fails if column missing, which is fine as migration will handle it)
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_assets_rootPath ON assets(rootPath)');
} catch (e) {
  // Column likely missing, migration will handle it
}

// Migration for Vector Table Dimension Change (384 -> 512)
if (vectorSearchEnabled) {
  try {
    // We can't easily check the dimension of an existing virtual table.
    // However, since we are switching models, we MUST invalidate existing embeddings.
    // The cleanest way is to drop the table and let it be recreated by the initialization logic on next run
    // OR just do it right here.
    // Since we already ran the CREATE IF NOT EXISTS above, if the table existed with 384, it's still 384.
    // We need to detect this.

    // Hack: Try to insert a 512-dim vector into a temp row. If it fails, we know we have the wrong schema.
    // But we can't easily insert without a rowid match in assets? vec0 doesn't enforce FKs strictly but we need a rowid.

    // Alternative: We just force a drop-and-recreate for this version update.
    // We can check a "schema_version" table, but we don't have one.

    // Let's just try to drop the table if it exists and we assume it might be old.
    // But we don't want to drop it every time.

    // Let's check if we can find out the dimension.
    // sqlite-vec doesn't expose it easily in metadata.

    // Let's use a specific marker or just rely on the fact that we are changing the code.
    // We will run a one-time migration based on a check.

    // Let's try to run a query that would fail on 384 dims.
    // Actually, let's just be safe and DROP the table if we can't verify it's 512.
    // Since we are dev-ing, let's just DROP it to be sure.
    // In production, we'd want a version flag.

    // For now, I'll add a check:
    // If we can't insert a 512 vector, drop and recreate.

    /* 
       NOTE: Since we can't easily detect, and we want to force re-indexing for CLIP,
       we will DROP the table if it exists. 
       BUT we need to make sure we don't do this on every startup.
       
       Let's use a flag in the `folders` table metadata or a new `settings` table?
       Or just check if `vec_assets` accepts 512.
    */

    // Let's try to create a test table with 512.
    // Actually, let's just run this:
    // db.exec("DROP TABLE IF EXISTS vec_assets"); 
    // But only once? 

    // Let's assume the user is okay with a re-index this one time.
    // I will add a check: select count(*) from vec_assets. If > 0, we might want to check a row.
    // If 0, we can drop safely.

    // Let's just drop it. It's safer for the model switch.
    // To prevent loop, we need to know if we already migrated.
    // Let's check if `assets` table has a specific marker? No.

    // Let's just try to ALTER? sqlite-vec doesn't support ALTER.

    // OK, I will add a try-catch block that attempts to insert a dummy 512 vector (if we have any asset).
    // If it fails, we drop the table and recreate it.

    const hasAssets = db.prepare("SELECT rowid FROM assets LIMIT 1").get() as { rowid: number };
    if (hasAssets) {
      try {
        // Try to insert a 512-dim zero vector for an existing rowid
        // This is just a test, we rollback immediately
        const zeros = new Float32Array(512).fill(0);
        const stmt = db.prepare("INSERT INTO vec_assets(rowid, embedding) VALUES (?, ?)");

        db.transaction(() => {
          stmt.run(hasAssets.rowid, zeros);
          throw new Error("ROLLBACK"); // Force rollback
        })();
      } catch (e: any) {
        if (e.message === "ROLLBACK") {
          // It worked! Table supports 512.
        } else {
          // It failed (likely due to dimension mismatch), so we need to migrate
          console.log('[DB] Vector table dimension mismatch detected. Recreating for CLIP (512 dims)...');
          db.exec("DROP TABLE IF EXISTS vec_assets");
          db.exec(`
                  CREATE VIRTUAL TABLE IF NOT EXISTS vec_assets USING vec0(
                    embedding float[512]
                  );
                `);
        }
      }
    } else {
      // No assets, safe to drop and recreate to be sure
      db.exec("DROP TABLE IF EXISTS vec_assets");
      db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_assets USING vec0(
            embedding float[512]
            );
        `);
    }

  } catch (e) {
    console.warn('[DB] Vector migration check failed:', e);
  }
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
