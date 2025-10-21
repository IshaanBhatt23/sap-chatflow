import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js'; // 👈 We're bringing back our fuzzy search tool

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_API_URL = 'http://localhost:11434/api/chat';

// --- Paths to our JSON database files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const leaveDbPath = path.join(__dirname, 'tools', 'leave_applications.json');
const stockDbPath = path.join(__dirname, 'tools', 'stock_level.json');


// --- 👇 STEP 1: CREATE THE FUZZY SEARCH INDEX ---
// Load the stock data once when the server starts
const stockData = JSON.parse(fs.readFileSync(stockDbPath, 'utf-8'));
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));

// We tell Fuse to create an index of our stock list, searching the Material and Description fields.
const fuseOptions = {
  keys: ['Material', 'Description'],
  includeScore: true,
  threshold: 0.4, // How "fuzzy" the search should be (0=exact, 1=very loose)
};
const fuse = new Fuse(stockList, fuseOptions);
// --- END OF INDEX CREATION ---


const tools = [
    {
        name: 'show_leave_application_form',
        description: 'Use this tool when the user wants to apply for leave or request time off.',
        parameters: {}
    },
    {
        name: 'query_inventory',
        description: 'Use this tool to get stock levels. It can show all items, a specific item, or items filtered by quantity.',
        parameters: { 
            "material_id": "(Optional) The specific ID or name of the material, e.g., 'PUMP-1001' or 'pump'",
            "comparison": "(Optional) The filter operator, such as 'less than' or 'greater than'",
            "quantity": "(Optional) The numeric value to compare the stock level against, e.g., 1000"
        }
    }
];

const getToolsPrompt = () => {
    return `You are a helpful SAP Assistant. You have access to the following tools.

    Available Tools:
    ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

    Based on the user's request, you MUST decide whether to have a normal conversation or to use a tool.
    If you use a tool, you MUST extract any relevant parameters from the user's request.
    Your response MUST be a single, valid JSON object with ONE of the following formats:
    1. For a normal text response: { "type": "text", "content": "Your conversational response here." }
    2. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { "parameter_name": "extracted_value" } }`;
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

        if (decision.type === 'tool_call') {
            console.log(`AI decided to use tool: ${decision.tool_name} with params:`, decision.parameters);
            let toolResult;

            switch (decision.tool_name) {
                case 'show_leave_application_form':
                    toolResult = { type: 'leave_application_form' };
                    break;
                
                // --- 👇 STEP 2: UPGRADE THE QUERY LOGIC ---
                case 'query_inventory':
                    let inventory = stockList; // Start with the full list of all items.

                    // 1. First, apply a fuzzy search filter if a material is mentioned.
                    if (decision.parameters.material_id) {
                        const searchTerm = decision.parameters.material_id;
                        console.log(`Performing fuzzy search for: "${searchTerm}"`);
                        const searchResults = fuse.search(searchTerm);
                        inventory = searchResults.map(result => result.item); // The list is now filtered by the search.
                    }
                    
                    // 2. Then, apply a quantity filter to the (potentially already filtered) list.
                    if (decision.parameters.comparison && decision.parameters.quantity) {
                        const qty = parseInt(decision.parameters.quantity, 10);
                        const comparison = decision.parameters.comparison.toLowerCase();
                        
                        inventory = inventory.filter(item => {
                            // Extract just the number from "152 units"
                            const itemStock = parseInt(item['Stock Level'], 10); 
                            if (comparison.includes('less') || comparison.includes('<')) return itemStock < qty;
                            if (comparison.includes('more') || comparison.includes('greater') || comparison.includes('>')) return itemStock > qty;
                            return false;
                        });
                    }
                    
                    toolResult = {
                        type: 'table',
                        tableColumns: ['Material', 'Description', 'Stock Level', 'Plant'],
                        tableData: inventory,
                    };
                    break;
                // --- END OF UPGRADE ---

                default:
                    toolResult = { type: 'text', content: "Sorry, I can't do that yet." };
            }
            res.json(toolResult);

        } else {
            console.log('AI decided to have a normal conversation.');
            res.json({ type: 'text', content: decision.content });
        }

    } catch (error) {
        console.error("Error in AI decision-making process:", error.message);
        res.status(500).json({ error: 'Failed to get a response from the AI.' });
    }
});


app.post('/api/submit-leave', (req, res) => {
    // This endpoint remains the same...
});


const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Fuzzy-Search-Enabled Backend is running on http://localhost:${PORT}`);
});
