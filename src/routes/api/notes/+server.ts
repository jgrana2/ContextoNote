import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET() {
  const notes = db.prepare('SELECT * FROM notes ORDER BY id DESC').all();
  return new Response(JSON.stringify(notes), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST({ request }: RequestEvent) {
  const { title, content, date, dateRaw } = await request.json();
  const stmt = db.prepare('INSERT INTO notes (title, content, date, dateRaw) VALUES (?, ?, ?, ?)');
  const info = stmt.run(title, content, date, dateRaw);
  const note = { id: info.lastInsertRowid, title, content, date, dateRaw };
  return new Response(JSON.stringify(note), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function PUT({ request }: RequestEvent) {
  const { id, title, content } = await request.json();
  if (!id || !title || !content) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
  }
  
  const stmt = db.prepare('UPDATE notes SET title = ?, content = ? WHERE id = ?');
  const info = stmt.run(title, content, id);
  
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
