import { useState, useRef, useEffect } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message, MessageData } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChatSessions } from "@/hooks/useChatSessions";

const BACKEND_URL = "https://sap-assistant-backend.onrender.com";

const Index = () => {
  const { toast } = useToast();

  const {
    sessions,
    activeSession,
    activeSessionId,
    handleNewChat,
    handleSelectSession,
    handleDeleteSession,
    handleClearAll,
    handleRenameSession,
    handleTogglePin,
    handleExportSession,
    addMessageToSession,
  } = useChatSessions();

  const [isConnected] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = async (text: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentSessionId = activeSessionId;

    if (!currentSessionId) {
      const newSession = handleNewChat(false);
      currentSessionId = newSession.id;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      data: { type: "text", content: text },
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    addMessageToSession(currentSessionId, userMsg);
    setIsBotTyping(true);

    try {
      const messageHistory = activeSession?.messages
        .map(msg => ({
          sender: msg.role,
          text: (msg.data as { type?: string; content?: string })?.content ?? '',
        }))
        .concat([{ sender: 'user', text: text }])
         || [{ sender: 'user', text: text }];

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHistory }),
        signal: controller.signal,
      });

      if (!response.ok) {
         let errorMsg = `API error: ${response.statusText}`;
         try {
           const errorData = await response.json();
           errorMsg = errorData.error || errorMsg;
         } catch (e) { /* Ignore parsing error */ }
         throw new Error(errorMsg);
      }

      const botResponseData: MessageData = await response.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: botResponseData,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      addMessageToSession(currentSessionId, botMsg);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted by user action.');
        return;
      }

      console.error("Failed to get bot response:", error);
      toast({
        title: "Error",
        description: error.message || "Could not connect to the assistant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBotTyping(false);
       abortControllerRef.current = null;
    }
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    setIsBotTyping(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/submit-leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

       if (!response.ok) {
         let errorMsg = 'Form submission failed';
         try {
           const errorData = await response.json();
           errorMsg = errorData.error || errorMsg;
         } catch (e) { /* Ignore */ }
         throw new Error(errorMsg);
       }

      const confirmationData = await response.json();

      const confirmationMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: confirmationData,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      if (activeSessionId) {
        addMessageToSession(activeSessionId, confirmationMsg);
      }
    } catch (error: any) {
      console.error("Failed to submit form:", error);
      toast({
        title: "Error",
        description: error.message || "Could not submit the form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        console.log("Aborting fetch on cleanup");
      }
    };
  }, [activeSessionId]);

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
          sessions={sessions}
          activeSessionId={activeSessionId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewChat={() => handleNewChat(true)}
          onSelectSession={(id) => {
            handleSelectSession(id);
            setIsSidebarOpen(false);
          }}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onRenameSession={handleRenameSession}
          onTogglePin={handleTogglePin}
          onExportSession={handleExportSession}
        />
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
        />
      )}

      {/* Main chat area - FIXED STRUCTURE */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ChatWindow takes available space and scrolls internally */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatWindow
            messages={activeSession?.messages || []}
            onPromptClick={handleSendMessage}
            onFormSubmit={handleFormSubmit}
            isConnected={isConnected}
            isBotTyping={isBotTyping}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          />
        </div>
        
        {/* ChatInput is fixed at bottom */}
        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isBotTyping}
            activeSessionId={activeSessionId ?? undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;