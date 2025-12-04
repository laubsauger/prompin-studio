import Database from 'better-sqlite3';

const dbPath = '/Users/flo/Library/Application Support/prompin-studio/gen-studio.db';
console.log(`Opening DB at ${dbPath}`);

const db = new Database(dbPath);

try {
    const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number };
    console.log(`Total assets: ${assetCount.count}`);

    const assets = db.prepare('SELECT id, metadata FROM assets LIMIT 5').all() as { id: string, metadata: string }[];
    console.log('Sample assets:');
    assets.forEach(a => {
        const meta = JSON.parse(a.metadata);
        console.log(`- ID: ${a.id}`);
        console.log(`  Has embedding: ${!!meta.embedding}`);
        if (meta.embedding) {
            console.log(`  Embedding length: ${meta.embedding.length}`);
        }
    });

    const assetsWithEmbedding = db.prepare(`
        SELECT COUNT(*) as count 
        FROM assets 
        WHERE json_extract(metadata, '$.embedding') IS NOT NULL
    `).get() as { count: number };
    console.log(`Assets with embedding (via SQL): ${assetsWithEmbedding.count}`);

} catch (error) {
    console.error('Error:', error);
}
