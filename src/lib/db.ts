import Database from 'better-sqlite3';

const db = new Database('contextnote.db');

// Create folders table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parentFolderId INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (parentFolderId) REFERENCES folders (id) ON DELETE CASCADE
  );
`);

// Create notes table if it doesn't exist (legacy)
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    dateRaw TEXT
  );
`);

// Migration: Add folderId column to notes table if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(notes)").all() as any[];
  const hasFolderId = tableInfo.some((col: any) => col.name === 'folderId');

  if (!hasFolderId) {
    console.log('Migrating notes table: adding folderId column...');
    db.exec(`ALTER TABLE notes ADD COLUMN folderId INTEGER`);
    console.log('Migration complete!');
  }
} catch (error) {
  console.error('Error checking/migrating notes table:', error);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    contextNotes TEXT -- JSON array of note IDs
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationId INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (conversationId) REFERENCES conversations (id) ON DELETE CASCADE
  );
`);

export default db;
