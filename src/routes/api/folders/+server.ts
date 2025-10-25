import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET() {
  const folders = db.prepare('SELECT * FROM folders ORDER BY parentFolderId, name').all();
  return new Response(JSON.stringify(folders), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST({ request }: RequestEvent) {
  const { name, parentFolderId } = await request.json();

  if (!name || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Folder name is required' }), { status: 400 });
  }

  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO folders (name, parentFolderId, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
  const info = stmt.run(name.trim(), parentFolderId || null, now, now);

  const folder = {
    id: info.lastInsertRowid,
    name: name.trim(),
    parentFolderId: parentFolderId || null,
    createdAt: now,
    updatedAt: now
  };

  return new Response(JSON.stringify(folder), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function PUT({ request }: RequestEvent) {
  const { id, name, parentFolderId } = await request.json();

  if (!id) {
    return new Response(JSON.stringify({ error: 'Folder ID is required' }), { status: 400 });
  }

  if (!name || !name.trim()) {
    return new Response(JSON.stringify({ error: 'Folder name is required' }), { status: 400 });
  }

  // Check if trying to move folder into itself or its own descendant
  if (parentFolderId) {
    let checkId = parentFolderId;
    while (checkId) {
      if (checkId === id) {
        return new Response(JSON.stringify({ error: 'Cannot move folder into itself or its descendants' }), { status: 400 });
      }
      const parent: any = db.prepare('SELECT parentFolderId FROM folders WHERE id = ?').get(checkId);
      checkId = parent?.parentFolderId;
    }
  }

  const now = new Date().toISOString();
  const stmt = db.prepare('UPDATE folders SET name = ?, parentFolderId = ?, updatedAt = ? WHERE id = ?');
  const info = stmt.run(name.trim(), parentFolderId || null, now, id);

  if (info.changes === 0) {
    return new Response(JSON.stringify({ error: 'Folder not found' }), { status: 404 });
  }

  const updatedFolder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  return new Response(JSON.stringify(updatedFolder), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function DELETE({ url }: RequestEvent) {
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: 'Folder ID is required' }), { status: 400 });
  }

  // Move all notes in this folder to root (folderId = NULL)
  db.prepare('UPDATE notes SET folderId = NULL WHERE folderId = ?').run(id);

  // Delete the folder (CASCADE will delete child folders)
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
