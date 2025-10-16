import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
}

export const ChatHistory = ({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
}: ChatHistoryProps) => {
  return (
    <div className="flex h-full flex-col bg-chat-sidebar">
      {/* Header */}
      <div className="border-b border-border/50 p-4">
        <Button
          onClick={onNewChat}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List or Empty State */}
      <ScrollArea className="flex-1 chat-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <MessageSquare className="h-12 w-12 text-primary-foreground/30 mb-4" />
            <p className="text-sm text-primary-foreground/60 text-center">
              Your conversations will appear here
            </p>
          </div>
        ) : (
          <div className="p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`w-full rounded-lg p-3 text-left transition-colors mb-1 ${
                  activeSessionId === session.id
                    ? "bg-chat-sidebar-hover text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-chat-sidebar-hover/50 hover:text-primary-foreground"
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-1 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs opacity-60 mt-1">{session.timestamp}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
