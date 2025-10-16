import { useState } from "react";
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

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage("");
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
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-center gap-2 max-w-4xl mx-auto">
        <label htmlFor="file-upload" className="cursor-pointer">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            onClick={() => document.getElementById("file-upload")?.click()}
          >
            <Paperclip className="h-4 w-4" />
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about anything in SAP..."
          disabled={disabled}
          className="flex-1"
        />

        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          size="icon"
          className="bg-accent hover:bg-accent/90"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
