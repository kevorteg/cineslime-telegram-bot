const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'cineslime.db');

// Ensure database directory exists
const dirName = path.dirname(dbPath);
if (!fs.existsSync(dirName)) {
  fs.mkdirSync(dirName, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database ' + dbPath + ': ' + err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initSchema();
  }
});

function initSchema() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      role TEXT DEFAULT 'user', -- 'user', 'admin'
      is_whitelisted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Media Content table
    // Stores file references from the private channel
    db.run(`CREATE TABLE IF NOT EXISTS media_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER, -- Can be null if not matched yet
      type TEXT, -- 'movie' or 'tv'
      title TEXT NOT NULL,
      year INTEGER,
      file_id TEXT NOT NULL,
      quality TEXT, -- '720p', '1080p', '4K'
      language TEXT, -- 'Latino', 'Castellano', 'Subtitulado'
      caption TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Index for faster search
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_title ON media_content(title)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_media_tmdb_id ON media_content(tmdb_id)`);

    // Requests table
    db.run(`CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tmdb_id INTEGER NOT NULL,
      type TEXT DEFAULT 'movie',
      title TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'rejected'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Favorites table
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tmdb_id INTEGER NOT NULL,
      type TEXT DEFAULT 'movie',
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tmdb_id)
    )`);

    // Settings / Config table for Maintenance Mode
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    // Add is_banned column if not exists (SQLite "add column" is safe to run even if table exists, but we need to try/catch or check)
    // For simplicity in this environment, we'll try to add it. If it fails (already exists), we catch it.
    try {
      db.run(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0`, (err) => {
        /* Ignore duplicate column error */
      });
    } catch (e) { }

  });
}

// Promisify common DB operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.log('Error running sql ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.log('Error running sql: ' + sql);
        console.log(err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  db,
  run,
  get,
  all
};
