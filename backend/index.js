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

// --- Groq API Details ---
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// This API key will be set as an Environment Variable in Render
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- Paths to our JSON database files ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolsDir = path.join(__dirname, 'tools');
const leaveDbPath = path.join(toolsDir, 'leave_applications.json');
const stockDbPath = path.join(toolsDir, 'stock_level.json');
const salesOrdersDbPath = path.join(toolsDir, 'sales_orders.json');
const purchaseOrdersDbPath = path.join(toolsDir, 'purchase_orders.json');
const knowledgeDbPath = path.join(__dirname, 'knowledge_base.json');

// --- Function to read JSON files safely ---
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

// --- Load data using the safe function ---
const stockData = readJsonSafely(stockDbPath, {}); // Default to empty object if file fails
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));
const stockFuse = new Fuse(stockList, { keys: ['Material', 'Description'], includeScore: true, threshold: 0.4 });

const salesOrderData = readJsonSafely(salesOrdersDbPath, []); // Default to empty array
const salesOrderFuse = new Fuse(salesOrderData, { keys: ['customer'], includeScore: true, threshold: 0.4 });

const purchaseOrderData = readJsonSafely(purchaseOrdersDbPath, []); // Default to empty array
const purchaseOrderFuse = new Fuse(purchaseOrderData, { keys: ['vendor'], includeScore: true, threshold: 0.4 });

const knowledgeData = readJsonSafely(knowledgeDbPath, []); // Default to empty array
// --- MODIFIED: Relaxed threshold slightly ---
const knowledgeFuse = new Fuse(knowledgeData, { keys: ['term', 'definition'], includeScore: true, threshold: 0.4 });
// --- END OF LOADS ---

// --- Tools array remains unchanged ---
const tools = [
  { name: 'get_sap_definition', description: "Use this tool ONLY to find the definition or explanation of a specific SAP term, concept, T-code, or abbreviation (e.g., 'What is Fiori?', 'Define S/4HANA', 'what is fb60'). Do NOT use for general SAP questions.", parameters: { "term": "The specific SAP term, concept, T-code, or abbreviation the user is asking about." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user wants to apply for leave or request time off.', parameters: {} },
  { name: 'query_inventory', description: "Use this tool to get stock levels or check if specific materials are in stock. Can show all items, a specific item (e.g., 'pump'), or items filtered by quantity.", parameters: { "material_id": "(Optional) The specific ID or name of the material, e.g., 'PUMP-1001' or 'pump'", "comparison": "(Optional) The filter operator, such as 'less than' or 'greater than'", "quantity": "(Optional) The numeric value to compare the stock level against, e.g., 1000" } },
  { name: 'get_sales_orders', description: 'Use this tool to get a list of sales orders. Can be filtered by customer name or status (e.g., "open", "in process").', parameters: { "customer": "(Optional) The name of the customer to filter by (supports fuzzy matching).", "status": "(Optional) The status of the orders to filter by (e.g., 'Open')." } },
  { name: 'get_purchase_orders', description: 'Use this tool to get a list of purchase orders. Can be filtered by vendor name or status (e.g., "ordered", "delivered").', parameters: { "vendor": "(Optional) The name of the vendor to filter by (supports fuzzy matching).", "status": "(Optional) The status of the orders to filter by (e.g., 'Ordered')." } }
];

// --- MODIFIED: Updated getToolsPrompt function ---
const getToolsPrompt = () => {
  return `You are a helpful SAP Assistant. Your primary goal is to assist users with specific SAP-related tasks using the tools provided or by providing definitions from the knowledge base tool.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Based on the user's request:
  1. If the request clearly matches the description of one of the tools, decide to use that tool. Extract parameters accurately.
  2. If the user provides a simple acknowledgment (e.g., 'ok', 'thanks', 'great'), compliment ('you are amazing'), or greeting ('hello'), have a brief, friendly normal conversation.
  3. For any other general SAP question or request that doesn't match a tool, have a normal conversation explaining you can help with the specific functions provided by the tools.

  Your response MUST be a single, valid JSON object with ONE of the following formats:
  A. For a normal text response: { "type": "text", "content": "Your conversational response here." }
  B. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { "parameter_name": "extracted_value" } }`;
};
// --- END MODIFIED PROMPT ---

// --- HELPER FUNCTION TO CALL GROQ ---
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
    model: 'llama-3.1-8b-instant', // Using the model from your portfolio
    messages: messages,
    // --- MODIFIED: Lowered temperature slightly ---
    temperature: 0.5,
  };

  if (isJsonMode) {
    payload.response_format = { type: "json_object" };
    console.log(`Requesting JSON response from Groq model: ${payload.model}`);
  } else {
    console.log(`Requesting text response from Groq model: ${payload.model}`);
  }

  try {
    const response = await axios.post(GROQ_API_URL, payload, {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("Unexpected response structure from Groq:", response.data);
      throw new Error("Invalid response structure received from AI.");
    }
    return content;

  } catch (error) {
    console.error("Error calling Groq API:");
    if (error.response) {
      console.error("Data:", error.response.data);
      console.error("Status:", error.response.status);
    } else if (error.request) {
      console.error("Request:", error.request);
    } else {
      console.error('Error Message:', error.message);
    }
    // Don't throw the generic error here, let the calling function handle specific fallback
    // throw new Error("Failed to get a response from the AI.");
     return null; // Indicate failure to the caller
  }
}
// --- END HELPER FUNCTION ---


// --- Main Chat Endpoint ---
app.post('/api/chat', async (req, res) => {
  const { messageHistory } = req.body;
  if (!Array.isArray(messageHistory) || messageHistory.length === 0) {
    return res.status(400).json({ error: 'Invalid messageHistory provided.' });
  }
  const userQuery = messageHistory[messageHistory.length - 1].text;

  try {
    // --- STEP 1: Call Groq for the decision ---
    const decisionMakingPrompt = `User's input: "${userQuery}"\n\nBased on this input and the rules provided in the system prompt, what is the correct JSON response?`;
    const decisionString = await callGroqLLM(getToolsPrompt(), decisionMakingPrompt, true); // JSON mode

     if (!decisionString) { // Handle potential null response from callGroqLLM
      throw new Error("AI service failed to provide a decision.");
    }

    let decision;
    try {
      decision = JSON.parse(decisionString);
      console.log("Parsed AI decision:", decision);
    } catch (parseError) {
      console.error("Failed to parse JSON decision from Groq:", decisionString, parseError);
      // Attempt a fallback text response if parsing fails but content might be text
      if (typeof decisionString === 'string' && !decisionString.trim().startsWith('{')) {
         console.log("Decision wasn't JSON, attempting to use as text fallback.");
         return res.json({ type: 'text', content: decisionString });
      }
      throw new Error("Failed to parse AI decision.");
    }

    // --- STEP 2: Execute the decision ---
    if (decision.type === 'tool_call' && decision.tool_name) { // Add check for tool_name
      console.log(`AI decided to use tool: ${decision.tool_name} with params:`, decision.parameters);
      let toolResult;
      const parameters = decision.parameters || {}; // Ensure parameters object exists

      switch (decision.tool_name) {
        case 'get_sap_definition': {
          const searchTerm = parameters.term; // Use parameters safely
          if (!searchTerm) {
             console.warn("Tool 'get_sap_definition' called without a 'term' parameter.");
             toolResult = { type: 'text', content: "Please specify the SAP term you want me to define." };
             break;
          }
          console.log(`Searching knowledge base for: "${searchTerm}"`);
          const kbSearchResults = knowledgeFuse.search(searchTerm);
          // --- MODIFIED: Use the relaxed threshold here too ---
          const goodKbMatch = kbSearchResults.length > 0 && kbSearchResults[0].score < 0.45; // Further relaxed score slightly

          if (goodKbMatch) {
            console.log('Found match in Knowledge Base:', kbSearchResults[0].item.term, "Score:", kbSearchResults[0].score);
            const definition = kbSearchResults[0].item.definition;
            const rephrasePrompt = `A user asked about "${searchTerm}". Rephrase the following definition naturally: "${definition}". Just provide the final text response.`;
            const rephrasedContent = await callGroqLLM('You are a helpful SAP assistant.', rephrasePrompt);
             toolResult = { type: 'text', content: rephrasedContent || "I found information but couldn't rephrase it." };
          } else {
            console.log(`No KB match found for "${searchTerm}" (Top score: ${kbSearchResults[0]?.score}). Asking Groq fallback.`);
            // --- MODIFIED: More cautious fallback prompt ---
            const fallbackPrompt = `The user asked for a definition of the SAP term "${searchTerm}". It wasn't found in our specific knowledge base. Provide a concise definition ONLY if you are confident you know what it means in an SAP context. If unsure, respond with: "I couldn't find a specific definition for '${searchTerm}' in my knowledge base. Could you provide more context or check the spelling?"`;
            const fallbackContent = await callGroqLLM('You are a helpful SAP assistant.', fallbackPrompt);
            toolResult = { type: 'text', content: fallbackContent || `Sorry, I couldn't find information about '${searchTerm}'.` };
          }
          break;
        }

        // --- Other tool cases remain mostly unchanged, added safe parameter access ---
        case 'show_leave_application_form':
          toolResult = { type: 'leave_application_form' };
          break;

        case 'query_inventory': {
          let inventory = stockList;
          if (parameters.material_id) {
            const searchTerm = parameters.material_id;
            const searchResults = stockFuse.search(searchTerm);
            inventory = searchResults.map(result => result.item);
          }
          if (parameters.comparison && parameters.quantity) {
            const qty = parseInt(parameters.quantity, 10);
            const comparison = parameters.comparison.toLowerCase();
            if (!isNaN(qty)) {
                inventory = inventory.filter(item => {
                const itemStock = parseInt(item['Stock Level'], 10);
                if (isNaN(itemStock)) return false;
                if (comparison.includes('less') || comparison.includes('<')) return itemStock < qty;
                if (comparison.includes('more') || comparison.includes('greater') || comparison.includes('>')) return itemStock > qty;
                return false;
                });
            }
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
          if (parameters.customer) {
            const searchTerm = parameters.customer;
            const searchResults = salesOrderFuse.search(searchTerm);
            salesOrdersResults = searchResults.map(result => result.item);
          }
          if (parameters.status) {
            const statusSearchTerm = parameters.status;
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
          if (parameters.vendor) {
            const searchTerm = parameters.vendor;
            const searchResults = purchaseOrderFuse.search(searchTerm);
            purchaseOrdersResults = searchResults.map(result => result.item);
          }
          if (parameters.status) {
            const statusSearchTerm = parameters.status;
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
          // Fallback to text if tool name is unknown
           const fallbackTextPrompt = `The user said: "${userQuery}". I decided to use a tool called '${decision.tool_name}' which isn't recognized. Please provide a helpful text response asking the user to clarify or rephrase their request.`;
           const fallbackTextContent = await callGroqLLM('You are a helpful SAP assistant.', fallbackTextPrompt);
           toolResult = { type: 'text', content: fallbackTextContent || "Sorry, I couldn't understand that request. Could you please rephrase?" };
      }
      res.json(toolResult);

    } else if (decision.type === 'text') {
      console.log('AI decided to have a normal conversation.');
      const contentToSend = decision.content || "Sorry, I couldn't generate a response.";
      res.json({ type: 'text', content: contentToSend });
    } else {
       console.error("Unexpected decision format received:", decision);
       res.status(500).json({ error: 'Received an unexpected response format from the AI.' });
    }

  } catch (error) {
    console.error("Error in /api/chat endpoint:", error.message, error.stack);
    res.status(500).json({ error: 'An internal server error occurred processing your request.' });
  }
});


// --- submit-leave endpoint remains unchanged ---
app.post('/api/submit-leave', (req, res) => {
  const newLeaveData = req.body;
   if (!newLeaveData || typeof newLeaveData !== 'object' || Object.keys(newLeaveData).length === 0) {
    return res.status(400).json({ error: 'Invalid leave data provided.' });
  }
  try {
    let leaveApplications = readJsonSafely(leaveDbPath, []);
    if (!Array.isArray(leaveApplications)) {
        console.error("Leave applications data is not an array. Resetting.");
        leaveApplications = [];
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

// --- Server Start for Render ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAP Assistant Backend is running on port ${PORT}`);
});