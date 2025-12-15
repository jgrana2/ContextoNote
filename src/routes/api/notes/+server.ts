import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET() {
  const notes = db.prepare('SELECT * FROM notes ORDER BY id DESC').all();
  // Convert favorite integer to boolean for frontend
  const processedNotes = notes.map(note => ({
    ...note,
    favorite: !!note.favorite
  }));
  return new Response(JSON.stringify(processedNotes), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST({ request }: RequestEvent) {
  const { title, content, date, dateRaw, folderId, favorite } = await request.json();
  const stmt = db.prepare('INSERT INTO notes (title, content, date, dateRaw, folderId, favorite) VALUES (?, ?, ?, ?, ?, ?)');
  const favoriteValue = favorite ? 1 : 0;
  const info = stmt.run(title, content, date, dateRaw, folderId || null, favoriteValue);
  const note = { id: info.lastInsertRowid, title, content, date, dateRaw, folderId: folderId || null, favorite: !!favoriteValue };
  return new Response(JSON.stringify(note), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function PUT({ request }: RequestEvent) {
  const { id, title, content, folderId, favorite } = await request.json();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note ID' }), { status: 400 });
  }

  // Build dynamic update query based on provided fields
  const updates: string[] = [];
  const values: any[] = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }
  if (folderId !== undefined) {
    updates.push('folderId = ?');
    values.push(folderId);
  }
  if (favorite !== undefined) {
    updates.push('favorite = ?');
    values.push(favorite ? 1 : 0);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 });
  }

  values.push(id);
  const stmt = db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`);
  const info = stmt.run(...values);

  if (info.changes === 0) {
    return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 });
  }

  const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  const processedNote = {
    ...updatedNote,
    favorite: !!updatedNote.favorite
  };
  return new Response(JSON.stringify(processedNote), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function DELETE({ url }: RequestEvent) {
  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing note id' }), { status: 400 });
  }
  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
