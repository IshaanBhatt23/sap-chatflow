import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble, Message } from "./MessageBubble";
import { WelcomeScreen } from "./WelcomeScreen";
import { Badge } from "@/components/ui/badge";

interface ChatWindowProps {
  messages: Message[];
  onPromptClick: (prompt: string) => void;
  isConnected: boolean;
}

export const ChatWindow = ({ messages, onPromptClick, isConnected }: ChatWindowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-primary">SAP Assistant</h2>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={isConnected ? "bg-success hover:bg-success" : ""}
          >
            <span className="mr-2">●</span>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 chat-scrollbar" ref={scrollRef}>
        <div className="px-6 py-4">
          {messages.length === 0 ? (
            <WelcomeScreen onPromptClick={onPromptClick} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
