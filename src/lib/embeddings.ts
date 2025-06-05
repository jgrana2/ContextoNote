// Browser-compatible imports
let pipeline: any = null;
let env: any = null;

// Dynamic import for browser compatibility
async function loadTransformers() {
    if (!pipeline) {
        const transformers = await import('@xenova/transformers');
        pipeline = transformers.pipeline;
        env = transformers.env;
        
        // Configure to allow downloading models from HuggingFace
        env.allowRemoteModels = true;
        env.allowLocalModels = true;
        env.useBrowserCache = true;
    }
    return { pipeline, env };
}

class EmbeddingService {
    private embedder: any = null;
    private isLoading = false;
    private cache = new Map<string, number[]>();
    private noteEmbeddings = new Map<number, number[]>(); // Store embeddings by note ID
    private processingQueue: Set<number> = new Set(); // Track notes being processed

    async initialize() {
        if (this.embedder || this.isLoading) return;
        
        this.isLoading = true;
        try {
            console.log('Loading Transformers.js library...');
            const { pipeline: pipelineFunc } = await loadTransformers();
            
            console.log('Initializing local embedding model (downloading ~22MB model)...');
            
            // Use a smaller, faster model for local embedding
            this.embedder = await pipelineFunc('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                progress_callback: (progress: any) => {
                    if (progress.status === 'downloading') {
                        console.log(`Downloading ${progress.file}: ${Math.round(progress.progress || 0)}%`);
                    } else if (progress.status === 'ready') {
                        console.log(`Model ready: ${progress.file}`);
                    }
                }
            });
            
            console.log('✅ Embedding model loaded successfully - local semantic search active!');
            
            // Load cache from localStorage
            this.loadCache();
            this.loadNoteEmbeddings();
        } catch (error) {
            console.error('❌ Failed to load embedding model:', error);
            this.embedder = null;
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async getEmbedding(text: string): Promise<number[]> {
        if (!this.embedder) {
            await this.initialize();
        }

        // Check cache first
        const cacheKey = this.getCacheKey(text);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
        }

        try {
            // Generate embedding
            const result = await this.embedder(text, { pooling: 'mean', normalize: true });
            const embedding = Array.from(result.data);
            
            // Cache the result
            this.cache.set(cacheKey, embedding);
            this.saveCache();
            
            return embedding;
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw error;
        }
    }

    async getMultipleEmbeddings(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        
        for (const text of texts) {
            try {
                const embedding = await this.getEmbedding(text);
                embeddings.push(embedding);
            } catch (error) {
                console.warn(`Failed to get embedding for text: ${text.substring(0, 50)}...`);
                // Return zero vector as fallback
                embeddings.push(new Array(384).fill(0)); // all-MiniLM-L6-v2 has 384 dimensions
            }
        }
        
        return embeddings;
    }

    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    async findSimilarNotes(query: string, notes: any[], maxResults: number = 10): Promise<any[]> {
        try {
            const queryEmbedding = await this.getEmbedding(query);
            const noteTexts = notes.map(note => `${note.title}\n${note.content}`);
            const noteEmbeddings = await this.getMultipleEmbeddings(noteTexts);

            const similarities = noteEmbeddings.map((embedding, index) => ({
                ...notes[index],
                similarity: this.cosineSimilarity(queryEmbedding, embedding),
                embeddingGenerated: true
            }));

            return similarities
                .filter(note => note.similarity > 0.1) // Minimum similarity threshold
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, maxResults);

        } catch (error) {
            console.error('Error in similarity search:', error);
            return [];
        }
    }

    private getCacheKey(text: string): string {
        // Create a simple hash for caching
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    private loadCache() {
        try {
            const cached = localStorage.getItem('embeddings_cache');
            if (cached) {
                const parsedCache = JSON.parse(cached);
                this.cache = new Map(Object.entries(parsedCache));
                console.log(`Loaded ${this.cache.size} cached embeddings`);
            }
        } catch (error) {
            console.warn('Failed to load embedding cache:', error);
        }
    }

    private saveCache() {
        try {
            // Only keep the most recent 1000 embeddings to avoid localStorage bloat
            if (this.cache.size > 1000) {
                const entries = Array.from(this.cache.entries());
                this.cache = new Map(entries.slice(-1000));
            }
            
            const cacheObj = Object.fromEntries(this.cache);
            localStorage.setItem('embeddings_cache', JSON.stringify(cacheObj));
        } catch (error) {
            console.warn('Failed to save embedding cache:', error);
        }
    }

    // Process a single note and store its embedding
    async processNote(note: any): Promise<void> {
        if (!this.embedder || this.processingQueue.has(note.id)) return;
        
        this.processingQueue.add(note.id);
        try {
            const noteText = `${note.title}\n${note.content}`;
            const embedding = await this.getEmbedding(noteText);
            this.noteEmbeddings.set(note.id, embedding);
            this.saveNoteEmbeddings();
            console.log(`✅ Processed embedding for note: ${note.title}`);
        } catch (error) {
            console.warn(`Failed to process embedding for note ${note.id}:`, error);
        } finally {
            this.processingQueue.delete(note.id);
        }
    }

    // Process multiple notes in background
    async processNotes(notes: any[]): Promise<void> {
        if (!this.embedder) {
            console.log('Embedding model not ready, skipping note processing');
            return;
        }

        console.log(`Processing embeddings for ${notes.length} notes...`);
        
        // Process in batches to avoid overwhelming the browser
        const batchSize = 3;
        for (let i = 0; i < notes.length; i += batchSize) {
            const batch = notes.slice(i, i + batchSize);
            const promises = batch
                .filter(note => !this.noteEmbeddings.has(note.id)) // Skip already processed
                .map(note => this.processNote(note));
            
            await Promise.allSettled(promises);
            
            // Small delay between batches to keep UI responsive
            if (i + batchSize < notes.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`✅ Finished processing ${notes.length} notes. Total embeddings: ${this.noteEmbeddings.size}`);
    }

    // Fast similarity search using pre-computed embeddings
    async findSimilarNotesOptimized(query: string, notes: any[], threshold: number = 0.25): Promise<any[]> {
        try {
            const queryEmbedding = await this.getEmbedding(query);
            
            const similarities = notes
                .filter(note => this.noteEmbeddings.has(note.id)) // Only notes with embeddings
                .map(note => {
                    const noteEmbedding = this.noteEmbeddings.get(note.id)!;
                    return {
                        ...note,
                        similarity: this.cosineSimilarity(queryEmbedding, noteEmbedding),
                        embeddingGenerated: true
                    };
                });

            const results = similarities
                .filter(note => note.similarity >= threshold)
                .sort((a, b) => b.similarity - a.similarity);

            console.log(`Found ${results.length} similar notes using pre-computed embeddings (threshold: ${threshold})`);
            return results;

        } catch (error) {
            console.error('Error in optimized similarity search:', error);
            // Fallback to on-demand generation
            return this.findSimilarNotes(query, notes, Math.min(notes.length, 10));
        }
    }

    // Check if note has embedding
    hasEmbedding(noteId: number): boolean {
        return this.noteEmbeddings.has(noteId);
    }

    // Remove embedding for deleted note
    removeNoteEmbedding(noteId: number): void {
        this.noteEmbeddings.delete(noteId);
        this.saveNoteEmbeddings();
    }

    private loadNoteEmbeddings() {
        try {
            const saved = localStorage.getItem('note_embeddings');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.noteEmbeddings = new Map(Object.entries(parsed).map(([id, emb]) => [parseInt(id), emb as number[]]));
                console.log(`Loaded ${this.noteEmbeddings.size} note embeddings from cache`);
            }
        } catch (error) {
            console.warn('Failed to load note embeddings:', error);
        }
    }

    private saveNoteEmbeddings() {
        try {
            const obj = Object.fromEntries(this.noteEmbeddings);
            localStorage.setItem('note_embeddings', JSON.stringify(obj));
        } catch (error) {
            console.warn('Failed to save note embeddings:', error);
        }
    }

    clearCache() {
        this.cache.clear();
        this.noteEmbeddings.clear();
        localStorage.removeItem('embeddings_cache');
        localStorage.removeItem('note_embeddings');
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            noteEmbeddings: this.noteEmbeddings.size,
            processingQueue: this.processingQueue.size,
            isModelLoaded: !!this.embedder,
            isLoading: this.isLoading
        };
    }
}

// Singleton instance
export const embeddingService = new EmbeddingService();