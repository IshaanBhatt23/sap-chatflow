import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  MessageSquare,
  Trash2,
  Trash,
  Pencil,
  Search,
  Pin,
  Download,
} from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
  messages?: { role: string; content: string }[]; // for export
  pinned?: boolean; // NEW: pinned status
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void; // NEW
  onExportSession: (id: string) => void; // NEW
}

export const ChatHistory = ({
  sessions,
  activeSessionId,
  searchQuery,
  onSearchChange,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onClearAll,
  onRenameSession,
  onTogglePin,
  onExportSession,
}: ChatHistoryProps) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const handleStartEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleCancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleSaveRename = () => {
    if (editingSessionId && editingTitle.trim() !== "") {
      onRenameSession(editingSessionId, editingTitle.trim());
    }
    handleCancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSaveRename();
    else if (e.key === "Escape") handleCancelEditing();
  };

  // Sort pinned chats first, then by timestamp (latest first)
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="flex h-full flex-col bg-chat-sidebar">
      {/* Header */}
      <div className="border-b border-border/50 p-4 space-y-4">
        <Button
          onClick={onNewChat}
          className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/40" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-chat-sidebar-hover border-primary-foreground/20 pl-9 text-primary-foreground placeholder:text-primary-foreground/40"
          />
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 chat-scrollbar">
        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
            <MessageSquare className="h-12 w-12 text-primary-foreground/30 mb-4" />
            <p className="text-sm text-primary-foreground/60">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : "Your conversations will appear here"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {sortedSessions.map((session) => (
              <div key={session.id} className="relative group">
                <button
                  onClick={() =>
                    editingSessionId !== session.id && onSelectSession(session.id)
                  }
                  className={`w-full rounded-lg p-3 text-left transition-colors mb-1 flex items-start gap-2 ${
                    activeSessionId === session.id
                      ? "bg-chat-sidebar-hover text-primary-foreground"
                      : "text-primary-foreground/70 hover:bg-chat-sidebar-hover/50 hover:text-primary-foreground"
                  }`}
                >
                  <MessageSquare className="mt-1 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editingSessionId === session.id ? (
                      <Input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="h-7 text-sm bg-transparent border-primary-foreground/30 focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate flex items-center gap-1">
                          {session.title}
                          {session.pinned && (
                            <Pin className="h-3.5 w-3.5 text-yellow-400" />
                          )}
                        </p>
                      </div>
                    )}
                    <p className="text-xs opacity-60 mt-1">{session.timestamp}</p>
                  </div>
                </button>

                {/* Right-side action buttons */}
                {editingSessionId !== session.id && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 rounded-md">
                    {/* Rename */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditing(session);
                      }}
                      title="Rename chat"
                      className="p-1.5 rounded-md text-primary-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {/* Pin */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(session.id);
                      }}
                      title={session.pinned ? "Unpin chat" : "Pin chat"}
                      className={`p-1.5 rounded-md text-primary-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-400/20 hover:text-yellow-400 ${
                        session.pinned ? "text-yellow-400" : ""
                      }`}
                    >
                      <Pin className="h-4 w-4" />
                    </button>

                    {/* Export */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportSession(session.id);
                      }}
                      title="Export chat"
                      className="p-1.5 rounded-md text-primary-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          title="Delete chat"
                          className="p-1.5 rounded-md text-primary-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteSession(session.id)}
                          >
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Clear All */}
      {sessions.length > 0 && (
        <div className="border-t border-border/50 p-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full text-primary-foreground/60 hover:text-destructive"
              >
                <Trash className="mr-2 h-4 w-4" />
                Clear all conversations
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your conversations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearAll}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
};
