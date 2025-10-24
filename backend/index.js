import express from 'express';
import cors from 'cors';
import axios from 'axios'; // We will use this for Groq
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Fuse from 'fuse.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- 🔽 STEP 1: DEFINE GROQ API DETAILS (Replaces OLLAMA_API_URL) 🔽 ---
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// This API key will be set as an Environment Variable in Render
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// --- 🔼 END OF STEP 1 🔼 ---

// --- Paths to our JSON database files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- 🔽 STEP 4: Make paths more robust for deployment 🔽 ---
const toolsDir = path.join(__dirname, 'tools');
const leaveDbPath = path.join(toolsDir, 'leave_applications.json');
const stockDbPath = path.join(toolsDir, 'stock_level.json');
const salesOrdersDbPath = path.join(toolsDir, 'sales_orders.json');
const purchaseOrdersDbPath = path.join(toolsDir, 'purchase_orders.json');
const knowledgeDbPath = path.join(__dirname, 'knowledge_base.json');
// --- 🔼 END OF STEP 4 🔼 ---

// --- 🔽 STEP 4: Function to read JSON files safely 🔽 ---
function readJsonSafely(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`Warning: Data file not found at ${filePath}. Using default value.`);
      return defaultValue;
    }
    const fileData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error(`Error reading or parsing JSON file at ${filePath}:`, error);
    return defaultValue; // Return default value on error
  }
}
// --- 🔼 END OF STEP 4 🔼 ---

// --- Load data using the safe function ---
const stockData = readJsonSafely(stockDbPath, {}); // Default to empty object if file fails
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));
const stockFuse = new Fuse(stockList, { keys: ['Material', 'Description'], includeScore: true, threshold: 0.4 });

const salesOrderData = readJsonSafely(salesOrdersDbPath, []); // Default to empty array
const salesOrderFuse = new Fuse(salesOrderData, { keys: ['customer'], includeScore: true, threshold: 0.4 });

const purchaseOrderData = readJsonSafely(purchaseOrdersDbPath, []); // Default to empty array
const purchaseOrderFuse = new Fuse(purchaseOrderData, { keys: ['vendor'], includeScore: true, threshold: 0.4 });

const knowledgeData = readJsonSafely(knowledgeDbPath, []); // Default to empty array
const knowledgeFuse = new Fuse(knowledgeData, { keys: ['term', 'definition'], includeScore: true, threshold: 0.3 });
// --- END OF LOADS ---

// --- Tools array remains unchanged ---
const tools = [
  { name: 'get_sap_definition', description: "Use this tool to find the definition or explanation of an SAP-specific term, concept, T-code, or abbreviation (e.g., 'What is Fiori?', 'Define S/4HANA', 'what is fb60').", parameters: { "term": "The term, concept, or abbreviation the user is asking about." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user wants to apply for leave or request time off.', parameters: {} },
  { name: 'query_inventory', description: "Use this tool to get stock levels or check for specific materials. It can show all items, a specific item (e.g., 'pump'), or items filtered by quantity.", parameters: { "material_id": "(Optional) The specific ID or name of the material, e.g., 'PUMP-1001' or 'pump'", "comparison": "(Optional) The filter operator, such as 'less than' or 'greater than'", "quantity": "(Optional) The numeric value to compare the stock level against, e.g., 1000" } },
  { name: 'get_sales_orders', description: 'Use this tool to get a list of sales orders. Can be filtered by customer name or status (e.g., "open", "in process").', parameters: { "customer": "(Optional) The name of the customer to filter by (supports fuzzy matching).", "status": "(Optional) The status of the orders to filter by (e.g., 'Open')." } },
  { name: 'get_purchase_orders', description: 'Use this tool to get a list of purchase orders. Can be filtered by vendor name or status (e.g., "ordered", "delivered").', parameters: { "vendor": "(Optional) The name of the vendor to filter by (supports fuzzy matching).", "status": "(Optional) The status of the orders to filter by (e.g., 'Ordered')." } }
];

// --- getToolsPrompt function remains unchanged ---
const getToolsPrompt = () => {
  return `You are a helpful SAP Assistant. You have access to the following tools.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Based on the user's request, you MUST decide whether to have a normal conversation or to use a tool.
  Your response MUST be a single, valid JSON object with ONE of the following formats:
  1. For a normal text response: { "type": "text", "content": "Your conversational response here." }
  2. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { "parameter_name": "extracted_value" } }`;
};

// --- 🔽 STEP 1: HELPER FUNCTION TO CALL GROQ 🔽 ---
async function callGroqLLM(systemPrompt, userPrompt, isJsonMode = false) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set. Please set it as an environment variable.");
    throw new Error("Groq API key is missing.");
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const payload = {
    // --- 🔽 THIS IS THE ONLY CHANGE 🔽 ---
    model: 'llama3-70b-8192', // Use the larger, supported Llama 3 model
    // --- 🔼 ---
    messages: messages,
    temperature: 0.7,
  };

  // Enable JSON mode if requested
  if (isJsonMode) {
    payload.response_format = { type: "json_object" };
    console.log("Requesting JSON response from Groq");
  } else {
    console.log("Requesting text response from Groq");
  }

  try {
    const response = await axios.post(GROQ_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Extract the content from Groq's response structure
    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Unexpected response structure from Groq:", response.data);
      throw new Error("Invalid response structure received from AI.");
    }
    // console.log("Raw Groq response content:", content); // Debugging
    return content;

  } catch (error) {
    console.error("Error calling Groq API:");
    if (error.response) {
      console.error("Data:", error.response.data);
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
    } else if (error.request) {
      console.error("Request:", error.request);
    } else {
      console.error('Error Message:', error.message);
    }
    throw new Error("Failed to get a response from the AI.");
  }
}
// --- 🔼 END OF STEP 1 🔼 ---


// --- Endpoint logic remains the same, but calls callGroqLLM ---
app.post('/api/chat', async (req, res) => {
  const { messageHistory } = req.body;
  // Ensure messageHistory is an array and not empty
    if (!Array.isArray(messageHistory) || messageHistory.length === 0) {
      return res.status(400).json({ error: 'Invalid messageHistory provided.' });
    }
  const userQuery = messageHistory[messageHistory.length - 1].text;

  try {
    // --- STEP 1 (Inside endpoint): Call Groq for the decision ---
    const decisionMakingPrompt = `User's request: "${userQuery}"\n\nBased on this request and the available tools, what is the correct JSON response?`;
    const decisionString = await callGroqLLM(getToolsPrompt(), decisionMakingPrompt, true); // true for JSON mode

    let decision;
    try {
        decision = JSON.parse(decisionString);
        console.log("Parsed AI decision:", decision); // Debugging
    } catch (parseError) {
        console.error("Failed to parse JSON decision from Groq:", decisionString, parseError);
        throw new Error("Failed to parse AI decision.");
    }

    // --- STEP 2: Execute the decision (Logic is identical) ---
    if (decision.type === 'tool_call') {
      console.log(`AI decided to use tool: ${decision.tool_name} with params:`, decision.parameters);
      let toolResult;

      switch (decision.tool_name) {
        case 'get_sap_definition': {
          const searchTerm = decision.parameters.term;
          const kbSearchResults = knowledgeFuse.search(searchTerm);
          const goodKbMatch = kbSearchResults.length > 0 && kbSearchResults[0].score < 0.4;

          if (goodKbMatch) {
            console.log('Found match in Knowledge Base:', kbSearchResults[0].item.term);
            const definition = kbSearchResults[0].item.definition;

            // --- Call Groq to rephrase ---
            const rephrasePrompt = `A user asked: "${userQuery}". I found this relevant information: "${definition}". Present this in a natural, conversational way. Just provide the final text response.`;
            const rephrasedContent = await callGroqLLM('You are a helpful SAP assistant.', rephrasePrompt);
            toolResult = { type: 'text', content: rephrasedContent };
          } else {
            console.log(`No KB match for "${searchTerm}". Asking Groq for a general definition.`);
            // --- Call Groq for fallback ---
            const fallbackPrompt = `The user asked for a definition of "${searchTerm}", but it wasn't found in our specific knowledge base. Please provide a general, conversational definition based on your own knowledge. If you don't know, just say so.`;
            const fallbackContent = await callGroqLLM('You are a helpful SAP assistant.', fallbackPrompt);
            toolResult = { type: 'text', content: fallbackContent };
          }
          break;
        }

        // --- Other tool cases remain unchanged ---
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
              if (isNaN(itemStock)) return false; // Skip items with invalid stock level
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
            'ID': order.id, 'Customer': order.customer, 'Material': order.material,
            'Quantity': order.quantity, 'Status': order.status, 'Value': order.value
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
            'ID': order.id, 'Vendor': order.vendor, 'Material': order.material,
            'Quantity': order.quantity, 'Status': order.status, 'Value': order.value
          }));
          toolResult = {
            type: 'table',
            tableColumns: ['ID', 'Vendor', 'Material', 'Quantity', 'Status', 'Value'],
            tableData: poMappedData,
          };
          break;
        }

        default:
          console.warn(`Unhandled tool detected: ${decision.tool_name}`);
          toolResult = { type: 'text', content: "Sorry, I encountered an issue processing that request." };
      }
      res.json(toolResult);

    } else if (decision.type === 'text') {
      // Handle direct text response from AI
      console.log('AI decided to have a normal conversation.');
      res.json({ type: 'text', content: decision.content });
    } else {
       // Handle unexpected decision format
       console.error("Unexpected decision type received:", decision.type);
       res.status(500).json({ error: 'Received an unexpected response format from the AI.' });
    }

  } catch (error) {
    console.error("Error in /api/chat endpoint:", error.message);
    // Avoid sending back detailed internal errors to the client
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- submit-leave endpoint remains unchanged ---
app.post('/api/submit-leave', (req, res) => {
  const newLeaveData = req.body;
   // Basic validation
   if (!newLeaveData || typeof newLeaveData !== 'object' || Object.keys(newLeaveData).length === 0) {
    return res.status(400).json({ error: 'Invalid leave data provided.' });
  }
  try {
    // Use the safe read function
    let leaveApplications = readJsonSafely(leaveDbPath, []);

    // Check if it's an array before pushing
    if (!Array.isArray(leaveApplications)) {
        console.error("Leave applications data is not an array. Resetting.");
        leaveApplications = []; // Reset or handle appropriately
    }

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

// --- 🔽 STEP 3: MODIFY SERVER START FOR RENDER 🔽 ---
// Render provides the PORT environment variable
const PORT = process.env.PORT || 3001; // Use Render's port if available, otherwise default to 3001
app.listen(PORT, '0.0.0.0', () => { // Listen on 0.0.0.0 for Render
  console.log(`✅ SAP Assistant Backend is running on port ${PORT}`);
});