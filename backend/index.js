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
const salesOrderFuse = new Fuse(salesOrderData, { keys: ['customer', 'material'], includeScore: true, threshold: 0.4 });

const purchaseOrderData = readJsonSafely(purchaseOrdersDbPath, []);
const purchaseOrderFuse = new Fuse(purchaseOrderData, { keys: ['vendor', 'material'], includeScore: true, threshold: 0.4 });

const knowledgeData = readJsonSafely(knowledgeDbPath, []);
const knowledgeFuse = new Fuse(knowledgeData, { keys: ['term', 'definition'], includeScore: true, threshold: 0.45, ignoreLocation: true });

// --- Helper function to split multiple items ---
function extractMultipleItems(itemString) {
  if (!itemString) return [];
  
  // Split by common delimiters: 'and', ',', '&', 'or'
  const items = itemString
    .split(/\s+(?:and|or|,|&)\s+|,\s*/i)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  return items.length > 0 ? items : [itemString.trim()];
}

// --- Tools array with refined descriptions ---
const tools = [
  { name: 'get_sap_definition', description: "Use this tool ONLY to define or explain a specific SAP term, concept, T-code (like 'fb60'), process, or abbreviation (e.g., 'What is fb60?', 'Define S/4HANA', 'process for sales order', 'how to enter vendor invoice'). Extract the core term/topic.", parameters: { "term": "The specific SAP term, topic, process, T-code, or abbreviation the user is asking about." } },
  { name: 'show_leave_application_form', description: 'Use this tool when the user explicitly asks to apply for leave, request time off, or wants a leave form.', parameters: {} },
  { name: 'query_inventory', description: "Use this tool ONLY when the user asks about stock levels OR asks if specific materials/items are in stock (e.g., 'check stock', 'do we have bearings?', 'stock of pump-1001', 'pumps and bearings'). **CRITICAL: You MUST extract the specific material name(s) or ID(s)** mentioned by the user and put them in the 'material_id' parameter. If multiple items are mentioned (like 'pumps and bearings'), include ALL items separated by 'and' or commas in the 'material_id'. Do NOT use for general questions.", parameters: { "material_id": "(REQUIRED if mentioned) The exact name(s) or ID(s) of the material(s) the user asked about. For multiple items, include all separated by 'and' or commas (e.g., 'PUMP-1001', 'bearings', 'pumps and bearings', 'bearings, pumps, valves'). DO NOT omit this if the user mentions item(s).", "comparison": "(Optional) The filter operator ('less than' or 'greater than')", "quantity": "(Optional) The numeric value for comparison" } },
  { name: 'get_sales_orders', description: 'Use this tool ONLY to find/view EXISTING sales orders. Filter by customer, material(s), or status if provided. For multiple materials, include all separated by delimiters. Do NOT use for "how to", "process", or definition questions.', parameters: { "customer": "(Optional) The customer name to filter by.", "material": "(Optional) The material name(s) or ID(s) to filter by. For multiple materials, include all separated by 'and' or commas (e.g., 'pumps and bearings').", "status": "(Optional) The order status to filter by (e.g., 'Open')." } },
  { name: 'get_purchase_orders', description: 'Use this tool ONLY to find/view EXISTING purchase orders. Filter by vendor, material(s), or status if provided. For multiple materials, include all separated by delimiters. Do NOT use for "how to", "process", or definition questions.', parameters: { "vendor": "(Optional) The vendor name to filter by.", "material": "(Optional) The material name(s) or ID(s) to filter by. For multiple materials, include all separated by 'and' or commas (e.g., 'pumps and bearings').", "status": "(Optional) The order status to filter by (e.g., 'Ordered')." } }
];

// --- getToolsPrompt with priority rules ---
const getToolsPrompt = () => {
  return `You are a helpful and friendly SAP Assistant. Your primary goal is to assist users with specific SAP-related tasks using the tools provided, explaining concepts clearly.

  Available Tools:
  ${tools.map(tool => `- ${tool.name}: ${tool.description} (Parameters: ${JSON.stringify(tool.parameters)})`).join('\n')}

  Follow these rules STRICTLY based on the user's latest input:
  1. **Analyze Intent:** Determine the user's primary goal. Are they asking *what* something is (Definition)? Are they asking *how* to do something (Process)? Are they asking to *see/view/get data* (Inventory, SO, PO)? Are they asking for a *form* (Leave)? Or just chatting?
  2. **Definition Questions:** If the user asks 'what is X' or 'define X' where X is a CONCEPT/TERM (e.g., "what is FB60", "define purchase order", "what is S/4HANA"), use the 'get_sap_definition' tool.
  3. **Process Questions:** If the user asks 'how to X', 'process for X', 'steps to X', use the 'get_sap_definition' tool. Extract X as the 'term'.
  4. **Data/Records Requests:** If the user asks to VIEW/SEE/GET existing data or records (e.g., "show me purchase orders", "get sales orders", "what are THE purchase orders", "view stock", "POs for ABC vendor"), use the corresponding data tool ('query_inventory', 'get_sales_orders', 'get_purchase_orders'). **CRITICAL:** Extract relevant parameters accurately. For multiple items mentioned, include all in the parameter.
  5. **Form Requests:** If the user asks to apply for leave or wants a leave form, use 'show_leave_application_form'.
  6. **Simple Chat:** If the input is a simple acknowledgment ('ok', 'thanks'), compliment, or greeting, respond briefly using JSON format A.
  7. **Fallback:** If unclear, respond politely using JSON format A.
  
  **KEY DISTINCTION:** 
  - "What is a purchase order?" → Definition (use get_sap_definition)
  - "What are the purchase orders?" / "Show purchase orders" → Data request (use get_purchase_orders)
  - "What is stock?" → Definition (use get_sap_definition)
  - "What is the stock?" / "Show me stock" → Data request (use query_inventory)

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
       return { error: true, message: "Invalid response structure from AI.", status: 500 };
    }
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
    const decisionMakingPrompt = `User's input: "${originalUserQuery}"\n\nBased on this input and the rules provided in the system prompt, what is the correct JSON response? Pay CLOSE attention to parameter extraction rules for tools, especially when multiple items are mentioned.`;
    const decisionResult = await callGroqLLM(getToolsPrompt(), decisionMakingPrompt, true);

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
          let searchTerm = parameters.term;
          if (!searchTerm) {
             console.warn("Tool 'get_sap_definition' called without 'term'.");
             toolResult = { type: 'text', content: "Please tell me which SAP term or process you want explained." };
             break;
          }

          console.log(`--> Searching KB for: "${searchTerm}"`);
          const askedForProcess = /\b(process|how to|steps|procedure|way to)\b/i.test(originalUserQuery);
          console.log(`--> User asked for process/how-to: ${askedForProcess}`);

          // Perform fuzzy search on the knowledge base
          const kbSearchResults = knowledgeFuse.search(searchTerm);
          console.log(`--> Found ${kbSearchResults.length} KB results`);
          
          // Get top 3 relevant results for context
          const topResults = kbSearchResults.slice(0, 3).filter(result => result.score < 0.6);
          
          let llmSystemPrompt = '';
          let llmUserPrompt = '';

          if (topResults.length > 0) {
            console.log(`--> Using ${topResults.length} KB matches for context:`);
            topResults.forEach((result, idx) => {
              console.log(`   ${idx + 1}. ${result.item.term} (Score: ${result.score})`);
            });

            // Build context from KB results
            const kbContext = topResults.map(result => 
              `Term: "${result.item.term}"\nDefinition: ${result.item.definition}`
            ).join('\n\n');

            if (askedForProcess) {
              // User wants a process explanation
              llmSystemPrompt = `You are a friendly SAP expert who explains processes in a conversational, easy-to-understand way. You break down complex SAP procedures into simple steps, use analogies from everyday life, and make learning SAP feel approachable. Keep responses concise and focused - aim for 3-5 sentences maximum.`;
              
              llmUserPrompt = `A user asked: "${originalUserQuery}"

I found these relevant SAP terms in our knowledge base:
${kbContext}

Your task:
1. Explain ONLY what the user asked about - stay focused on "${searchTerm}"
2. Give a brief, step-by-step process (3-5 main steps maximum)
3. Include ONE simple analogy to make it relatable
4. Keep it short, friendly, and energetic - like a quick helpful tip
5. DO NOT explain related terms or go off-topic

Keep your response under 150 words. Be concise and punchy!`;

            } else {
              // User wants a definition/explanation
              llmSystemPrompt = `You are a friendly SAP expert who explains concepts in a way anyone can understand. You use analogies, examples, and conversational language to make SAP terminology accessible. Keep responses concise and energetic - aim for 2-4 sentences maximum.`;
              
              llmUserPrompt = `A user asked: "${originalUserQuery}"

I found these relevant SAP terms in our knowledge base:
${kbContext}

Your task:
1. Explain ONLY what "${searchTerm}" is - stay laser-focused on this term
2. Use ONE simple, relatable analogy
3. Keep it super concise and friendly - like a quick explanation between colleagues
4. DO NOT mention related terms, variants, or go into extra details unless directly relevant
5. Make it energetic and clear

Keep your response under 80 words. Be brief, friendly, and to the point!`;
            }

          } else {
            // No good KB matches - use LLM's general knowledge with caution
            console.log(`--> No good KB matches found for "${searchTerm}"`);
            
            if (askedForProcess) {
              llmSystemPrompt = `You are an SAP expert who helps users understand processes. Be helpful but honest about limitations.`;
              
              llmUserPrompt = `A user asked: "${originalUserQuery}"

I couldn't find specific information about "${searchTerm}" in our knowledge base. 

If you're confident about this SAP process from your training data:
- Explain the typical steps clearly and conversationally
- Use a simple analogy to make it relatable
- Keep it practical and actionable

If you're not sure about this specific process:
- Politely let them know you couldn't find specific details
- Ask them to provide more context or rephrase
- Suggest they verify the term spelling or check official SAP documentation

Be honest and helpful!`;

            } else {
              llmSystemPrompt = `You are an SAP expert who provides accurate information. Be helpful but honest about limitations.`;
              
              llmUserPrompt = `A user asked: "${originalUserQuery}"

I couldn't find information about "${searchTerm}" in our knowledge base.

If you're confident this is a real SAP term from your training:
- Provide a clear, friendly definition
- Use a simple analogy to explain it
- Keep it conversational

If you're not sure about this term:
- Politely say you couldn't find it in the knowledge base
- Ask for more context or suggest checking the spelling
- Don't make up information

Be honest and helpful!`;
            }
          }

          // Get the final explanation from LLM
          const finalResult = await callGroqLLM(llmSystemPrompt, llmUserPrompt);

          if (finalResult && !finalResult.error) {
            toolResult = { type: 'text', content: finalResult };
          } else {
            console.error("Error getting final explanation from LLM:", finalResult?.message);
            toolResult = { type: 'text', content: `Sorry, I encountered an issue while trying to explain '${searchTerm}'. Please try again.` };
          }
          break;
        }

        case 'show_leave_application_form':
          console.log("--> Triggering leave form display.");
          toolResult = { type: 'leave_application_form' };
          break;

        case 'query_inventory': {
           console.log("--> Querying inventory with params:", parameters);
          let inventory = [];
          const materialSearchTerm = parameters.material_id;
          
          if (materialSearchTerm) {
             console.log(`--> Filtering inventory by material(s): "${materialSearchTerm}"`);
             
             // Extract multiple items
             const items = extractMultipleItems(materialSearchTerm);
             console.log(`--> Extracted ${items.length} item(s):`, items);
             
             // Search for each item and collect results
             const allResults = new Map(); // Use Map to avoid duplicates by Material ID
             
             for (const item of items) {
               const searchResults = stockFuse.search(item);
               searchResults.forEach(result => {
                 if (!allResults.has(result.item.Material)) {
                   allResults.set(result.item.Material, result.item);
                 }
               });
             }
             
             inventory = Array.from(allResults.values());
             console.log(`--> Found ${inventory.length} unique items across all searches.`);
          } else {
             console.warn("--> Tool 'query_inventory' called without 'material_id'. Showing all stock as fallback.");
             inventory = stockList;
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
          
          // Filter by customer if provided
          if (parameters.customer) {
             console.log(`--> Filtering SO by customer: "${parameters.customer}"`);
            const searchResults = salesOrderFuse.search(parameters.customer);
            salesOrdersResults = searchResults.map(result => result.item);
          }
          
          // Filter by material(s) if provided
          if (parameters.material) {
             console.log(`--> Filtering SO by material(s): "${parameters.material}"`);
             
             // Extract multiple materials
             const materials = extractMultipleItems(parameters.material);
             console.log(`--> Extracted ${materials.length} material(s):`, materials);
             
             // Search for each material
             const allResults = new Map();
             
             for (const material of materials) {
               const materialFuse = new Fuse(salesOrdersResults, { 
                 keys: ['material'], 
                 includeScore: true, 
                 threshold: 0.4 
               });
               const searchResults = materialFuse.search(material);
               searchResults.forEach(result => {
                 if (!allResults.has(result.item.id)) {
                   allResults.set(result.item.id, result.item);
                 }
               });
             }
             
             salesOrdersResults = Array.from(allResults.values());
             console.log(`--> Found ${salesOrdersResults.length} orders with matching materials.`);
          }
          
          // Filter by status if provided
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
          
          // Filter by vendor if provided
          if (parameters.vendor) {
             console.log(`--> Filtering PO by vendor: "${parameters.vendor}"`);
            const searchResults = purchaseOrderFuse.search(parameters.vendor);
            purchaseOrdersResults = searchResults.map(result => result.item);
          }
          
          // Filter by material(s) if provided
          if (parameters.material) {
             console.log(`--> Filtering PO by material(s): "${parameters.material}"`);
             
             // Extract multiple materials
             const materials = extractMultipleItems(parameters.material);
             console.log(`--> Extracted ${materials.length} material(s):`, materials);
             
             // Search for each material
             const allResults = new Map();
             
             for (const material of materials) {
               const materialFuse = new Fuse(purchaseOrdersResults, { 
                 keys: ['material'], 
                 includeScore: true, 
                 threshold: 0.4 
               });
               const searchResults = materialFuse.search(material);
               searchResults.forEach(result => {
                 if (!allResults.has(result.item.id)) {
                   allResults.set(result.item.id, result.item);
                 }
               });
             }
             
             purchaseOrdersResults = Array.from(allResults.values());
             console.log(`--> Found ${purchaseOrdersResults.length} orders with matching materials.`);
          }
          
          // Filter by status if provided
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