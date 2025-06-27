import db from '$lib/db';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET() {
  try {
    // Get all conversations
    const conversations = db.prepare(`
      SELECT id, title, createdAt, updatedAt, contextNotes
      FROM conversations
      ORDER BY updatedAt DESC
    `).all();

    // Get messages for each conversation
    const conversationsWithMessages = conversations.map(conv => {
      const messages = db.prepare(`
        SELECT id, role, content, createdAt
        FROM messages
        WHERE conversationId = ?
        ORDER BY createdAt ASC
      `).all(conv.id);

      return {
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        contextNotes: conv.contextNotes ? JSON.parse(conv.contextNotes) : [],
        messages: messages
      };
    });

    return new Response(JSON.stringify(conversationsWithMessages), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch conversations' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST({ request }: RequestEvent) {
  try {
    const { title, contextNotes = [] } = await request.json();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO conversations (title, createdAt, updatedAt, contextNotes) 
      VALUES (?, ?, ?, ?)
    `);
    
    const info = stmt.run(title, now, now, JSON.stringify(contextNotes));
    
    const conversation = {
      id: info.lastInsertRowid,
      title,
      createdAt: now,
      updatedAt: now,
      contextNotes,
      messages: []
    };
    
    return new Response(JSON.stringify(conversation), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT({ request }: RequestEvent) {
  try {
    const { id, title, contextNotes } = await request.json();
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      UPDATE conversations 
      SET title = ?, updatedAt = ?, contextNotes = ?
      WHERE id = ?
    `);
    
    stmt.run(title, now, JSON.stringify(contextNotes), id);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return new Response(JSON.stringify({ error: 'Failed to update conversation' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE({ url }: RequestEvent) {
  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing conversation id' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete conversation (messages will be deleted automatically due to CASCADE)
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete conversation' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}