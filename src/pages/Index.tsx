import { useState, useRef, useEffect } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message, MessageData } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChatSessions } from "@/hooks/useChatSessions";

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
      const messageHistory = activeSession?.messages.map(msg => ({
        sender: msg.role,
        text: (msg.data as { type: 'text'; content: string }).content,
      })) || [];
      messageHistory.push({ sender: 'user', text: text });
      
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHistory }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      const botResponseData: MessageData = await response.json();

      // --- 👇 THIS IS THE UPGRADE ---
      // The backend now sends the full data object, which we can use directly.
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: botResponseData, // Use the data directly (could be text or a form type)
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      // --- END OF UPGRADE ---

      addMessageToSession(currentSessionId, botMsg);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted by user action.');
        return;
      }

      console.error("Failed to get bot response:", error);
      toast({
        title: "Error",
        description: "Could not connect to the assistant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  // --- 👇 A NEW FUNCTION TO HANDLE THE FORM SUBMISSION ---
  const handleFormSubmit = async (formData: Record<string, any>) => {
    setIsBotTyping(true);
    try {
      const response = await fetch('http://localhost:3001/api/submit-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Form submission failed');

      const confirmationData = await response.json();

      const confirmationMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: confirmationData, // Expects a { type: 'text', content: '...' } response
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      
      if (activeSessionId) {
        addMessageToSession(activeSessionId, confirmationMsg);
      }
    } catch (error) {
      console.error("Failed to submit form:", error);
      toast({
        title: "Error",
        description: "Could not submit the form. Please try again.",
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
      }
    };
  }, [activeSessionId]);

  const handleFileUpload = (file: File) =>
    toast({ title: "File uploaded", description: `${file.name} processed.` });

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

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-10 md:hidden"
        />
      )}

      <div className="flex-1 flex flex-col">
        {/* --- 👇 WE PASS THE NEW SUBMIT FUNCTION TO THE CHAT WINDOW --- */}
        <ChatWindow
          messages={activeSession?.messages || []}
          onPromptClick={handleSendMessage}
          onFormSubmit={handleFormSubmit}
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
