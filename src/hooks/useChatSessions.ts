import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Message } from '@/components/MessageBubble'; // Make sure this path is correct

// This defines what a "ChatSession" looks like
export interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages: Message[];
  pinned?: boolean;
}

// This is our custom hook!
export const useChatSessions = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const initialized = useRef(false);

  // --- ✅ THIS IS THE MODIFIED PART ---
  // This part now loads saved chats and creates a new one on top for every app launch.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // First, create the new, empty session that will be active on every launch.
    const newSessionOnLoad: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
      pinned: false,
    };

    let previousSessions: ChatSession[] = [];
    try {
      // Then, try to load the old chats from memory.
      const saved = localStorage.getItem('chatSessions');
      if (saved) {
        previousSessions = JSON.parse(saved) as ChatSession[];
      }
    } catch (err) {
      console.error("Error loading chat sessions:", err);
      // If loading fails, we'll just have an empty history.
      previousSessions = [];
    }

    // Set the state: the new empty chat is first, followed by all the old ones.
    setSessions([newSessionOnLoad, ...previousSessions]);

    // IMPORTANT: Make the brand new chat the active one.
    setActiveSessionId(newSessionOnLoad.id);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // This effect should still only run once on mount.
  // --- END OF MODIFIED PART ---

  // --- This part saves chats to the browser's memory whenever they change ---
  useEffect(() => {
    // We check initialized to prevent wiping saved data on the very first render
    if (initialized.current) {
        if (sessions.length > 0) {
            // We save all but the first (active, empty) session if it has no messages
            const sessionsToSave = sessions[0]?.messages.length === 0 
                ? sessions.slice(1) 
                : sessions;
            
            if (sessionsToSave.length > 0) {
                localStorage.setItem('chatSessions', JSON.stringify(sessionsToSave));
            } else {
                localStorage.removeItem('chatSessions');
            }
        } else {
            localStorage.removeItem('chatSessions');
        }
    }
  }, [sessions]);


  // --- All of your functions from Index.tsx are moved here ---

  const handleNewChat = (showToast = true) => {
    const latestSession = sessions[0];
    if (latestSession && latestSession.messages.length === 0 && sessions.length > 0) {
      if (showToast) {
        toast({
          title: "Current chat is empty",
          description: "Please send a message before starting a new chat.",
        });
      }
      return latestSession;
    }

    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Conversation",
      timestamp: "Just now",
      messages: [],
      pinned: false,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (showToast) toast({ title: "New chat started" });
    return newSession;
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
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
      id: Date.now().toString(), title: "New Conversation", timestamp: "Just now", messages: [], pinned: false,
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

  const handleTogglePin = (id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
    );
  };
  
  const formatMessageForExport = (m: Message) => {
    if (m.data.type === "text") return m.data.content;
    if (m.data.type === "detail") return JSON.stringify(m.data.detailData, null, 2);
    if (m.data.type === "table" && m.data.tableData) return m.data.tableData.map((row) => JSON.stringify(row)).join("\n");
    return "[Unsupported message type]";
  };

  const handleExportSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    const formatted = [
      `🗒️ Chat Title: ${session.title}`,
      `🕒 Date: ${session.timestamp}`,
      "",
      ...session.messages.map(
        (m) => `[${m.timestamp}] ${m.role.toUpperCase()}:\n${formatMessageForExport(m)}`
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

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== sessionId) return s;
        
        const isFirstUserMessage = s.messages.length === 0 && message.role === 'user';
        const newTitle = isFirstUserMessage && message.data.type === 'text'
            ? message.data.content.substring(0, 35) 
            : s.title;

        return { ...s, title: newTitle, messages: [...s.messages, message] };
      })
    );
  };

  return {
    sessions,
    activeSession: sessions.find(s => s.id === activeSessionId),
    activeSessionId,
    handleNewChat,
    handleSelectSession,
    handleDeleteSession,
    handleClearAll,
    handleRenameSession,
    handleTogglePin,
    handleExportSession,
    addMessageToSession,
  };
};