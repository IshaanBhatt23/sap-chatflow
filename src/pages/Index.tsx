import { useState } from "react";
import { ChatHistory } from "@/components/ChatHistory";
import { ChatWindow } from "@/components/ChatWindow";
import { ChatInput } from "@/components/ChatInput";
import { Message } from "@/components/MessageBubble";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useChatSessions } from "@/hooks/useChatSessions"; // 👈 STEP 1: Import our new hook

const Index = () => {
  const { toast } = useToast();
  
  // 👇 STEP 2: All the complex session logic is replaced by this single line!
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

  // We only need to keep the state that is purely for the UI
  const [isConnected] = useState(true);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- 👇 STEP 3: The new, async function to call the AI backend ---
  const handleSendMessage = async (text: string) => {
    let currentSessionId = activeSessionId;

    // If there's no active session, our hook handles creating one
    if (!currentSessionId) {
      const newSession = handleNewChat(false);
      currentSessionId = newSession.id;
    }
    
    // Create the user message object
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      data: { type: "text", content: text },
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Add user message to the UI immediately
    addMessageToSession(currentSessionId, userMsg);
    setIsBotTyping(true);

    try {
      // Prepare the history for the API. We get the latest messages from the 'activeSession' object.
      const messageHistory = activeSession?.messages.map(msg => ({
        sender: msg.role,
        text: (msg.data as { type: 'text'; content: string }).content,
      })) || [];
      // Add the new user message to the history we're sending
      messageHistory.push({ sender: 'user', text: text });
      
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHistory }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const botResponseData = await response.json(); // e.g., { role: 'assistant', content: '...' }

      // Create the bot message object
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        data: { type: "text", content: botResponseData.content }, // Get content from the real API response
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      // Add the bot's response to the UI
      addMessageToSession(currentSessionId, botMsg);

    } catch (error) {
      console.error("Failed to get bot response:", error);
      toast({
        title: "Error",
        description: "Could not connect to the assistant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBotTyping(false); // Stop the typing indicator whether it succeeds or fails
    }
  };

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