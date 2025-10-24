💬 Sap-chatflow: The AI-Powered SAP Assistant

Sap-chatflow is an innovative conversational AI application designed to simplify complex interactions with Enterprise Resource Planning (ERP) systems, specifically focusing on SAP operations and terminology. By leveraging a modern Large Language Model (LLM) and a Retrieval-Augmented Generation (RAG) architecture, it transforms rigid SAP workflows into intuitive chat commands.

✨ Features

Sap-chatflow functions as a highly effective digital assistant, providing both informational retrieval and direct action capabilities within the chat interface.

1. Contextual Information Retrieval (RAG)

SAP Terminology: Instantly provides clear, layman definitions and explanations for complex SAP transaction codes (e.g., FB60) and process terminology, sourced from the dedicated knowledge base.

Knowledge Base: Utilizes a dedicated external knowledge base for grounded responses, ensuring accuracy and relevance to the SAP domain.

2. Dynamic Data Lookups

Users can query real-time operational data, which the chatbot retrieves from the backend's persistent storage and displays in easily readable, formatted tables directly in the chat window.

Inventory Status: Check current Stock Levels for specific materials.

Procurement: View lists of active Purchase Orders (POs).

Sales: Retrieve delivered or open Sales Orders (SOs).

3. Interactive Workflow Automation

The application can dynamically generate fillable forms within the chat for routine administrative tasks.

Leave Application: Upon request, the model generates a structured form, which is processed by the backend.

Data Submission: Completed forms are processed and stored in the backend's persistent storage (via the backend's data handling logic).

💻 Technology Stack

Sap-chatflow is built on a robust and scalable stack designed for performance and maintainability.

Category

Technology

Purpose

Frontend

TypeScript / React (Vite)

Modern, responsive chat interface and UI components (in ./src/components/).

Backend

Node.js (via index.js)

Handles API calls to the LLM and manages RAG logic and data persistence.

LLM

Llama 3.1

The core generative model for user intent and response formulation.

Architecture

Retrieval-Augmented Generation (RAG)

Grounds LLM responses using domain-specific data from local data files.

Package Manager

Bun / npm

Used for dependency management and running the application.

Data Storage

Local Persistent Storage

Used for the SAP knowledge base and simulating ERP transactional data persistence.

🛠️ Setup and Installation

Follow these steps to get a local copy of Sap-chatflow running.

Prerequisites

Node.js (LTS version)

Bun (Recommended) or npm/yarn

Access to the Llama 3.1 API endpoint or a locally run instance (e.g., via Ollama or similar inference engine).

Installation Steps

Clone the Repository:

git clone [https://github.com/IshaanBhatt23/sap-chatflow](https://github.com/IshaanBhatt23/sap-chatflow)
cd sap-chatflow


Install Dependencies:
Since the repository uses bun.lockb, using Bun is recommended:

bun install
# OR, if using npm/yarn:
# npm install
# yarn install


Configure Environment Variables:
Create a .env file in the project root and add your configuration details.

# LLM Configuration
VITE_LLAMA_API_URL="[Your-Llama-3.1-API-Endpoint]"
VITE_LLAMA_API_KEY="[Your-API-Key]"

# Backend/Data Configuration (Example)
# The application uses local data files for persistence and lookups.


Run the Application:
You will need to run the backend and frontend separately.

Start the Backend:

bun run start:backend
# OR (if using node):
# node backend/index.js


Start the Frontend:

bun run dev
# OR (if using npm/yarn):
# npm run dev
# yarn dev


The frontend (chat application) will typically be available at http://localhost:3000.

📜 License

Distributed under the MIT License. See LICENSE.md for more information.

Made with 💙 by IshaanBhatt23
