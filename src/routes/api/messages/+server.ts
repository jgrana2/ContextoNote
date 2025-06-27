import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
  try {
    const { conversationId, role, content } = await request.json();
    const now = new Date().toISOString();
    
    // Insert message
    const stmt = db.prepare(`
      INSERT INTO messages (conversationId, role, content, createdAt) 
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(conversationId, role, content, now);
    
    // Update conversation's updatedAt timestamp
    db.prepare('UPDATE conversations SET updatedAt = ? WHERE id = ?').run(now, conversationId);
    
    const message = {
      id: info.lastInsertRowid,
      conversationId,
      role,
      content,
      createdAt: now
    };
    
    return new Response(JSON.stringify(message), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return new Response(JSON.stringify({ error: 'Failed to create message' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT({ request }: RequestEvent) {
  try {
    const { id, content } = await request.json();
    
    const stmt = db.prepare('UPDATE messages SET content = ? WHERE id = ?');
    stmt.run(content, id);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return new Response(JSON.stringify({ error: 'Failed to update message' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}