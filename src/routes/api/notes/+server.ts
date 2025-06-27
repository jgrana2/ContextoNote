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
