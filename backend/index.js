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
// Relaxed threshold slightly for better matching on normalized terms
const knowledgeFuse = new Fuse(knowledgeData, { keys: ['term', 'definition'], includeScore: true, threshold: 0.45, ignoreLocation: true });


// --- Tools array with refined descriptions ---
const tools = [
  // --- MODIFIED Description for clarity on processes ---
  { name: 'get_sap_definition', description: "Use this tool ONLY to define or explain a specific SAP term, concept, T-code (like 'fb60'), process, or abbreviation (e.g., 'What is fb60?', 'Define S/4HANA', 'process for sales order', 'how to enter vendor invoice'). Extract the core term/topic.", parameters: { "term": "The specific SAP term, topic, process, T-code, or abbreviation the user is asking about." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user explicitly asks to apply for leave, request time off, or wants a leave form.', parameters: {} },
  // --- MODIFIED Description for better extraction ---
  { name: 'query_inventory', description: "Use this tool ONLY when the user asks about stock levels or specific materials/items (e.g., 'check stock', 'do we have bearings?', 'stock of pump-1001'). **Extract the material name(s)/ID(s)** mentioned as 'material_id'. If multiple items are mentioned, combine them (e.g., 'pumps and bearings'). Do NOT use for general questions.", parameters: { "material_id": "(REQUIRED if mentioned) The specific ID(s) or name(s) of the material(s) the user asked about (e.g., 'PUMP-1001', 'bearings', 'pumps and bearings')", "comparison": "(Optional) The filter operator ('less than' or 'greater than')", "quantity": "(Optional) The numeric value for comparison" } },
  // --- MODIFIED Description ---
  { name: 'get_sales_orders', description: 'Use this tool ONLY to find/view EXISTING sales orders. Filter by customer or status if provided. Do NOT use for "how to", "process", or definition questions.', parameters: { "customer": "(Optional) The customer name to filter by.", "status": "(Optional) The order status to filter by (e.g., 'Open')." } },
  // --- MODIFIED Description ---
  { name: 'get_purchase_orders', description: 'Use this tool ONLY to find/view EXISTING purchase orders. Filter by vendor or status if provided. Do NOT use for "how to", "process", or definition questions.', parameters: { "vendor": "(Optional) The vendor name to filter by.", "status": "(Optional) The order status to filter by (e.g., 'Ordered')." } }
];

// --- getToolsPrompt with priority rules ---
const getToolsPrompt = () => {
  return `You are a helpful and friendly SAP Assistant. Your primary goal is to assist users with specific SAP-related tasks using the tools provided, explaining concepts clearly.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Follow these rules STRICTLY based on the user's latest input:
  1. **Analyze Intent:** Determine the user's primary goal. Are they asking *what* something is or *how* to do something (Definition/Process)? Are they asking to *see data* (Inventory, SO, PO)? Are they asking for a *form* (Leave)? Or just chatting?
  2. **Definition/Process Questions:** If the user asks 'what is X', 'define X', 'explain X', 'process for X', or 'how to do X' (where X is an SAP term, T-code, concept, or process), you MUST use the 'get_sap_definition' tool. Extract X as the 'term'.
  3. **Data/Form Requests:** If the user asks to see stock, orders, or get the leave form, use the corresponding tool ('query_inventory', 'get_sales_orders', 'get_purchase_orders', 'show_leave_application_form'). **PRIORITY:** You MUST attempt to extract relevant parameters (material_id, customer, vendor, status) if mentioned.
  4. **Simple Chat:** If the input is *only* a simple acknowledgment ('ok', 'thanks'), compliment ('great job'), or greeting ('hello'), respond briefly and friendly using JSON format A.
  5. **Fallback:** If the input doesn't match rules 2, 3, or 4 (e.g., unrelated question, vague SAP request), respond politely using JSON format A, explaining you can use tools for specific tasks or define SAP terms/processes. DO NOT try to answer general SAP questions outside the scope of the tools.

  Your response MUST be a single, valid JSON object with ONE of the following formats ONLY:
  A. For text responses: { "type": "text", "content": "Your conversational response here." }
  B. To use a tool: { "type": "tool_call", "tool_name": "name_of_the_tool", "parameters": { /* extracted parameters */ } }`;
};


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
    temperature: 0.5, // Keep slightly lower temp for better instruction following
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
     // console.log("Raw Groq response content:", content); // Keep commented unless debugging
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
  const originalUserQuery = messageHistory[messageHistory.length - 1].text;
  console.log(`\n--- Received query: "${originalUserQuery}" ---`);

  try {
    // --- STEP 1: Call Groq for the decision ---
    const decisionMakingPrompt = `User's input: "${originalUserQuery}"\n\nBased on this input and the rules provided in the system prompt, what is the correct JSON response?`;
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
        // --- MODIFIED CASE 'get_sap_definition' ---
        case 'get_sap_definition': {
          let searchTerm = parameters.term;
          if (!searchTerm) {
             console.warn("Tool 'get_sap_definition' called without 'term'.");
             toolResult = { type: 'text', content: "Please tell me which SAP term or process you want explained." };
             break;
          }

          // Normalize the search term for KB lookup
          // Keep original search term for LLM prompts, use normalized for KB search
          const normalizedSearchTerm = searchTerm.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); // More aggressive normalization
          console.log(`--> Original search term: "${searchTerm}", Normalized for KB: "${normalizedSearchTerm}"`);

          const askedForProcess = /\b(process|how to|steps)\b/i.test(originalUserQuery);
          console.log(`--> User asked for process: ${askedForProcess}`);

          const kbSearchResults = knowledgeFuse.search(normalizedSearchTerm);
          const topScore = kbSearchResults[0]?.score;
          const goodKbMatch = kbSearchResults.length > 0 && topScore < 0.45;

          let llmSystemPrompt = 'You are a helpful SAP assistant explaining concepts simply.';
          let llmUserPrompt = '';

          if (goodKbMatch) {
            console.log('--> Found KB match:', kbSearchResults[0].item.term, `(Score: ${topScore})`);
            const definition = kbSearchResults[0].item.definition;
            const matchedTerm = kbSearchResults[0].item.term;

            if (askedForProcess) {
              llmUserPrompt = `The user asked about the process related to "${searchTerm}". We found this definition for "${matchedTerm}" in our knowledge base: "${definition}". Explain this clearly, then briefly outline the typical steps in the related SAP process. Use a simple analogy. Provide only the final explanation.`;
              llmSystemPrompt = 'You are an SAP expert explaining processes clearly and concisely.';
            } else {
              llmUserPrompt = `A user asked about "${searchTerm}". Explain the following definition for "${matchedTerm}" simply, like you're talking to a colleague. Include a simple analogy: "${definition}". Just provide the final explanation.`;
            }
          } else {
            console.log(`--> No good KB match found for "${normalizedSearchTerm}". Asking Groq fallback.`);
            if (askedForProcess) {
               llmUserPrompt = `The user asked about the SAP process for "${searchTerm}". It wasn't found in our specific knowledge base. Based on your general SAP knowledge, outline the typical steps. Keep it concise, use an analogy. If unsure, respond: "I couldn't find specific details for the '${searchTerm}' process. Could you describe what you're trying to achieve?"`;
               llmSystemPrompt = 'You are an SAP expert explaining processes clearly and concisely.';
            } else {
              llmUserPrompt = `The user asked for a definition of SAP term "${searchTerm}". It wasn't in our knowledge base. Provide a concise, friendly definition ONLY if you are confident about its SAP context. Use a simple analogy. If unsure, respond: "I couldn't find a specific definition for '${searchTerm}'. Could you provide more context or check the spelling?"`;
            }
          }

          const finalResult = await callGroqLLM(llmSystemPrompt, llmUserPrompt);

          if (finalResult && !finalResult.error) {
            toolResult = { type: 'text', content: finalResult };
          } else {
            console.error("Error getting final explanation from LLM:", finalResult?.message);
            toolResult = { type: 'text', content: `Sorry, I encountered an issue while trying to explain '${searchTerm}'. Please try again.` };
          }
          break;
        }
        // --- END MODIFIED CASE ---

        // --- Other tool cases ---
        case 'show_leave_application_form':
          console.log("--> Triggering leave form display.");
          toolResult = { type: 'leave_application_form' };
          break;

        case 'query_inventory': {
           console.log("--> Querying inventory with params:", parameters);
          let inventory = stockList;
          // --- IMPROVED: Handle potentially missing material_id ---
          const materialSearchTerm = parameters.material_id;
          if (materialSearchTerm) {
             console.log(`--> Filtering inventory by material: "${materialSearchTerm}"`);
            const searchResults = stockFuse.search(materialSearchTerm); // Use the combined term directly
            inventory = searchResults.map(result => result.item);
             console.log(`--> Found ${inventory.length} potential matches for "${materialSearchTerm}".`);
          } else {
             console.log("--> No specific material_id provided, showing all stock.");
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
           const fallbackTextPrompt = `The user said: "${originalUserQuery}". I decided to use a tool called '${decision.tool_name}' which isn't recognized. Ask the user to clarify or rephrase.`;
           const fallbackResult = await callGroqLLM('You are a helpful SAP assistant.', fallbackTextPrompt);
           const fallbackContent = fallbackResult && !fallbackResult.error ? fallbackResult : "Sorry, I couldn't process that request. Could you please rephrase?";
           toolResult = { type: 'text', content: fallbackContent };
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

// --- Server Start for Render ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAP Assistant Backend is running on port ${PORT}`);
});