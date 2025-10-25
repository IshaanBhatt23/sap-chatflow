# 💬 Sap-chatflow: The AI-Powered SAP Assistant

**[🌐 Live Demo → Sap-chatflow](https://sap-chatflow.vercel.app/)**

Sap-chatflow is an innovative conversational AI application designed to simplify complex interactions with **Enterprise Resource Planning (ERP)** systems — specifically focusing on **SAP** operations and terminology.  
By leveraging a modern **Large Language Model (LLM)** and **Retrieval-Augmented Generation (RAG)** architecture, it transforms rigid SAP workflows into intuitive chat commands.

---

## ✨ Features

Sap-chatflow functions as a highly effective digital assistant, providing both **informational retrieval** and **direct action** capabilities within the chat interface.

### 1. 🧠 Contextual Information Retrieval (RAG)
- **SAP Terminology:** Instantly provides clear, layman definitions and explanations for complex SAP transaction codes (e.g., `FB60`) and process terminology, sourced from a dedicated knowledge base.  
- **Knowledge Base:** Utilizes a specialized external knowledge base for grounded responses, ensuring accuracy and relevance to the SAP domain.

### 2. 📊 Dynamic Data Lookups
Users can query real-time operational data, which the chatbot retrieves from the backend’s persistent storage and displays in formatted tables directly in the chat.

- **Inventory Status:** Check current stock levels for specific materials.  
- **Procurement:** View lists of active Purchase Orders (POs).  
- **Sales:** Retrieve delivered or open Sales Orders (SOs).  

### 3. ⚙️ Interactive Workflow Automation
The chatbot can dynamically generate **fillable forms** within the chat for routine administrative tasks.

- **Leave Application:** Generates a structured form upon user request.  
- **Data Submission:** Completed forms are stored in the backend’s persistent storage through the backend’s data handling logic.

---

## 💻 Technology Stack

| Category | Technology | Purpose |
|-----------|-------------|----------|
| **Frontend** | TypeScript / React (Vite) | Modern, responsive chat interface and UI components (`./src/components/`) |
| **Backend** | Node.js (via `index.js`) | Handles API calls to the LLM, RAG logic, and data persistence |
| **LLM** | Llama 3.1 | Core generative model for user intent and response formulation |
| **Architecture** | Retrieval-Augmented Generation (RAG) | Grounds LLM responses using SAP-specific data from local files |
| **Package Manager** | Bun / npm | Dependency management and app execution |
| **Data Storage** | Local Persistent Storage | Stores the SAP knowledge base and simulates ERP transactional data |

---

## 🛠️ Setup and Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS version)
- [Bun](https://bun.sh) (Recommended) or npm/yarn
- Access to a **Llama 3.1 API endpoint** or a locally run instance (e.g., via **Ollama** or similar inference engine)

---

### Installation Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/IshaanBhatt23/sap-chatflow
cd sap-chatflow
```

#### 2. Install Dependencies
Since the repository uses `bun.lockb`, using **Bun** is recommended:
```bash
bun install
# OR
npm install
# OR
yarn install
```

#### 3. Configure Environment Variables
Create a `.env` file in the project root and add your configuration details:

```bash
# LLM Configuration
VITE_LLAMA_API_URL="[Your-Llama-3.1-API-Endpoint]"
VITE_LLAMA_API_KEY="[Your-API-Key]"

# Backend/Data Configuration (Example)
# The application uses local data files for persistence and lookups.
```

#### 4. Run the Application

Run the **backend** and **frontend** separately.

**Start the Backend**
```bash
bun run start:backend
# OR
node backend/index.js
```

**Start the Frontend**
```bash
bun run dev
# OR
npm run dev
# OR
yarn dev
```


---

## 📜 License

Distributed under the **MIT License**.  
See `LICENSE.md` for more information.

---

### Made with 💙 by [IshaanBhatt23](https://github.com/IshaanBhatt23)
