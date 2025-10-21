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

// --- Paths to our JSON database files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const leaveDbPath = path.join(__dirname, 'tools', 'leave_applications.json');
const stockDbPath = path.join(__dirname, 'tools', 'stock_level.json');
const salesOrdersDbPath = path.join(__dirname, 'tools', 'sales_orders.json');

// --- Load the stock data for fuzzy search index ---
const stockData = JSON.parse(fs.readFileSync(stockDbPath, 'utf-8'));
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));

const stockFuseOptions = {
  keys: ['Material', 'Description'],
  includeScore: true,
  threshold: 0.4,
};
const stockFuse = new Fuse(stockList, stockFuseOptions);

// --- NEW: Load Sales Order data for fuzzy search index ---
const salesOrderData = JSON.parse(fs.readFileSync(salesOrdersDbPath, 'utf-8'));
const salesOrderFuseOptions = {
  keys: ['customer'], // We will fuzzy search on the 'customer' field
  includeScore: true,
  threshold: 0.4,
};
const salesOrderFuse = new Fuse(salesOrderData, salesOrderFuseOptions);
// --- END OF NEW LOAD ---

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
  },
  {
    name: 'get_sales_orders',
    description: 'Use this tool to get a list of sales orders. Can be filtered by customer name or status (e.g., "open", "in process").',
    parameters: {
      "customer": "(Optional) The name of the customer to filter by (supports fuzzy matching).",
      "status": "(Optional) The status of the orders to filter by (e.g., 'Open')."
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
        
        case 'query_inventory':
          let inventory = stockList;
          if (decision.parameters.material_id) {
            const searchTerm = decision.parameters.material_id;
            const searchResults = stockFuse.search(searchTerm);
            inventory = searchResults.map(result => result.item);
          }
          if (decision.parameters.comparison && decision.parameters.quantity) {
            const qty = parseInt(decision.parameters.quantity, 10);
            const comparison = decision.parameters.comparison.toLowerCase();
            inventory = inventory.filter(item => {
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

        // --- MODIFIED: get_sales_orders case ---
        case 'get_sales_orders':
          let salesOrdersResults = salesOrderData; // Start with the full list

          // Step 1: Apply fuzzy search for customer if provided
          if (decision.parameters.customer) {
            const searchTerm = decision.parameters.customer;
            const searchResults = salesOrderFuse.search(searchTerm);
            salesOrdersResults = searchResults.map(result => result.item); // Get the original objects back
          }

          // Step 2: Apply exact filter for status if provided
          if (decision.parameters.status) {
            const status = decision.parameters.status.toLowerCase();
            salesOrdersResults = salesOrdersResults.filter(order => order.status.toLowerCase() === status);
          }

          // Step 3: Map lowercase keys (from json) to uppercase keys (for frontend)
          const mappedData = salesOrdersResults.map(order => ({
            'ID': order.id,
            'Customer': order.customer,
            'Material': order.material,
            'Quantity': order.quantity,
            'Status': order.status,
            'Value': order.value
          }));

          toolResult = {
            type: 'table',
            tableColumns: ['ID', 'Customer', 'Material', 'Quantity', 'Status', 'Value'],
            tableData: mappedData, // Use the new mapped data
          };
          break;
        // --- END OF MODIFIED LOGIC ---

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
  const newLeaveData = req.body;
  try {
    const fileData = fs.readFileSync(leaveDbPath, 'utf-8');
    const leaveApplications = JSON.parse(fileData);
    leaveApplications.push({ id: Date.now(), ...newLeaveData, status: 'Submitted' });
    fs.writeFileSync(leaveDbPath, JSON.stringify(leaveApplications, null, 2));

    res.json({
      type: 'text',
      content: 'Thanks! Your leave application has been successfully submitted and saved.'
    });
  } catch (error) {
    console.error('Error saving leave application:', error);
    res.status(500).json({ error: 'Failed to save the leave application.' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Fuzzy-Search-Enabled Backend is running on http://localhost:${PORT}`);
});