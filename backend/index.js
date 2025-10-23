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
const purchaseOrdersDbPath = path.join(__dirname, 'tools', 'purchase_orders.json');
const knowledgeDbPath = path.join(__dirname, 'knowledge_base.json');

// --- Load the stock data for fuzzy search index ---
const stockData = JSON.parse(fs.readFileSync(stockDbPath, 'utf-8'));
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));

const stockFuseOptions = {
  keys: ['Material', 'Description'],
  includeScore: true,
  threshold: 0.4,
};
const stockFuse = new Fuse(stockList, stockFuseOptions);

// --- Load Sales Order data for fuzzy search index ---
const salesOrderData = JSON.parse(fs.readFileSync(salesOrdersDbPath, 'utf-8'));
const salesOrderFuseOptions = {
  keys: ['customer'],
  includeScore: true,
  threshold: 0.4,
};
const salesOrderFuse = new Fuse(salesOrderData, salesOrderFuseOptions);

// --- Load Purchase Order data for fuzzy search index ---
const purchaseOrderData = JSON.parse(fs.readFileSync(purchaseOrdersDbPath, 'utf-8'));
const purchaseOrderFuseOptions = {
  keys: ['vendor'],
  includeScore: true,
  threshold: 0.4,
};
const purchaseOrderFuse = new Fuse(purchaseOrderData, purchaseOrderFuseOptions);

// --- Load Knowledge Base data for fuzzy search index ---
const knowledgeData = JSON.parse(fs.readFileSync(knowledgeDbPath, 'utf-8'));
const knowledgeFuseOptions = {
  keys: ['term', 'definition'],
  includeScore: true,
  threshold: 0.3, // Stricter threshold for definitions
};
const knowledgeFuse = new Fuse(knowledgeData, knowledgeFuseOptions);
// --- END OF LOADS ---

// --- MODIFIED TOOLS ARRAY ---
const tools = [
  // --- NEW TOOL FOR KNOWLEDGE BASE ---
  {
    name: 'get_sap_definition',
    description: "Use this tool to find the definition or explanation of an SAP-specific term, concept, T-code, or abbreviation (e.g., 'What is Fiori?', 'Define S/4HANA', 'what is fb60').",
    parameters: {
      "term": "The term, concept, or abbreviation the user is asking about."
    }
  },
  {
    name: 'show_leave_application_form',
    description: 'Use this tool when the user wants to apply for leave or request time off.',
    parameters: {}
  },
  {
    name: 'query_inventory',
    description: "Use this tool to get stock levels or check for specific materials. It can show all items, a specific item (e.g., 'pump'), or items filtered by quantity.",
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
  },
  {
    name: 'get_purchase_orders',
    description: 'Use this tool to get a list of purchase orders. Can be filtered by vendor name or status (e.g., "ordered", "delivered").',
    parameters: {
      "vendor": "(Optional) The name of the vendor to filter by (supports fuzzy matching).",
      "status": "(Optional) The status of the orders to filter by (e.g., 'Ordered')."
    }
  }
];

const getToolsPrompt = () => {
  return `You are a helpful SAP Assistant. You have access to the following tools.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Based on the user's request, you MUST decide whether to have a normal conversation or to use a tool.
  Your response MUST be a single, valid JSON object with ONE of the following formats:
  1. For a normal text response: { "type": "text", "content": "Your conversational response here." }
  2. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { "parameter_name": "extracted_value" } }`;
};

// --- HEAVILY MODIFIED /api/chat ENDPOINT ---
app.post('/api/chat', async (req, res) => {
  const { messageHistory } = req.body;
  const userQuery = messageHistory[messageHistory.length - 1].text;

  try {
    // --- STEP 1: Let Llama 3 decide which tool to use (or none) ---
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

    // --- STEP 2: Execute the decision ---
    if (decision.type === 'tool_call') {
      console.log(`AI decided to use tool: ${decision.tool_name} with params:`, decision.parameters);
      let toolResult;

      switch (decision.tool_name) {
        
        // --- NEW CASE FOR KNOWLEDGE BASE ---
        case 'get_sap_definition': {
          const searchTerm = decision.parameters.term;
          const kbSearchResults = knowledgeFuse.search(searchTerm);
          const goodKbMatch = kbSearchResults.length > 0 && kbSearchResults[0].score < 0.4;

          if (goodKbMatch) {
            // Found a match in our local KB
            console.log('Found match in Knowledge Base:', kbSearchResults[0].item.term);
            const definition = kbSearchResults[0].item.definition;

            const rephrasePrompt = `You are a helpful SAP assistant. A user asked: "${userQuery}".
I found this relevant information in our knowledge base: "${definition}".
Please present this information to the user in a natural, conversational, and helpful way. Just provide the final text response, do not say "Here is the information I found".`;
            
            const rephraseResponse = await axios.post(OLLAMA_API_URL, {
              model: 'llama3',
              messages: [
                { role: 'system', content: 'You are a helpful SAP assistant.' },
                { role: 'user', content: rephrasePrompt }
              ],
              stream: false,
            });
            toolResult = { type: 'text', content: rephraseResponse.data.message.content };

          } else {
            // No match in local KB, let Llama 3 answer from its general knowledge
            console.log(`No KB match for "${searchTerm}". Asking Llama 3 for a general definition.`);
            
            const fallbackPrompt = `You are a helpful SAP assistant. The user asked for a definition of "${searchTerm}", but it wasn't found in our specific knowledge base. Please provide a general, conversational definition based on your own knowledge. If you don't know, just say so.`;

            const fallbackResponse = await axios.post(OLLAMA_API_URL, {
              model: 'llama3',
              messages: [
                { role: 'system', content: 'You are a helpful SAP assistant.' },
                { role: 'user', content: fallbackPrompt }
              ],
              stream: false,
            });
            toolResult = { type: 'text', content: fallbackResponse.data.message.content };
          }
          break;
        }
        // --- END OF NEW CASE ---

        case 'show_leave_application_form':
          toolResult = { type: 'leave_application_form' };
          break;
        
        case 'query_inventory': {
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
        }

        case 'get_sales_orders': {
          let salesOrdersResults = salesOrderData; 
          if (decision.parameters.customer) {
            const searchTerm = decision.parameters.customer;
            const searchResults = salesOrderFuse.search(searchTerm);
            salesOrdersResults = searchResults.map(result => result.item);
          }
          if (decision.parameters.status) {
            const statusSearchTerm = decision.parameters.status;
            const statusFuse = new Fuse(salesOrdersResults, { keys: ['status'], includeScore: true, threshold: 0.4 });
            const statusSearchResults = statusFuse.search(statusSearchTerm);
            salesOrdersResults = statusSearchResults.map(result => result.item);
          }
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
            tableData: mappedData,
          };
          break;
        }

        case 'get_purchase_orders': {
          let purchaseOrdersResults = purchaseOrderData;
          if (decision.parameters.vendor) {
            const searchTerm = decision.parameters.vendor;
            const searchResults = purchaseOrderFuse.search(searchTerm);
            purchaseOrdersResults = searchResults.map(result => result.item);
          }
          if (decision.parameters.status) {
            const statusSearchTerm = decision.parameters.status;
            const statusFuse = new Fuse(purchaseOrdersResults, { keys: ['status'], includeScore: true, threshold: 0.4 });
            const statusSearchResults = statusFuse.search(statusSearchTerm);
            purchaseOrdersResults = statusSearchResults.map(result => result.item);
          }
          const poMappedData = purchaseOrdersResults.map(order => ({
            'ID': order.id,
            'Vendor': order.vendor,
            'Material': order.material,
            'Quantity': order.quantity,
            'Status': order.status,
            'Value': order.value
          }));
          toolResult = {
            type: 'table',
            tableColumns: ['ID', 'Vendor', 'Material', 'Quantity', 'Status', 'Value'],
            tableData: poMappedData,
          };
          break;
        }

        default:
          toolResult = { type: 'text', content: "Sorry, I'm not sure how to handle that tool." };
      }
      res.json(toolResult);

    } else {
      // This is for decision.type === 'text'
      console.log('AI decided to have a normal conversation.');
      res.json({ type: 'text', content: decision.content });
    }

  } catch (error) {
    console.error("Error in AI decision-making process:", error.message);
    res.status(500).json({ error: 'Failed to get a response from the AI.' });
  }
});
// --- END OF MODIFIED ENDPOINT ---


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
  console.log(`✅ Intent-Based-Logic Backend is running on http://localhost:${PORT}`);
});