import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This would use OpenAI embeddings or similar in production
// For now, implementing a more sophisticated keyword-based approach
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { query, notes, maxResults = 5 } = await request.json();
        
        if (!query || !notes) {
            return json({ error: 'Query and notes are required' }, { status: 400 });
        }

        // Enhanced semantic search algorithm
        const rankedNotes = rankNotesByRelevance(query, notes, maxResults);
        
        return json({ 
            relevantNotes: rankedNotes,
            totalScanned: notes.length 
        });
    } catch (error) {
        console.error('Semantic search error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};

function rankNotesByRelevance(query: string, notes: any[], maxResults: number) {
    const queryWords = extractKeywords(query);
    const queryEntities = extractEntities(query);
    
    return notes.map(note => {
        let score = 0;
        const noteText = `${note.title} ${note.content}`.toLowerCase();
        const noteWords = extractKeywords(noteText);
        
        // 1. Exact phrase matching (highest weight)
        if (noteText.includes(query.toLowerCase())) {
            score += 10;
        }
        
        // 2. Keyword overlap with TF-IDF style scoring
        const commonWords = queryWords.filter(word => noteWords.includes(word));
        const keywordScore = commonWords.reduce((acc, word) => {
            const termFreq = (noteText.match(new RegExp(word, 'g')) || []).length;
            const titleBoost = note.title.toLowerCase().includes(word) ? 5 : 1;
            return acc + (termFreq * titleBoost);
        }, 0);
        score += keywordScore;
        
        // 3. Semantic similarity (simple word embedding approximation)
        score += calculateSemanticSimilarity(queryWords, noteWords);
        
        // 4. Entity matching (people, places, concepts)
        score += matchEntities(queryEntities, extractEntities(noteText));
        
        // 5. Recency boost
        const daysSinceCreation = (Date.now() - new Date(note.date).getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 2 - daysSinceCreation / 30);
        score += recencyBoost;
        
        // 6. Length normalization (avoid bias toward longer notes)
        const lengthNormalization = Math.log(noteText.length / 100) / 10;
        score = score / (1 + lengthNormalization);
        
        return {
            ...note,
            relevanceScore: score,
            matchedKeywords: commonWords,
            explanation: generateExplanation(score, commonWords, recencyBoost)
        };
    })
    .filter(note => note.relevanceScore > 0.1)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults);
}

function extractKeywords(text: string): string[] {
    return text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .filter(word => !isStopWord(word))
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 0);
}

function extractEntities(text: string): string[] {
    // Simple entity extraction - in production, use NER models
    const entities: string[] = [];
    
    // Capitalized words (potential proper nouns)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
    entities.push(...capitalizedWords);
    
    // Dates
    const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];
    entities.push(...dates);
    
    // Numbers
    const numbers = text.match(/\b\d+\b/g) || [];
    entities.push(...numbers);
    
    return entities.map(e => e.toLowerCase());
}

function calculateSemanticSimilarity(words1: string[], words2: string[]): number {
    // Simple word overlap similarity
    // In production, use actual word embeddings (Word2Vec, GloVe, etc.)
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return (intersection.size / union.size) * 3; // Jaccard similarity with boost
}

function matchEntities(entities1: string[], entities2: string[]): number {
    const matches = entities1.filter(e => entities2.includes(e));
    return matches.length * 2; // Entity matches are valuable
}

function generateExplanation(score: number, keywords: string[], recencyBoost: number): string {
    const parts = [];
    if (keywords.length > 0) {
        parts.push(`Matched keywords: ${keywords.join(', ')}`);
    }
    if (recencyBoost > 0.5) {
        parts.push('Recent note');
    }
    return parts.join(' | ');
}

function isStopWord(word: string): boolean {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'pero', 'en', 'con', 'por', 'para', 'de'
    ]);
    return stopWords.has(word.toLowerCase());
}