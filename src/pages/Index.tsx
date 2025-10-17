import { useState, useEffect } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
}

const Index = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isConnected] = useState(true);

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (parsedSessions.length > 0) {
          setSessions(parsedSessions);
          setActiveSessionId(parsedSessions[0].id);
        } else {
          handleNewChat();
        }
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to load chat sessions from localStorage:", error);
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save chats to localStorage whenever sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("chatSessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("chatSessions"); // Clear when sessions empty
    }
  }, [sessions]);

  // Start a new chat session
  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
    };
    setSessions((prevSessions) => [newSession, ...prevSessions]);
    setActiveSessionId(newSession.id);
    toast({
      title: "New chat started",
      description: "Ready to help with your SAP queries",
    });
  };

  // Select an existing chat session
  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  // Delete a specific chat session
  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
    toast({
      title: "Chat deleted",
      description: "This conversation has been removed.",
    });
  };

  // Clear all chat sessions
  const handleClearAll = () => {
    setSessions([]);
    setActiveSessionId(null);
    localStorage.removeItem("chatSessions");
    toast({
      title: "All conversations cleared",
      description: "Your chat history has been deleted.",
    });
  };

  // Send a message and simulate a bot response
  const handleSendMessage = (messageText: string) => {
    if (!activeSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      data: {
        type: "text",
        content: messageText,
      },
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Update current session with user's message
    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              title:
                session.messages.length === 0
                  ? messageText.substring(0, 35)
                  : session.title,
              messages: [...session.messages, userMessage],
            }
          : session
      )
    );

    // Simulate bot reply
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: generateBotResponse(messageText),
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === activeSessionId
            ? { ...session, messages: [...session.messages, botMessage] }
            : session
        )
      );
    }, 1000);
  };

  // Simple rule-based bot
  const generateBotResponse = (userMessage: string): Message["data"] => {
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes("stock") || lowerMessage.includes("material")) {
      return {
        type: "detail",
        detailData: {
          Material: "M-01",
          Description: "Industrial Pump",
          Plant: "1000",
          "Stock Level": "245 units",
          "Storage Location": "Warehouse A",
          "Last Updated": "Today, 10:30 AM",
        },
      };
    } else if (
      lowerMessage.includes("sales order") ||
      lowerMessage.includes("open")
    ) {
      return {
        type: "table",
        tableColumns: ["Order #", "Customer", "Amount", "Status"],
        tableData: [
          {
            "Order #": "5021",
            Customer: "TechCorp Inc.",
            Amount: "$15,420",
            Status: "Processing",
          },
          {
            "Order #": "5022",
            Customer: "Global Systems",
            Amount: "$28,100",
            Status: "Pending",
          },
          {
            "Order #": "5023",
            Customer: "Innovate Ltd.",
            Amount: "$9,870",
            Status: "Approved",
          },
        ],
      };
    } else if (
      lowerMessage.includes("leave") ||
      lowerMessage.includes("request")
    ) {
      return {
        type: "text",
        content:
          "I can help you create a leave request. I've prepared a draft for a 3-day leave starting tomorrow. Please review and confirm:",
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
          Vendor: "Siemens AG",
          "Created Date": "2025-01-10",
          "Total Amount": "$42,500",
          Status: "Approved",
          "Delivery Date": "2025-01-20",
        },
      };
    } else {
      return {
        type: "text",
        content:
          "I'm here to help with SAP queries. You can ask me about stock levels, sales orders, purchase orders, leave requests, and more.",
      };
    }
  };

  // File upload handler
  const handleFileUpload = (file: File) => {
    toast({
      title: "File uploaded",
      description: `${file.name} has been processed`,
    });
  };

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  // Get current active chat
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="w-80 border-r border-border flex-shrink-0">
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll} // ✅ Added here
        />
      </div>

      <div className="flex-1 flex flex-col">
        <ChatWindow
          messages={activeSession?.messages || []}
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
