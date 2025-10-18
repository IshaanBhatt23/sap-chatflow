import { useState, useEffect, useRef } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ✅ Added search state
  const [searchQuery, setSearchQuery] = useState("");

  // --- Load or initialize sessions ---
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions);
        if (parsedSessions.length > 0) {
          const latestSession = parsedSessions[0];
          if (latestSession && latestSession.messages.length === 0) {
            setSessions(parsedSessions);
            setActiveSessionId(latestSession.id);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Error loading chat sessions:", err);
    }

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
    setSearchQuery(""); // ✅ Clear search on new chat

    const latestSession = sessions[0];
    if (latestSession && latestSession.messages.length === 0 && sessions.length > 0) {
      if (showToast) {
        toast({
          title: "Current chat is empty",
          description: "Please send a message before starting a new chat.",
        });
      }
      return;
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
    };

    setSessions((prev) => (prev.length > 0 ? [newSession, ...prev] : [newSession]));
    setActiveSessionId(newSession.id);

    if (showToast) {
      toast({
        title: "New chat started",
        description: "Ready to help with your SAP queries",
      });
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== id);
    setSessions(updatedSessions);
    if (activeSessionId === id) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
      } else {
        handleNewChat(false);
      }
    }
    toast({ title: "Chat deleted", description: "This conversation has been removed." });
  };

  const handleClearAll = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
    };

    setSessions([newSession]);
    setActiveSessionId(newSession.id);

    toast({
      title: "All conversations cleared",
      description: "A new chat has been started for you.",
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

  const generateBotResponse = (userMessage: string): Message["data"] => {
    const msg = userMessage.toLowerCase();
    if (msg.includes("stock") || msg.includes("material")) {
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
    } else if (msg.includes("sales order") || msg.includes("open")) {
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
    } else if (msg.includes("leave") || msg.includes("request")) {
      return {
        type: "text",
        content:
          "I can help you create a leave request. Here's a draft for a 3-day leave starting tomorrow. Please review:",
        actions: [
          { label: "Approve & Submit", variant: "default", onClick: () => {} },
          { label: "Edit Dates", variant: "outline", onClick: () => {} },
          { label: "Cancel", variant: "destructive", onClick: () => {} },
        ],
      };
    } else if (msg.includes("purchase order")) {
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
    }
    return {
      type: "text",
      content:
        "I'm here to help with SAP queries — try asking about stock levels, sales orders, purchase orders, or leave requests.",
    };
  };

  const handleFileUpload = (file: File) =>
    toast({
      title: "File uploaded",
      description: `${file.name} processed.`,
    });

  const handlePromptClick = (prompt: string) => handleSendMessage(prompt);
  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // ✅ Filter sessions based on search query
  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "absolute top-0 left-0 h-full w-80 border-r border-border bg-background transition-transform duration-300 ease-in-out md:relative md:translate-x-0 z-20",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ChatHistory
          sessions={filteredSessions}
          activeSessionId={activeSessionId}
          searchQuery={searchQuery}             // ✅ Added
          onSearchChange={setSearchQuery}       // ✅ Added
          onNewChat={() => handleNewChat()}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onRenameSession={handleRenameSession}
        />
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
        />
      )}

      {/* Chat window */}
      <div className="flex-1 flex flex-col">
        <ChatWindow
          messages={activeSession?.messages || []}
          onPromptClick={handlePromptClick}
          isConnected={isConnected}
          isBotTyping={isBotTyping}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
        <ChatInput
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          activeSessionId={activeSessionId ?? undefined}
        />
      </div>
    </div>
  );
};

export default Index;
