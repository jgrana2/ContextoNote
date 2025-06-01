// src/routes/api/ai/+server.ts
import type { RequestEvent } from "@sveltejs/kit";
import Together from "together-ai";
import { TOGETHER_API_KEY } from "$env/static/private";

// Instanciar el cliente de Together AI
const client = new Together({ apiKey: TOGETHER_API_KEY });

export async function POST({ request }: RequestEvent) {
    const { prompt } = await request.json();

    // Llamada en streaming al LLM usando la librería together-ai
    const stream = await client.chat.completions.create({
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        stream: true
    });

    // Crear un ReadableStream para reemitir chunks al cliente
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
        async start(controller) {
            try {
                for await (const part of stream) {
                    const delta = part.choices?.[0]?.delta;
                    if (delta && typeof delta.content === "string") {
                        const chunk = encoder.encode(delta.content);
                        controller.enqueue(chunk);
                    }
                }
                controller.close();
            } catch (err) {
                controller.error(err);
            }
        }
    });

    return new Response(responseStream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache"
        }
    });
}