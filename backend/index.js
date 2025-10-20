import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// --- Load the knowledge base ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgeBasePath = path.join(__dirname, 'knowledge_base.json');
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

// --- Create the Fuzzy Search Index ---
const fuseOptions = {
  keys: ['term'],
  includeScore: true,
  threshold: 0.4, 
};
const fuse = new Fuse(knowledgeBase, fuseOptions);

const stopWords = new Set(['what', 'is', 'a', 'the', 'of', 'in', 'can', 'you', 'tell', 'me', 'about', 'explain']);

function searchKnowledgeBase(userQuery) {
    console.log(`Original query: "${userQuery}"`);
    const words = userQuery.toLowerCase().replace(/[?.,]/g, '').split(' ');
    const keywords = words.filter(word => !stopWords.has(word));
    const searchTerm = keywords.join(' ');
    
    console.log(`Performing fuzzy search for keywords: "${searchTerm}"...`);
    const results = fuse.search(searchTerm);

    console.log(`Found ${results.length} potential matches.`);
    
    if (results.length > 0 && results[0].score < 0.5) {
        return [results[0].item];
    }

    return [];
}

app.post('/api/chat', async (req, res) => {
    const { messageHistory } = req.body;
    const userQuery = messageHistory[messageHistory.length - 1].text;

    const searchResults = searchKnowledgeBase(userQuery);
    
    let contextForLLM = "No relevant information was found in my knowledge base.";
    if (searchResults.length > 0) {
        contextForLLM = "Relevant information from the knowledge base:\n" + 
            searchResults.map(r => `- ${r.term}: ${r.definition}`).join("\n");
    }

    // --- 👇 THIS IS THE UPGRADE ---
    const systemPrompt = {
        role: 'system',
        content: `You are SAP Assistant, a helpful and conversational AI expert. Your tone should be natural and direct, like a knowledgeable colleague.

        - Your main goal is to answer the user's question accurately using the provided "Context from knowledge base" as your single source of truth.
        - Formulate a natural, human-like response based on the information in the context. Explain it clearly in your own words.
        - **CRITICAL RULE:** Do NOT mention your sources. Do NOT start your response with phrases like "According to the knowledge base..." or "Based on the information provided...". Just give the answer directly.
        - **CRITICAL RULE:** Do NOT announce who you are. Do NOT start with "SAP Assistant's Response...".
        - If the context says 'No relevant information was found', you must politely inform the user that you don't have information on that topic.
        - Always use Markdown for formatting (e.g., '**' for bold, '- ' for lists).`
    };
    // --- END OF UPGRADE ---
    
    const fullPrompt = `Context:\n---\n${contextForLLM}\n---\n\nUser Question: ${userQuery}`;
    
    const ollamaMessages = [{ role: 'user', content: fullPrompt }];

    try {
        const ollamaResponse = await axios.post(OLLAMA_API_URL, {
            model: 'llama3',
            messages: [systemPrompt, ...ollamaMessages],
            stream: false,
        });

        res.json(ollamaResponse.data.message);

    } catch (error) {
        console.error("Error communicating with Ollama:", error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Fuzzy Search RAG Backend is running on http://localhost:${PORT}`);
});
