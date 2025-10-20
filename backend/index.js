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

// --- This is our mock database for submitted leave requests ---
let leaveApplications = [];

// --- 👇 STEP 1: DEFINE THE TOOLS ---
// We create a list of "tools" the AI can use. For now, it's just one.
const tools = [
    {
        name: 'show_leave_application_form',
        description: 'Use this tool when the user wants to apply for leave, request time off, or ask for a leave application form.',
        parameters: {} // This tool needs no parameters to be called.
    }
];

// This function creates the instructions for the AI, telling it about its tools.
const getToolsPrompt = () => {
    return `You are a helpful SAP Assistant. You have access to the following tools.

    Available Tools:
    ${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

    Based on the user's request, you MUST decide whether to have a normal conversation or to use a tool.
    Your response MUST be a single, valid JSON object with ONE of the following formats:
    1. For a normal text response: { "type": "text", "content": "Your conversational response here." }
    2. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool_to_use" }`;
};

// --- This is the main chat endpoint ---
app.post('/api/chat', async (req, res) => {
    const { messageHistory } = req.body;
    const userQuery = messageHistory[messageHistory.length - 1].text;

    try {
        // --- AI DECISION-MAKING STEP ---
        const decisionMakingPrompt = `User's request: "${userQuery}"\n\nBased on this request and the available tools, what is the correct JSON response?`;

        const decisionResponse = await axios.post(OLLAMA_API_URL, {
            model: 'llama3',
            format: 'json', // We force the AI to respond in the JSON format we specified.
            messages: [
                { role: 'system', content: getToolsPrompt() },
                { role: 'user', content: decisionMakingPrompt }
            ],
            stream: false,
        });

        const decision = JSON.parse(decisionResponse.data.message.content);

        // --- EXECUTE THE AI'S DECISION ---
        if (decision.type === 'tool_call' && decision.tool_name === 'show_leave_application_form') {
            console.log('AI decided to show the leave application form.');
            // We send a special message type to the frontend.
            res.json({ type: 'leave_application_form' });
        } else {
            console.log('AI decided to have a normal conversation.');
            // If it's not a tool call, just send the text content.
            res.json({ type: 'text', content: decision.content });
        }

    } catch (error) {
        console.error("Error in AI decision-making process:", error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});

// --- 👇 STEP 2: CREATE A NEW ENDPOINT FOR SUBMITTING THE FORM ---
// This new endpoint will receive the data from the form when the user clicks "Submit".
app.post('/api/submit-leave', (req, res) => {
    const leaveData = req.body;
    console.log('Received new leave application:', leaveData);

    // Save the application to our mock database
    leaveApplications.push({ id: Date.now(), ...leaveData, status: 'Submitted' });

    console.log('Current leave applications:', leaveApplications);

    // Send a success confirmation back to the frontend
    res.json({
        type: 'text',
        content: 'Thanks! Your leave application has been submitted for approval.'
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Tool-Enabled Backend is running on http://localhost:${PORT}`);
});
