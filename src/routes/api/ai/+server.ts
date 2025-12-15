// src/routes/api/ai/+server.ts
import type { RequestEvent } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import OpenAI from "openai";
import { OPENAI_API_KEY } from "$env/static/private";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function POST({ request }: RequestEvent) {
    try {
        const body = await request.json();
        const { messages, prompt } = body;
        
        // Handle both old prompt format and new messages format
        let finalMessages;
        if (messages && Array.isArray(messages) && messages.length > 0) {
            finalMessages = messages;
        } else if (prompt && typeof prompt === 'string') {
            finalMessages = [{ role: 'user', content: prompt }];
        } else {
            throw error(400, 'Either messages array or prompt string required');
        }

        const stream = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: finalMessages,
            stream: true,
        });

        const encoder = new TextEncoder();
        const responseStream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const part of stream) {
                        const delta = part.choices?.[0]?.delta;
                        if (delta?.content) {
                            controller.enqueue(encoder.encode(delta.content));
                        }
                    }
                } catch (streamError) {
                    console.error('Streaming error:', streamError);
                    controller.error(streamError);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(responseStream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    } catch (requestError) {
        console.error('Request error:', requestError);
        
        // Check if it's a validation error that should return 400
        if (requestError?.status === 400) {
            throw requestError;
        }
        
        // Return JSON error response instead of throwing SvelteKit error
        return new Response(JSON.stringify({
            error: 'Failed to process AI request',
            details: requestError?.message || 'Unknown error'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}