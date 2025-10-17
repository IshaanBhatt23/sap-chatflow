import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, Trash } from "lucide-react"; // NEW: Import icons
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

// NEW: Add delete and clear functions to the props
interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

export const ChatHistory = ({
  sessions,
  activeSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession, // NEW
  onClearAll,      // NEW
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
              // NEW: Added a group class for hover effect
              <div key={session.id} className="relative group">
                <button
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full rounded-lg p-3 text-left transition-colors mb-1 flex items-start gap-2 ${
                    activeSessionId === session.id
                      ? "bg-chat-sidebar-hover text-primary-foreground"
                      : "text-primary-foreground/70 hover:bg-chat-sidebar-hover/50 hover:text-primary-foreground"
                  }`}
                >
                  <MessageSquare className="mt-1 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs opacity-60 mt-1">{session.timestamp}</p>
                  </div>
                </button>
                {/* NEW: Delete button that appears on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent the session from being selected
                    onDeleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* NEW: Footer with Clear All button */}
      {sessions.length > 0 && (
        <div className="border-t border-border/50 p-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-primary-foreground/60 hover:text-destructive">
                  <Trash className="mr-2 h-4 w-4" />
                  Clear all conversations
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your conversations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearAll}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      )}
    </div>
  );
};