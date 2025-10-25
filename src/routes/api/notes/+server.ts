import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET() {
  const notes = db.prepare('SELECT * FROM notes ORDER BY id DESC').all();
  return new Response(JSON.stringify(notes), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST({ request }: RequestEvent) {
  const { title, content, date, dateRaw, folderId } = await request.json();
  const stmt = db.prepare('INSERT INTO notes (title, content, date, dateRaw, folderId) VALUES (?, ?, ?, ?, ?)');
  const info = stmt.run(title, content, date, dateRaw, folderId || null);
  const note = { id: info.lastInsertRowid, title, content, date, dateRaw, folderId: folderId || null };
  return new Response(JSON.stringify(note), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function PUT({ request }: RequestEvent) {
  const { id, title, content, folderId } = await request.json();
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
  return new Response(JSON.stringify(updatedNote), {
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
