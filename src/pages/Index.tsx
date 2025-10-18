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
  pinned?: boolean;
}

const Index = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isConnected] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const initialized = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Load or initialize sessions ---
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const savedSessions = localStorage.getItem("chatSessions");
      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) setActiveSessionId(parsedSessions[0].id);
        return;
      }
    } catch (err) {
      console.error("Error loading chat sessions:", err);
    }

    handleNewChat(false);
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
      pinned: false,
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

  // --- Select, delete, clear, rename handlers ---
  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    if (activeSessionId === id) {
      if (updated.length > 0) setActiveSessionId(updated[0].id);
      else handleNewChat(false);
    }
    toast({ title: "Chat deleted", description: "Conversation removed." });
  };

  const handleClearAll = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
      pinned: false,
    };
    setSessions([newSession]);
    setActiveSessionId(newSession.id);
    toast({ title: "All conversations cleared", description: "Started fresh." });
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    toast({ title: "Chat renamed", description: `Renamed to "${newTitle}".` });
  };

  // --- ✅ Toggle Pin / Unpin ---
  const handleTogglePin = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, pinned: !s.pinned };
          toast({
            title: updated.pinned ? "Chat pinned" : "Chat unpinned",
            description: updated.pinned
              ? "Pinned to the top of your list."
              : "Removed from top of list.",
          });
          return updated;
        }
        return s;
      })
    );
  };

  // --- ✅ Export Chat ---
  const handleExportSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    const formatted = [
      `🗒️ Chat Title: ${session.title}`,
      `🕒 Date: ${session.timestamp}`,
      "",
      ...session.messages.map(
        (m) => `[${m.timestamp}] ${m.role.toUpperCase()}:\n${formatMessage(m)}`
      ),
    ].join("\n\n");

    const blob = new Blob([formatted], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({ title: "Chat exported", description: `Saved as ${session.title}.txt` });
  };

  const formatMessage = (m: Message) => {
    if (m.data.type === "text") return m.data.content;
    if (m.data.type === "detail") return JSON.stringify(m.data.detailData, null, 2);
    if (m.data.type === "table") return m.data.tableData.map((row) => JSON.stringify(row)).join("\n");
    return "[Unsupported message type]";
  };

  // --- Send message logic ---
  const handleSendMessage = (text: string) => {
    if (!activeSessionId) {
      handleNewChat(false);
      return setTimeout(() => handleSendMessage(text), 50);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      data: { type: "text", content: text },
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              title: s.messages.length < 1 ? text.substring(0, 35) : s.title,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    setIsBotTyping(true);
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: generateBotResponse(text),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, messages: [...s.messages, botMsg] } : s
        )
      );
      setIsBotTyping(false);
    }, 800);
  };

  const generateBotResponse = (msg: string): Message["data"] => {
    const text = msg.toLowerCase();
    if (text.includes("stock"))
      return {
        type: "detail",
        detailData: {
          Material: "M-01",
          Description: "Industrial Pump",
          Plant: "1000",
          "Stock Level": "245 units",
          "Storage Location": "Warehouse A",
        },
      };
    if (text.includes("sales"))
      return {
        type: "table",
        tableColumns: ["Order #", "Customer", "Amount", "Status"],
        tableData: [
          { "Order #": "5021", Customer: "TechCorp", Amount: "$15,420", Status: "Processing" },
          { "Order #": "5022", Customer: "Global Systems", Amount: "$28,100", Status: "Pending" },
        ],
      };
    return { type: "text", content: "Ask about stock, sales, or purchase orders." };
  };

  const handleFileUpload = (file: File) =>
    toast({ title: "File uploaded", description: `${file.name} processed.` });

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <div
        className={cn(
          "absolute top-0 left-0 h-full w-80 border-r border-border bg-background transition-transform duration-300 ease-in-out md:relative md:translate-x-0 z-20",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ChatHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onRenameSession={handleRenameSession}
          onTogglePin={handleTogglePin}       // ✅ fixed prop name
          onExportSession={handleExportSession}
        />
      </div>

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
        />
      )}

      <div className="flex-1 flex flex-col">
        <ChatWindow
          messages={activeSession?.messages || []}
          onPromptClick={handleSendMessage}
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
