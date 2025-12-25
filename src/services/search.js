const Fuse = require('fuse.js');
const db = require('../database/db');

/**
 * Valid search options for Fuse.js
 */
const FUSE_OPTIONS = {
    includeScore: true,
    threshold: 0.4, // 0.0 is perfect match, 1.0 is match anything
    keys: ['title', 'original_title']
};

/**
 * Search for content in the local database using fuzzy matching.
 * @param {string} query - The search string.
 * @returns {Promise<Array>} - List of matching media items.
 */
async function searchLocalContent(query) {
    // Fetch all titles (or a cached subset if DB is huge, but for now fetch all)
    // Optimization: In a real large production app, we wouldn't fetch all. 
    // We might use SQLite's FTS5, but user asked for fuzzy search logic like Levenshtein.
    // Fuse.js is good for in-memory. Let's fetch basic info.

    try {
        const rows = await db.all('SELECT * FROM media_content GROUP BY tmdb_id');

        if (rows.length === 0) return [];

        const fuse = new Fuse(rows, FUSE_OPTIONS);
        const results = fuse.search(query);

        // Map back to original row structure
        return results.map(r => r.item);
    } catch (error) {
        console.error('Local Search Error:', error);
        return [];
    }
}

module.exports = {
    searchLocalContent
};
