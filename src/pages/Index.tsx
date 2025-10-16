import { useState } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

const Index = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected] = useState(true);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    toast({
      title: "New chat started",
      description: "Ready to help with your SAP queries",
    });
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    // In a real app, load messages for this session
    setMessages([]);
  };

  const handleSendMessage = (messageText: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      data: {
        type: "text",
        content: messageText,
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: generateBotResponse(messageText),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  const generateBotResponse = (userMessage: string): Message["data"] => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("stock") || lowerMessage.includes("material")) {
      return {
        type: "detail",
        detailData: {
          "Material": "M-01",
          "Description": "Industrial Pump",
          "Plant": "1000",
          "Stock Level": "245 units",
          "Storage Location": "Warehouse A",
          "Last Updated": "Today, 10:30 AM",
        },
      };
    } else if (lowerMessage.includes("sales order") || lowerMessage.includes("open")) {
      return {
        type: "table",
        tableColumns: ["Order #", "Customer", "Amount", "Status"],
        tableData: [
          { "Order #": "5021", "Customer": "TechCorp Inc.", "Amount": "$15,420", "Status": "Processing" },
          { "Order #": "5022", "Customer": "Global Systems", "Amount": "$28,100", "Status": "Pending" },
          { "Order #": "5023", "Customer": "Innovate Ltd.", "Amount": "$9,870", "Status": "Approved" },
        ],
      };
    } else if (lowerMessage.includes("leave") || lowerMessage.includes("request")) {
      return {
        type: "text",
        content: "I can help you create a leave request. I've prepared a draft for a 3-day leave starting tomorrow. Please review and confirm:",
        actions: [
          { label: "Approve & Submit", variant: "default", onClick: () => {} },
          { label: "Edit Dates", variant: "outline", onClick: () => {} },
          { label: "Cancel", variant: "destructive", onClick: () => {} },
        ],
      };
    } else if (lowerMessage.includes("purchase order")) {
      return {
        type: "detail",
        detailData: {
          "PO Number": "4500017123",
          "Vendor": "Siemens AG",
          "Created Date": "2025-01-10",
          "Total Amount": "$42,500",
          "Status": "Approved",
          "Delivery Date": "2025-01-20",
        },
      };
    } else {
      return {
        type: "text",
        content: "I'm here to help with SAP queries. You can ask me about stock levels, sales orders, purchase orders, leave requests, and more.",
      };
    }
  };

  const handleFileUpload = (file: File) => {
    toast({
      title: "File uploaded",
      description: `${file.name} has been processed`,
    });
  };

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left Panel - Chat History */}
      <div className="w-80 border-r border-border flex-shrink-0">
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
        />
      </div>

      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col">
        <ChatWindow
          messages={messages}
          onPromptClick={handlePromptClick}
          isConnected={isConnected}
        />
        <ChatInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
        />
      </div>
    </div>
  );
};

export default Index;
