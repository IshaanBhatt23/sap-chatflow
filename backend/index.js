import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

app.post('/api/chat', async (req, res) => {
    const { messageHistory } = req.body;

    const systemPrompt = {
        role: 'system',
        content: `You are SAP Assistant, a world-class AI expert in SAP systems.
        - Your goal is to understand the user's actual problem and provide accurate, helpful guidance.
        - You must be conversational, professional, and slightly proactive.
        - CRITICAL RULE: If a user's request is ambiguous or lacks necessary detail, you MUST ask for the missing information before proceeding.
        - For general SAP questions, provide a clear and concise explanation.
        - You MUST format your responses using Markdown (e.g., use ** for bold, numbered lists for steps, etc.).
        - Do not answer questions that are not related to SAP.`
    };
    
    const ollamaMessages = messageHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
    }));

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
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
    console.log('   Ready to connect to Ollama and your React app!');
});
