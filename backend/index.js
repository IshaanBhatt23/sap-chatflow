import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// --- Load the entire knowledge base into a single string ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgeBasePath = path.join(__dirname, 'knowledge_base.json');
const knowledgeBase = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));

// Convert the entire JSON knowledge base into a text format for the AI
const knowledgeBaseAsText = knowledgeBase.map(item => `- ${item.term}: ${item.definition}`).join('\n');
// ---

app.post('/api/chat', async (req, res) => {
    const { messageHistory } = req.body;
    const userQuery = messageHistory[messageHistory.length - 1].text;

    try {
        // --- NEW, SIMPLIFIED LOGIC ---

        // --- STEP 1: CREATE THE SYSTEM PROMPT ---
        // This prompt now instructs the AI to act as a search engine and synthesizer over its entire knowledge.
        const systemPrompt = {
            role: 'system',
            content: `You are SAP Assistant, an expert AI with deep knowledge. Your entire knowledge base is provided below under "CONTEXT".
            - Your goal is to synthesize information from your knowledge base to comprehensively answer the user's question.
            - You must be able to connect different topics to answer complex questions about processes or relationships (e.g., explaining the steps of "procure-to-pay" by combining information about Purchase Orders, Goods Receipts, and Invoices).
            - **CRITICAL RULE:** Do NOT mention your sources or "the knowledge base." Just answer the question directly and naturally, as if you know it from memory.
            - If you truly cannot find any relevant information within the provided context to answer the question, politely state that you don't have specific details on that topic.
            - **CRITICAL FORMATTING RULE:** You MUST use Markdown for all formatting. For lists, you MUST use a hyphen followed by a space (e.g., '- First item') for each bullet point.`
        };
        
        // --- STEP 2: CREATE THE FULL PROMPT ---
        // We combine the user's question with the entire knowledge base.
        const fullPrompt = `CONTEXT:\n---\n${knowledgeBaseAsText}\n---\n\nUser Question: ${userQuery}`;
        
        // --- STEP 3: SEND TO THE AI ---
        const finalResponse = await axios.post(OLLAMA_API_URL, {
            model: 'llama3',
            // Note: We are not sending the whole chat history, just the current, self-contained question.
            messages: [systemPrompt, { role: 'user', content: fullPrompt }],
            stream: false,
        });

        res.json(finalResponse.data.message);

    } catch (error) {
        console.error("Error in whole-context RAG process:", error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Whole-Context RAG Backend is running on http://localhost:${PORT}`);
});
