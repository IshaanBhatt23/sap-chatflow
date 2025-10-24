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
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// --- Paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolsDir = path.join(__dirname, 'tools');
const leaveDbPath = path.join(toolsDir, 'leave_applications.json');
const stockDbPath = path.join(toolsDir, 'stock_level.json');
const salesOrdersDbPath = path.join(toolsDir, 'sales_orders.json');
const purchaseOrdersDbPath = path.join(toolsDir, 'purchase_orders.json');
const knowledgeDbPath = path.join(__dirname, 'knowledge_base.json');

// --- Safe JSON Reading ---
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
    return defaultValue;
  }
}

// --- Load Data ---
const stockData = readJsonSafely(stockDbPath, {});
const stockList = Object.entries(stockData).map(([id, data]) => ({ Material: id, ...data }));
const stockFuse = new Fuse(stockList, { keys: ['Material', 'Description'], includeScore: true, threshold: 0.4, ignoreLocation: true });

const salesOrderData = readJsonSafely(salesOrdersDbPath, []);
const salesOrderFuse = new Fuse(salesOrderData, { keys: ['customer'], includeScore: true, threshold: 0.4 });

const purchaseOrderData = readJsonSafely(purchaseOrdersDbPath, []);
const purchaseOrderFuse = new Fuse(purchaseOrderData, { keys: ['vendor'], includeScore: true, threshold: 0.4 });

const knowledgeData = readJsonSafely(knowledgeDbPath, []);
const knowledgeFuse = new Fuse(knowledgeData, { keys: ['term', 'definition'], includeScore: true, threshold: 0.45, ignoreLocation: true });

// --- Tools array with refined descriptions ---
const tools = [
  // --- MODIFIED Description ---
  { name: 'get_sap_definition', description: "Use this tool ONLY to define a specific SAP term, concept, T-code (like 'fb60', 'MIRO', 'fb 60'), or abbreviation asked by the user (e.g., 'What is fb60?', 'Define S/4HANA'). Extract the specific term, ignoring minor typos or spaces.", parameters: { "term": "The specific SAP term, concept, T-code, or abbreviation the user is asking the definition for." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user explicitly asks to apply for leave, request time off, or wants a leave form.', parameters: {} },
  { name: 'query_inventory', description: "Use this tool when the user asks about stock levels or asks if a specific material/item is in stock (e.g., 'check stock', 'do we have bearings?'). **You MUST extract the material name/ID if provided**.", parameters: { "material_id": "(Optional, but attempt extraction) The specific ID or name of the material the user mentioned, e.g., 'PUMP-1001' or 'bearings'", "comparison": "(Optional) The filter operator, such as 'less than' or 'greater than'", "quantity": "(Optional) The numeric value to compare the stock level against, e.g., 1000" } },
  { name: 'get_sales_orders', description: 'Use this tool when the user asks to see or find sales orders. Can be filtered by customer name or status (e.g., "open", "in process"). Extract filters if provided.', parameters: { "customer": "(Optional) The name of the customer to filter by.", "status": "(Optional) The status of the orders to filter by (e.g., 'Open')." } },
  { name: 'get_purchase_orders', description: 'Use this tool when the user asks to see or find purchase orders. Can be filtered by vendor name or status (e.g., "ordered", "delivered"). Extract filters if provided.', parameters: { "vendor": "(Optional) The name of the vendor to filter by.", "status": "(Optional) The status of the orders to filter by (e.g., 'Ordered')." } }
];

// --- getToolsPrompt with clearer rules ---
const getToolsPrompt = () => {
  return `You are a helpful and friendly SAP Assistant. Your primary goal is to assist users with specific SAP-related tasks using the tools provided, explaining concepts clearly, potentially using analogies.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Follow these rules STRICTLY based on the user's latest input:
  1. Analyze the user's input. Does it clearly ask for an action described by one of the tools?
  2. If YES: Choose the corresponding tool_name. **Extract any relevant parameters** mentioned (like term, material_id, customer, vendor, status). Respond in JSON format B.
  3. If NO, and the user input is a simple acknowledgment (e.g., 'ok', 'thanks', 'great'), compliment ('you are amazing'), or greeting ('hello'): Respond with a brief, friendly text message in JSON format A (e.g., "You're welcome!", "Okay.", "Got it!").
  4. If NO, and it's NOT a simple acknowledgment/compliment/greeting (e.g., it's a general question about SAP, a vague request, or something unrelated): Respond with a polite text message in JSON format A explaining you can only perform actions related to the available tools or define specific terms using the 'get_sap_definition' tool.

  Your response MUST be a single, valid JSON object with ONE of the following formats ONLY:
  A. For text responses: { "type": "text", "content": "Your conversational response here." }
  B. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { /* extracted parameters */ } }`;
};
// --- END MODIFIED PROMPT ---

// --- HELPER FUNCTION TO CALL GROQ ---
async function callGroqLLM(systemPrompt, userPrompt, isJsonMode = false) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY environment variable not set.");
    return { error: true, message: "Groq API key is missing.", status: 500 };
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const payload = {
    model: 'llama-3.1-8b-instant',
    messages: messages,
    temperature: 0.4,
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
       return { error: true, message: "Invalid response structure from AI.", status: 500 };
    }
     console.log("Raw Groq response content:", content);
    return content;

  } catch (error) {
    console.error("Error calling Groq API:");
    let status = 500;
    let message = "Failed to get a response from the AI.";
    if (error.response) {
      console.error("Data:", error.response.data);
      console.error("Status:", error.response.status);
      status = error.response.status;
      message = error.response.data?.error?.message || message;
    } else if (error.request) {
      console.error("Request:", error.request);
       message = "No response received from AI service.";
    } else {
      console.error('Error Message:', error.message);
       message = error.message;
    }
     return { error: true, message: message, status: status };
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
  console.log(`\n--- Received query: "${userQuery}" ---`);

  try {
    // --- STEP 1: Call Groq for the decision ---
    const decisionMakingPrompt = `User's input: "${userQuery}"\n\nBased on this input and the rules provided in the system prompt, what is the correct JSON response?`;
    const decisionResult = await callGroqLLM(getToolsPrompt(), decisionMakingPrompt, true); // JSON mode

    if (decisionResult && decisionResult.error) {
      console.error("Error getting decision from LLM:", decisionResult.message);
      return res.status(decisionResult.status || 500).json({ error: decisionResult.message });
    }
    const decisionString = decisionResult;

    if (!decisionString) {
      console.error("AI service returned null or undefined decision string.");
      return res.status(500).json({ error: "AI service failed to provide a decision." });
    }

    let decision;
    try {
      decision = JSON.parse(decisionString);
      console.log("==> Parsed AI decision:", JSON.stringify(decision, null, 2));
    } catch (parseError) {
      console.error("Failed to parse JSON decision from Groq:", decisionString, parseError);
      if (typeof decisionString === 'string' && !decisionString.trim().startsWith('{')) {
         console.log("Decision wasn't JSON, using as text fallback.");
         return res.json({ type: 'text', content: decisionString });
      }
       console.error("Decision string was not valid JSON and not plain text.");
       return res.status(500).json({ error: "Failed to interpret AI decision." });
    }

    // --- STEP 2: Execute the decision ---
    if (decision.type === 'tool_call' && decision.tool_name) {
      console.log(`==> Executing tool: ${decision.tool_name}`);
      let toolResult;
      const parameters = decision.parameters || {};

      switch (decision.tool_name) {
        case 'get_sap_definition': {
          let searchTerm = parameters.term; // Get the term extracted by the LLM
          if (!searchTerm) {
             console.warn("Tool 'get_sap_definition' called without 'term'.");
             toolResult = { type: 'text', content: "Please tell me which SAP term you want defined." };
             break;
          }

          // --- 🔽 NEW: Normalize the search term 🔽 ---
          const normalizedSearchTerm = searchTerm.replace(/\s+/g, '').toUpperCase();
          console.log(`--> Original search term: "${searchTerm}", Normalized: "${normalizedSearchTerm}"`);
          // --- 🔼 END NEW 🔼 ---

          // --- Search using the NORMALIZED term ---
          const kbSearchResults = knowledgeFuse.search(normalizedSearchTerm);
          const topScore = kbSearchResults[0]?.score;
          console.log(`--> KB Search Results for "${normalizedSearchTerm}" (Top Score: ${topScore}):`, kbSearchResults.slice(0, 3));
          const goodKbMatch = kbSearchResults.length > 0 && topScore < 0.45;

          if (goodKbMatch) {
            console.log('--> Found KB match:', kbSearchResults[0].item.term, `(Score: ${topScore})`);
            const definition = kbSearchResults[0].item.definition;
            const rephrasePrompt = `A user asked about "${searchTerm}". Explain the following definition in a friendly, human-like way. If possible, include a simple analogy to make it easier to understand: "${definition}". Just provide the final text explanation.`;
            const rephrasedContentResult = await callGroqLLM('You are a helpful SAP assistant explaining concepts simply.', rephrasePrompt);
            if (rephrasedContentResult && !rephrasedContentResult.error) {
                 toolResult = { type: 'text', content: rephrasedContentResult };
            } else {
                 console.error("Error rephrasing definition:", rephrasedContentResult?.message);
                 toolResult = { type: 'text', content: definition }; // Fallback to raw definition
            }
          } else {
            console.log(`--> No good KB match found for "${normalizedSearchTerm}". Asking Groq fallback.`);
            const fallbackPrompt = `The user asked for a definition of the SAP term "${searchTerm}". It wasn't found in our specific knowledge base. Provide a concise, friendly, human-like definition ONLY if you are confident you know what it means in an SAP context. Try to include a simple analogy if it helps clarify. If unsure, respond with: "I couldn't find a specific definition for '${searchTerm}' in my knowledge base. Could you provide more context or check the spelling?"`;
            const fallbackContentResult = await callGroqLLM('You are a helpful SAP assistant explaining concepts simply.', fallbackPrompt);
             if (fallbackContentResult && !fallbackContentResult.error) {
                toolResult = { type: 'text', content: fallbackContentResult };
             } else {
                 console.error("Error getting fallback definition:", fallbackContentResult?.message);
                 toolResult = { type: 'text', content: `Sorry, I couldn't retrieve information about '${searchTerm}' right now.` };
             }
          }
          break;
        }

        // --- Other tool cases remain mostly unchanged ---
        case 'show_leave_application_form':
          console.log("--> Triggering leave form display.");
          toolResult = { type: 'leave_application_form' };
          break;

        case 'query_inventory': {
           console.log("--> Querying inventory with params:", parameters);
          let inventory = stockList;
          if (parameters.material_id) {
            const searchTerm = parameters.material_id;
             console.log(`--> Filtering inventory by material: "${searchTerm}"`);
            const searchResults = stockFuse.search(searchTerm);
            inventory = searchResults.map(result => result.item);
             console.log(`--> Found ${inventory.length} potential matches.`);
          }
          if (parameters.comparison && parameters.quantity) {
            const qty = parseInt(parameters.quantity, 10);
            const comparison = parameters.comparison.toLowerCase();
             console.log(`--> Filtering inventory by quantity: ${comparison} ${qty}`);
            if (!isNaN(qty)) {
                const originalCount = inventory.length;
                inventory = inventory.filter(item => {
                  const itemStock = parseInt(item['Stock Level'], 10);
                  if (isNaN(itemStock)) return false;
                  if (comparison.includes('less') || comparison.includes('<')) return itemStock < qty;
                  if (comparison.includes('more') || comparison.includes('greater') || comparison.includes('>')) return itemStock > qty;
                  return false;
                });
                 console.log(`--> Filtered from ${originalCount} to ${inventory.length} items.`);
            } else {
               console.warn("--> Invalid quantity provided for filtering:", parameters.quantity);
            }
          }
           console.log(`--> Returning ${inventory.length} inventory items.`);
          toolResult = {
            type: 'table',
            tableColumns: ['Material', 'Description', 'Stock Level', 'Plant'],
            tableData: inventory,
          };
          break;
        }

        case 'get_sales_orders': {
           console.log("--> Getting sales orders with params:", parameters);
          let salesOrdersResults = salesOrderData;
          if (parameters.customer) {
             console.log(`--> Filtering SO by customer: "${parameters.customer}"`);
            const searchResults = salesOrderFuse.search(parameters.customer);
            salesOrdersResults = searchResults.map(result => result.item);
          }
          if (parameters.status) {
             console.log(`--> Filtering SO by status: "${parameters.status}"`);
            const statusFuse = new Fuse(salesOrdersResults, { keys: ['status'], includeScore: true, threshold: 0.4 });
            const statusSearchResults = statusFuse.search(parameters.status);
            salesOrdersResults = statusSearchResults.map(result => result.item);
          }
          const mappedData = salesOrdersResults.map(order => ({
            'ID': order.id, 'Customer': order.customer, 'Material': order.material,
            'Quantity': order.quantity, 'Status': order.status, 'Value': order.value
          }));
           console.log(`--> Returning ${mappedData.length} sales orders.`);
          toolResult = {
            type: 'table',
            tableColumns: ['ID', 'Customer', 'Material', 'Quantity', 'Status', 'Value'],
            tableData: mappedData,
          };
          break;
        }

        case 'get_purchase_orders': {
           console.log("--> Getting purchase orders with params:", parameters);
          let purchaseOrdersResults = purchaseOrderData;
          if (parameters.vendor) {
             console.log(`--> Filtering PO by vendor: "${parameters.vendor}"`);
            const searchResults = purchaseOrderFuse.search(parameters.vendor);
            purchaseOrdersResults = searchResults.map(result => result.item);
          }
          if (parameters.status) {
             console.log(`--> Filtering PO by status: "${parameters.status}"`);
            const statusFuse = new Fuse(purchaseOrdersResults, { keys: ['status'], includeScore: true, threshold: 0.4 });
            const statusSearchResults = statusFuse.search(parameters.status);
            purchaseOrdersResults = statusSearchResults.map(result => result.item);
          }
          const poMappedData = purchaseOrdersResults.map(order => ({
            'ID': order.id, 'Vendor': order.vendor, 'Material': order.material,
            'Quantity': order.quantity, 'Status': order.status, 'Value': order.value
          }));
           console.log(`--> Returning ${poMappedData.length} purchase orders.`);
          toolResult = {
            type: 'table',
            tableColumns: ['ID', 'Vendor', 'Material', 'Quantity', 'Status', 'Value'],
            tableData: poMappedData,
          };
          break;
        }

        default:
          console.warn(`--> Unhandled tool detected: ${decision.tool_name}`);
           const fallbackTextPrompt = `The user said: "${userQuery}". I decided to use a tool called '${decision.tool_name}' which isn't recognized. Ask the user to clarify or rephrase.`;
           const fallbackResult = await callGroqLLM('You are a helpful SAP assistant.', fallbackTextPrompt);
           toolResult = { type: 'text', content: fallbackResult?.content || "Sorry, I couldn't process that request. Could you please rephrase?" };
      }
      res.json(toolResult);

    } else if (decision.type === 'text') {
      console.log('==> AI decided to have a normal conversation.');
      const contentToSend = decision.content || "Sorry, I couldn't generate a response.";
      res.json({ type: 'text', content: contentToSend });
    } else {
       console.error("==> Unexpected decision format received:", decision);
       res.status(500).json({ error: 'Received an unexpected response format from the AI.' });
    }

  } catch (error) {
    console.error("--- Error in /api/chat endpoint:", error.message, error.stack);
    res.status(500).json({ error: 'An internal server error occurred processing your request.' });
  }
});


// --- submit-leave endpoint ---
app.post('/api/submit-leave', (req, res) => {
  const newLeaveData = req.body;
   console.log("--- Received leave submission ---", newLeaveData); // Log submission
   if (!newLeaveData || typeof newLeaveData !== 'object' || Object.keys(newLeaveData).length === 0) {
     console.error("--> Invalid leave data received.");
    return res.status(400).json({ error: 'Invalid leave data provided.' });
  }
  try {
    let leaveApplications = readJsonSafely(leaveDbPath, []);
    if (!Array.isArray(leaveApplications)) {
        console.error("--> Leave applications data is not an array. Resetting.");
        leaveApplications = [];
    }
    const newEntry = { id: Date.now(), ...newLeaveData, status: 'Submitted' };
    leaveApplications.push(newEntry);
     console.log("--> Writing new leave application to file.");
    fs.writeFileSync(leaveDbPath, JSON.stringify(leaveApplications, null, 2));
    console.log("--> Leave application saved successfully.");
    res.json({
      type: 'text',
      content: 'Thanks! Your leave application has been successfully submitted and saved.'
    });
  } catch (error) {
    console.error('--> Error saving leave application:', error);
    res.status(500).json({ error: 'Failed to save the leave application.' });
  }
});

// --- Server Start for Render ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAP Assistant Backend is running on port ${PORT}`);
});