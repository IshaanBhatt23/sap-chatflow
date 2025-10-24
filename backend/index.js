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
  { name: 'get_sap_definition', description: "Use this tool ONLY to define or explain a specific SAP term, concept, T-code (like 'fb60'), process, or abbreviation (e.g., 'What is fb60?', 'Define S/4HANA', 'process for sales order', 'how to enter vendor invoice'). Extract the core term/topic.", parameters: { "term": "The specific SAP term, topic, process, T-code, or abbreviation the user is asking about." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user explicitly asks to apply for leave, request time off, or wants a leave form.', parameters: {} },
  { name: 'query_inventory', description: "Use this tool ONLY when the user asks about stock levels OR asks if specific materials/items are in stock (e.g., 'check stock', 'do we have bearings?', 'stock of pump-1001', 'pumps and bearings'). Parameters needed: 'material_id' (if mentioned), 'comparison', 'quantity'.", parameters: { "material_id": "(Optional) The exact name(s) or ID(s) of the material(s) the user asked about (e.g., 'PUMP-1001', 'bearings', 'pumps and bearings').", "comparison": "(Optional) The filter operator ('less than' or 'greater than')", "quantity": "(Optional) The numeric value for comparison" } },
  { name: 'get_sales_orders', description: 'Use this tool ONLY to find/view EXISTING sales orders. Filter by customer or status if provided. Do NOT use for "how to", "process", or definition questions. Parameters needed: \'customer\', \'status\'.', parameters: { "customer": "(Optional) The customer name to filter by.", "status": "(Optional) The order status to filter by (e.g., 'Open')." } },
  { name: 'get_purchase_orders', description: 'Use this tool ONLY to find/view EXISTING purchase orders. Filter by vendor or status if provided. Do NOT use for "how to", "process", or definition questions. Parameters needed: \'vendor\', \'status\'.', parameters: { "vendor": "(Optional) The vendor name to filter by.", "status": "(Optional) The order status to filter by (e.g., 'Ordered')." } }
];

// --- getToolsPrompt with priority rules ---
const getToolsPrompt = () => {
  // Simplified prompt focusing on tool choice, less on parameter extraction here.
  return `You are an AI assistant classifying user requests for SAP tasks. Choose the single best tool from the list below based on the user's latest input. If no tool clearly matches, or if it's simple chat, respond as a normal conversation.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

  Follow these rules:
  1. **Analyze Intent:** Determine the user's primary goal based SOLELY on their latest message.
  2. **Tool Match:** If the goal clearly matches a tool's description (definition, stock query, view orders, leave form), select that tool_name. Extract parameters *only if explicitly obvious and simple* (like a T-code for definition). Do NOT extract complex parameters like material names here. Respond in JSON format B.
  3. **Simple Chat/Greeting:** If the input is only a simple acknowledgment, compliment, or greeting, respond briefly and friendly using JSON format A.
  4. **No Match/Fallback:** If no tool clearly matches or the request is ambiguous/unrelated, respond politely using JSON format A, stating you can help with specific SAP tasks listed in the tools.

  Your response MUST be a single, valid JSON object with ONE of the following formats ONLY:
  A. For text responses: { "type": "text", "content": "Your conversational response here." }
  B. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { /* simple parameters ONLY if obvious, otherwise empty {} */ } }`;
};


// --- HELPER FUNCTION TO CALL GROQ ---
async function callGroqLLM(systemPrompt, userPrompt, isJsonMode = false) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY environment variable not set.");
    return { error: true, message: "Groq API key is missing.", status: 500 };
  }
  const messages = [ { role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt } ];
  const payload = { model: 'llama-3.1-8b-instant', messages: messages, temperature: 0.3 }; // Lower temp for more deterministic choice/extraction

  if (isJsonMode) {
    payload.response_format = { type: "json_object" };
    console.log(`Requesting JSON response from Groq model: ${payload.model}`);
  } else {
    console.log(`Requesting text response from Groq model: ${payload.model}`);
  }

  try {
    const response = await axios.post(GROQ_API_URL, payload, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' } });
    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) { console.error("Unexpected response structure from Groq:", response.data); return { error: true, message: "Invalid response structure from AI.", status: 500 }; }
    // console.log("Raw Groq response content:", content); // Keep commented unless debugging
    return content;
  } catch (error) {
    console.error("Error calling Groq API:");
    let status = 500, message = "Failed to get a response from the AI.";
    if (error.response) { console.error("Data:", error.response.data); console.error("Status:", error.response.status); status = error.response.status; message = error.response.data?.error?.message || message; }
    else if (error.request) { console.error("Request:", error.request); message = "No response received from AI service."; }
    else { console.error('Error Message:', error.message); message = error.message; }
    return { error: true, message: message, status: status };
  }
}

// --- NEW HELPER FOR PARAMETER EXTRACTION ---
async function extractParameters(originalUserQuery, toolName) {
  console.log(`--> Attempting secondary extraction for tool: ${toolName}`);
  let extractionPrompt = '';
  let expectedParams = {}; // Define expected parameters structure

  switch (toolName) {
    case 'query_inventory':
      extractionPrompt = `User query: "${originalUserQuery}"\n\nExtract the specific material name(s) or ID(s) mentioned (like 'pump', 'bearings', 'pump-1001', 'pumps and bearings'). Also extract any comparison ('less than', 'greater than') and quantity. Respond ONLY with a valid JSON object containing extracted values for "material_id", "comparison", and "quantity". If a value isn't mentioned, omit the key or set it to null. Example: {"material_id": "pumps and bearings", "comparison": null, "quantity": null}`;
      expectedParams = { material_id: null, comparison: null, quantity: null };
      break;
    case 'get_sales_orders':
      extractionPrompt = `User query: "${originalUserQuery}"\n\nExtract the customer name and/or order status mentioned. Respond ONLY with a valid JSON object containing extracted values for "customer" and "status". If a value isn't mentioned, omit the key or set it to null. Example: {"customer": "Tech Corp", "status": "Open"}`;
      expectedParams = { customer: null, status: null };
      break;
    case 'get_purchase_orders':
      extractionPrompt = `User query: "${originalUserQuery}"\n\nExtract the vendor name and/or order status mentioned. Respond ONLY with a valid JSON object containing extracted values for "vendor" and "status". If a value isn't mentioned, omit the key or set it to null. Example: {"vendor": "Supplier XYZ", "status": "Delivered"}`;
      expectedParams = { vendor: null, status: null };
      break;
    default:
      console.warn(`--> Secondary extraction not configured for tool: ${toolName}`);
      return {}; // No extraction needed/configured
  }

  const systemPrompt = "You are an AI assistant that extracts specific parameter values from user text and outputs ONLY valid JSON.";
  const extractionResult = await callGroqLLM(systemPrompt, extractionPrompt, true); // JSON mode

  if (extractionResult && !extractionResult.error) {
    try {
      const extracted = JSON.parse(extractionResult);
      console.log("--> Secondary extraction successful:", extracted);
      return extracted;
    } catch (parseError) {
      console.error("--> Failed to parse secondary extraction JSON:", extractionResult, parseError);
      return {}; // Return empty if parsing fails
    }
  } else {
    console.error("--> Error during secondary extraction call:", extractionResult?.message);
    return {}; // Return empty on error
  }
}
// --- END NEW HELPER ---


// --- Main Chat Endpoint ---
app.post('/api/chat', async (req, res) => {
  const { messageHistory } = req.body;
  if (!Array.isArray(messageHistory) || messageHistory.length === 0) {
    return res.status(400).json({ error: 'Invalid messageHistory provided.' });
  }
  const originalUserQuery = messageHistory[messageHistory.length - 1].text;
  console.log(`\n--- Received query: "${originalUserQuery}" ---`);

  try {
    // --- STEP 1: Call Groq for TOOL CHOICE (primary focus) ---
    const toolChoicePrompt = `User's input: "${originalUserQuery}"\n\nBased ONLY on the user's input and the provided tool descriptions, choose the best tool or decide on a text response. Extract parameters ONLY if extremely simple and obvious (like a T-code). Output JSON.`;
    const decisionResult = await callGroqLLM(getToolsPrompt(), toolChoicePrompt, true); // JSON mode

    // ... (Error handling for decisionResult as before) ...
     if (decisionResult && decisionResult.error) { /* ... handle error ... */ return res.status(decisionResult.status || 500).json({ error: decisionResult.message }); }
     const decisionString = decisionResult;
     if (!decisionString) { /* ... handle error ... */ return res.status(500).json({ error: "AI service failed to provide a decision." }); }

    let decision;
    try {
      decision = JSON.parse(decisionString);
      console.log("==> Parsed AI decision (Step 1 - Tool Choice):", JSON.stringify(decision, null, 2));
    } catch (parseError) {
       // ... (Handle parse error as before, potentially fallback to text) ...
       console.error("Failed to parse JSON decision:", decisionString, parseError); return res.status(500).json({ error: "Failed to interpret AI decision." });
    }

    // --- STEP 2: Execute the decision ---
    if (decision.type === 'tool_call' && decision.tool_name) {
      console.log(`==> Executing tool: ${decision.tool_name}`);
      let toolResult;
      let parameters = decision.parameters || {}; // Start with parameters from Step 1

      // --- STEP 2.1: SECONDARY PARAMETER EXTRACTION (if needed) ---
      const needsParams = ['query_inventory', 'get_sales_orders', 'get_purchase_orders'].includes(decision.tool_name);
      const paramsMissing = (
        (decision.tool_name === 'query_inventory' && !parameters.material_id && originalUserQuery.match(/\b(stock of|have|inventory of|levels of)\b.*\b([a-zA-Z0-9\-\s]+)\b/i)) || // Check if likely material was mentioned
        (decision.tool_name === 'get_sales_orders' && (!parameters.customer && !parameters.status)) || // Add more checks if needed
        (decision.tool_name === 'get_purchase_orders' && (!parameters.vendor && !parameters.status)) // Add more checks if needed
      );

       // Simple check: if a tool needing params has none extracted, try again.
      if (needsParams && Object.keys(parameters).length === 0 && decision.tool_name !== 'get_sap_definition') {
          console.log(`--> Parameters potentially missing for ${decision.tool_name}. Running secondary extraction.`);
          const extractedParams = await extractParameters(originalUserQuery, decision.tool_name);
          // Merge extracted params, giving preference to newly extracted ones if keys overlap
          parameters = { ...parameters, ...extractedParams };
          console.log("--> Merged parameters after secondary extraction:", parameters);
      }
      // Specific check for query_inventory if material_id seems missing despite user mentioning items
       else if (decision.tool_name === 'query_inventory' && !parameters.material_id && originalUserQuery.match(/\b(of|have)\b.*\b([a-zA-Z]{3,})\b/i)) { // Simple regex check for item names
            console.log(`--> 'material_id' missing for query_inventory despite possible mention. Running secondary extraction.`);
            const extractedParams = await extractParameters(originalUserQuery, decision.tool_name);
            parameters = { ...parameters, ...extractedParams };
            console.log("--> Merged parameters after secondary extraction for inventory:", parameters);
       }


      // --- STEP 2.2: Execute Tool Logic with FINAL parameters ---
      switch (decision.tool_name) {
        case 'get_sap_definition': {
          // ... (Existing logic, but use 'parameters.term') ...
          let searchTerm = parameters.term;
          if (!searchTerm) { /* handle missing term */ toolResult = { type: 'text', content: "Please tell me which SAP term or process you want explained." }; break; }
          const normalizedSearchTerm = searchTerm.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const askedForProcess = /\b(process|how to|steps)\b/i.test(originalUserQuery);
          const kbSearchResults = knowledgeFuse.search(normalizedSearchTerm);
          const topScore = kbSearchResults[0]?.score;
          const goodKbMatch = kbSearchResults.length > 0 && topScore < 0.45;
          let llmSystemPrompt = 'You are a helpful SAP assistant explaining concepts simply.';
          let llmUserPrompt = '';
          if (goodKbMatch) { /* KB match logic */
              const definition = kbSearchResults[0].item.definition; const matchedTerm = kbSearchResults[0].item.term;
              if (askedForProcess) { llmUserPrompt = `... Explain process using definition: "${definition}"...`; llmSystemPrompt = '... expert explaining processes...'; }
              else { llmUserPrompt = `... Explain definition: "${definition}" with analogy...`; }
          } else { /* No KB match logic */
              if (askedForProcess) { llmUserPrompt = `... Explain process for "${searchTerm}"...`; llmSystemPrompt = '... expert explaining processes...'; }
              else { llmUserPrompt = `... Define "${searchTerm}" only if confident...`; }
          }
          const finalResult = await callGroqLLM(llmSystemPrompt, llmUserPrompt);
          if (finalResult && !finalResult.error) { toolResult = { type: 'text', content: finalResult }; }
          else { /* handle error */ toolResult = { type: 'text', content: `Sorry, issue explaining '${searchTerm}'.` }; }
          break;
        }

        case 'show_leave_application_form':
          toolResult = { type: 'leave_application_form' };
          break;

        case 'query_inventory': {
          console.log("--> Final inventory query with params:", parameters);
          let inventory = stockList;
          const materialSearchTerm = parameters.material_id; // Use final param
          if (materialSearchTerm) {
            console.log(`--> Filtering inventory by final material: "${materialSearchTerm}"`);
            const searchResults = stockFuse.search(materialSearchTerm);
            inventory = searchResults.map(result => result.item);
            console.log(`--> Found ${inventory.length} matches.`);
          } else {
             console.log("--> No material specified, showing all inventory.");
          }
          // ... (quantity/comparison filtering remains the same) ...
           if (parameters.comparison && parameters.quantity) { /* filter by qty */ }
          toolResult = { type: 'table', tableColumns: ['Material', 'Description', 'Stock Level', 'Plant'], tableData: inventory };
          break;
        }

        case 'get_sales_orders': {
           console.log("--> Final SO query with params:", parameters);
           let salesOrdersResults = salesOrderData;
           if (parameters.customer) { /* filter by customer */ const searchResults = salesOrderFuse.search(parameters.customer); salesOrdersResults = searchResults.map(r=>r.item); }
           if (parameters.status) { /* filter by status */ const statusFuse = new Fuse(salesOrdersResults, {keys:['status'], ...}); const statusResults = statusFuse.search(parameters.status); salesOrdersResults = statusResults.map(r=>r.item); }
           const mappedData = salesOrdersResults.map(order => ({ /* map fields */ }));
           toolResult = { type: 'table', tableColumns: [/* cols */], tableData: mappedData };
          break;
        }

        case 'get_purchase_orders': {
           console.log("--> Final PO query with params:", parameters);
           let purchaseOrdersResults = purchaseOrderData;
           if (parameters.vendor) { /* filter by vendor */ const searchResults = purchaseOrderFuse.search(parameters.vendor); purchaseOrdersResults = searchResults.map(r=>r.item); }
           if (parameters.status) { /* filter by status */ const statusFuse = new Fuse(purchaseOrdersResults, {keys:['status'], ...}); const statusResults = statusFuse.search(parameters.status); purchaseOrdersResults = statusResults.map(r=>r.item); }
           const poMappedData = purchaseOrdersResults.map(order => ({ /* map fields */ }));
           toolResult = { type: 'table', tableColumns: [/* cols */], tableData: poMappedData };
          break;
        }

        default: // Unhandled tool
            console.warn(`--> Unhandled tool detected after potential extraction: ${decision.tool_name}`);
            const fallbackTextPrompt = `... Ask user to clarify ...`;
            const fallbackResult = await callGroqLLM('You are a helpful SAP assistant.', fallbackTextPrompt);
            const fallbackContent = fallbackResult && !fallbackResult.error ? fallbackResult : "Sorry, ... rephrase?";
            toolResult = { type: 'text', content: fallbackContent };
      }
      res.json(toolResult);

    } else if (decision.type === 'text') {
      console.log('==> AI decided to have a normal conversation (Step 1).');
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
   console.log("--- Received leave submission ---", newLeaveData);
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAP Assistant Backend is running on port ${PORT}`);
});