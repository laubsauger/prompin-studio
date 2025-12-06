
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as sqliteVec from 'sqlite-vec';
import { fileURLToPath } from 'url';

// Mock path for Mac
// User log says: "Using ffmpeg-static at: /Users/flo/work/code/gen-studio/node_modules/ffmpeg-static/ffmpeg"
const homeDir = process.env.HOME || '/Users/flo';
const dbPath = path.join(homeDir, 'Library/Application Support/prompin-studio/prompin-studio.db');

console.log('Opening DB at:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error('DB file not found!');
    process.exit(1);
}

const db = new Database(dbPath);

try {
    sqliteVec.load(db);
    console.log('sqlite-vec loaded.');
} catch (e) {
    console.error('Failed to load sqlite-vec:', e);
}

// 1. Check vec_assets count
try {
    const ROW = db.prepare('SELECT count(*) as c FROM vec_assets').get();
    console.log('vec_assets count:', ROW.c);
} catch (e) {
    console.error('Failed to query vec_assets:', e);
}

// 2. Check assets count
try {
    const ROW = db.prepare('SELECT count(*) as c FROM assets').get();
    console.log('assets count:', ROW.c);
} catch (e) {
    console.error('Failed to query assets:', e);
}

// 3. Get one asset with embedding
try {
    const asset = db.prepare('SELECT * FROM assets WHERE metadata LIKE "%embedding%" LIMIT 1').get();

    if (asset) {
        console.log('Found asset:', asset.id, asset.path);
        const meta = JSON.parse(asset.metadata);
        if (meta.embedding && Array.isArray(meta.embedding)) {
            console.log('Embedding length:', meta.embedding.length);

            // 4. Try vector search
            // Use simple MATCH query
            const queryVector = JSON.stringify(meta.embedding);
            console.log('Query vector type:', typeof queryVector, 'Length:', queryVector.length);

            // Just select counts from matches
            // We use a simpler query to test basic MATCH functionality
            const stmt = db.prepare(`
                SELECT rowid, distance 
                FROM vec_assets 
                WHERE embedding MATCH ?
                ORDER BY distance
                LIMIT 5
            `);

            const results = stmt.all(queryVector);
            console.log('Vector search results count:', results.length);
            if (results.length > 0) {
                console.log('First result distance:', results[0].distance);
            }
        } else {
            console.log('Asset has no valid embedding array');
        }
    } else {
        console.log('No asset with embedding found');
    }
} catch (e) {
    console.error('Error during checks:', e);
}
