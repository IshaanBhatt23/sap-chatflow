import { useState, useEffect, useRef } from "react";
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
  const [isBotTyping, setIsBotTyping] = useState(false);
  const initialized = useRef(false);

  // --- Load from localStorage or auto-start chat ---
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      }
    } catch (err) {
      console.error("Error loading chat sessions:", err);
    }

    // If no saved sessions, create the very first chat
    handleNewChat(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Persist sessions ---
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("chatSessions", JSON.stringify(sessions));
    } else {
      localStorage.removeItem("chatSessions");
    }
  }, [sessions]);

  // --- Create new chat session ---
  const handleNewChat = (showToast: boolean = true) => {
    // Check if the most recent session is empty
    const latestSession = sessions[0];
    if (latestSession && latestSession.messages.length === 0) {
      // MODIFIED: The toast notification has been removed, but the logic remains.
      return; // Stop the function from creating a new chat
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);

    if (showToast) {
       toast({
         title: "New chat started",
         description: "Ready to help with your SAP queries",
       });
    }
  };

  const handleSelectSession = (id: string) => setActiveSessionId(id);

  // MODIFIED: Ensures app remains usable after deleting the last chat
  const handleDeleteSession = (id: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== id);
    setSessions(updatedSessions);

    if (activeSessionId === id) {
      if (updatedSessions.length > 0) {
        // If other chats exist, make the first one active
        setActiveSessionId(updatedSessions[0].id);
      } else {
        // If no chats are left, create a new one
        handleNewChat(false);
      }
    }
    toast({
      title: "Chat deleted",
      description: "This conversation has been removed.",
    });
  };

  // MODIFIED: Ensures app remains usable after clearing all
  const handleClearAll = () => {
    setSessions([]);
    // Immediately create a new chat to ensure there's always an active session
    handleNewChat(false);
    toast({
      title: "All conversations cleared",
      description: "Your chat history has been deleted.",
    });
  };
  
  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === id ? { ...session, title: newTitle } : session
      )
    );
    toast({
      title: "Chat renamed",
      description: `Conversation has been renamed to "${newTitle}".`,
    });
  };

  // --- Send Message ---
  const handleSendMessage = (messageText: string) => {
    if (!activeSessionId) {
      handleNewChat(false);
      return setTimeout(() => handleSendMessage(messageText), 50);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      data: { type: "text", content: messageText },
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title:
                s.messages.length < 1
                  ? messageText.substring(0, 35)
                  : s.title,
              messages: [...s.messages, userMessage],
            }
          : s
      )
    );

    setIsBotTyping(true);

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

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, botMessage] }
            : s
        )
      );
      setIsBotTyping(false);
    }, 800);
  };

  // --- Bot Logic ---
  const generateBotResponse = (userMessage: string): Message["data"] => {
    const msg = userMessage.toLowerCase();
    if (msg.includes("stock") || msg.includes("material")) {
      return { type: "detail", detailData: { Material: "M-01", Description: "Industrial Pump", Plant: "1000", "Stock Level": "245 units", "Storage Location": "Warehouse A", "Last Updated": "Today, 10:30 AM" } };
    } else if (msg.includes("sales order") || msg.includes("open")) {
      return { type: "table", tableColumns: ["Order #", "Customer", "Amount", "Status"], tableData: [{ "Order #": "5021", Customer: "TechCorp Inc.", Amount: "$15,420", Status: "Processing" }, { "Order #": "5022", Customer: "Global Systems", Amount: "$28,100", Status: "Pending" }, { "Order #": "5023", Customer: "Innovate Ltd.", Amount: "$9,870", Status: "Approved" }] };
    } else if (msg.includes("leave") || msg.includes("request")) {
      return { type: "text", content: "I can help you create a leave request. Here's a draft for a 3-day leave starting tomorrow. Please review:", actions: [{ label: "Approve & Submit", variant: "default", onClick: () => {} }, { label: "Edit Dates", variant: "outline", onClick: () => {} }, { label: "Cancel", variant: "destructive", onClick: () => {} }] };
    } else if (msg.includes("purchase order")) {
      return { type: "detail", detailData: { "PO Number": "4500017123", Vendor: "Siemens AG", "Created Date": "2025-01-10", "Total Amount": "$42,500", Status: "Approved", "Delivery Date": "2025-01-20" } };
    }
    return { type: "text", content: "I'm here to help with SAP queries — try asking about stock levels, sales orders, purchase orders, or leave requests." };
  };

  const handleFileUpload = (file: File) =>
    toast({ title: "File uploaded", description: `${file.name} processed.` });

  const handlePromptClick = (prompt: string) => handleSendMessage(prompt);
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="w-80 border-r border-border flex-shrink-0">
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewChat={() => handleNewChat()}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onRenameSession={handleRenameSession}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <ChatWindow
          messages={activeSession?.messages || []}
          onPromptClick={handlePromptClick}
          isConnected={isConnected}
          isBotTyping={isBotTyping}
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