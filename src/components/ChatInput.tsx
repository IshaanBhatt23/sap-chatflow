import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
  activeSessionId?: string;
}

export const ChatInput = ({
  onSendMessage,
  onFileUpload,
  disabled,
  activeSessionId,
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      e.target.value = "";
    }
  };

  return (
    // --- MODIFIED: Reduced vertical padding on mobile (py-3) ---
    <div className="border-t border-border bg-background px-4 py-3 md:py-8">
      {/* --- MODIFIED: Reduced gap on mobile (gap-2) --- */}
      <div className="relative flex items-center gap-2 md:gap-4">
        <label htmlFor="file-upload" className="cursor-pointer">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => document.getElementById("file-upload")?.click()}
            // --- MODIFIED: Smaller button on mobile ---
            className="h-10 w-10 md:h-14 md:w-14 flex-shrink-0"
          >
            {/* --- MODIFIED: Smaller icon on mobile --- */}
            <Paperclip className="h-5 w-5 md:h-7 md:w-7 text-muted-foreground" />
          </Button>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".csv,.xlsx,.xls,.txt"
          />
        </label>

        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about anything in SAP..."
          disabled={disabled}
          // --- MODIFIED: Smaller height, padding, text, and radius on mobile ---
          className="flex-1 h-12 md:h-16 rounded-lg md:rounded-full bg-muted px-4 md:px-7 text-base md:text-xl"
        />

        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          // --- MODIFIED: Smaller button on mobile ---
          className="bg-accent hover:bg-accent/90 h-10 w-10 md:h-14 md:w-14 flex-shrink-0 rounded-full"
        >
          {/* --- MODIFIED: Smaller icon on mobile --- */}
          <Send className="h-5 w-5 md:h-7 md:w-7" />
        </Button>
      </div>
    </div>
  );
};