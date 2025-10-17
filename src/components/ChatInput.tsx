import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Paperclip } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onFileUpload: (file: File) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, onFileUpload, disabled }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔹 Focus when component mounts (only happens when a new chat is created)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
      inputRef.current?.focus(); // Keep focus after sending
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
    <div className="border-t border-border bg-background px-4 py-6 sm:py-8">
      <div className="relative flex items-center gap-4">
        <label htmlFor="file-upload" className="cursor-pointer">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => document.getElementById("file-upload")?.click()}
            className="h-14 w-14 flex-shrink-0"
          >
            <Paperclip className="h-7 w-7 text-muted-foreground" />
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
          className="flex-1 h-16 rounded-full bg-muted px-7 text-xl"
        />

        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          className="bg-accent hover:bg-accent/90 h-14 w-14 flex-shrink-0 rounded-full"
        >
          <Send className="h-7 w-7" />
        </Button>
      </div>
    </div>
  );
};
