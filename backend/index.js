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

// --- 👇 THIS IS THE UPGRADE (Part 1) ---
// We define the path to our new JSON database file.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const leaveDbPath = path.join(__dirname, 'tools', 'leave_applications.json');
// --- END OF UPGRADE ---

const tools = [
    {
        name: 'show_leave_application_form',
        description: 'Use this tool when the user wants to apply for leave, request time off, or ask for a leave application form.',
        parameters: {}
    }
];

const getToolsPrompt = () => {
    return `You are a helpful SAP Assistant. You have access to the following tools.

    Available Tools:
    ${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

    Based on the user's request, you MUST decide whether to have a normal conversation or to use a tool.
    Your response MUST be a single, valid JSON object with ONE of the following formats:
    1. For a normal text response: { "type": "text", "content": "Your conversational response here." }
    2. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool_to_use" }`;
};

app.post('/api/chat', async (req, res) => {
    const { messageHistory } = req.body;
    const userQuery = messageHistory[messageHistory.length - 1].text;

    try {
        const decisionMakingPrompt = `User's request: "${userQuery}"\n\nBased on this request and the available tools, what is the correct JSON response?`;

        const decisionResponse = await axios.post(OLLAMA_API_URL, {
            model: 'llama3',
            format: 'json',
            messages: [
                { role: 'system', content: getToolsPrompt() },
                { role: 'user', content: decisionMakingPrompt }
            ],
            stream: false,
        });

        const decision = JSON.parse(decisionResponse.data.message.content);

        if (decision.type === 'tool_call' && decision.tool_name === 'show_leave_application_form') {
            console.log('AI decided to show the leave application form.');
            res.json({ type: 'leave_application_form' });
        } else {
            console.log('AI decided to have a normal conversation.');
            res.json({ type: 'text', content: decision.content });
        }

    } catch (error) {
        console.error("Error in AI decision-making process:", error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});


// --- 👇 THIS IS THE UPGRADE (Part 2) ---
// This endpoint now reads from and writes to the JSON file.
app.post('/api/submit-leave', (req, res) => {
    const newLeaveData = req.body;
    console.log('Received new leave application:', newLeaveData);

    try {
        // 1. Read the existing applications from the file.
        const fileData = fs.readFileSync(leaveDbPath, 'utf-8');
        const leaveApplications = JSON.parse(fileData);

        // 2. Add the new application to the list.
        leaveApplications.push({ id: Date.now(), ...newLeaveData, status: 'Submitted' });

        // 3. Write the entire updated list back to the file.
        fs.writeFileSync(leaveDbPath, JSON.stringify(leaveApplications, null, 2));

        console.log('Successfully saved to leave_applications.json');

        // 4. Send a success confirmation back to the frontend.
        res.json({
            type: 'text',
            content: 'Thanks! Your leave application has been successfully submitted and saved.'
        });

    } catch (error) {
        console.error('Error saving leave application:', error);
        res.status(500).json({ error: 'Failed to save the leave application.' });
    }
});
// --- END OF UPGRADE ---


const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Tool-Enabled Backend is running on http://localhost:${PORT}`);
});