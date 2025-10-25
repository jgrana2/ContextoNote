import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
  try {
    const notes = db.prepare("SELECT id, title, dateRaw FROM notes WHERE folderId IS NULL AND title LIKE 'Daily%'").all() as any[];

    // Map to store month names in Spanish
    const monthNames: { [key: string]: string } = {
      '01': 'Enero',
      '02': 'Febrero',
      '03': 'Marzo',
      '04': 'Abril',
      '05': 'Mayo',
      '06': 'Junio',
      '07': 'Julio',
      '08': 'Agosto',
      '09': 'Septiembre',
      '10': 'Octubre',
      '11': 'Noviembre',
      '12': 'Diciembre'
    };

    // Track folders we create/find
    const folderCache: { [key: string]: number } = {};

    // Get existing folders to avoid duplicates
    const existingFolders = db.prepare('SELECT id, name FROM folders').all() as any[];
    existingFolders.forEach(folder => {
      folderCache[folder.name] = folder.id;
    });

    let organized = 0;
    let skipped = 0;

    for (const note of notes) {
      if (!note.dateRaw || typeof note.dateRaw !== 'string') {
        skipped++;
        continue;
      }

      // Parse DD/MM format
      const parts = note.dateRaw.split('/');
      if (parts.length !== 2) {
        skipped++;
        continue;
      }

      const month = parts[1]; // MM part

      if (!monthNames[month]) {
        skipped++;
        continue;
      }

      const folderName = `Dailies ${monthNames[month]}`;

      // Get or create folder
      let folderId: number;
      if (folderCache[folderName]) {
        folderId = folderCache[folderName];
      } else {
        // Create new folder
        const now = new Date().toISOString();
        const stmt = db.prepare('INSERT INTO folders (name, parentFolderId, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
        const info = stmt.run(folderName, null, now, now);
        folderId = info.lastInsertRowid as number;
        folderCache[folderName] = folderId;
      }

      // Move note to folder
      db.prepare('UPDATE notes SET folderId = ? WHERE id = ?').run(folderId, note.id);
      organized++;
    }

    return new Response(JSON.stringify({
      success: true,
      organized,
      skipped,
      message: `Organizadas ${organized} notas Daily en carpetas mensuales. ${skipped} notas omitidas.`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error organizing notes:', error);
    return new Response(JSON.stringify({
      error: 'Error al organizar notas',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
