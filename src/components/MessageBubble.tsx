import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTableCard } from "./DataTableCard";
import { DetailCard } from "./DetailCard";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface MessageAction {
  label: string;
  variant?: "default" | "destructive" | "outline";
  onClick: () => void;
}

export interface MessageData {
  type: "text" | "table" | "detail";
  content?: string;
  tableData?: Array<Record<string, string | number>>;
  tableColumns?: string[];
  detailData?: Record<string, string | number>;
  actions?: MessageAction[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  data: MessageData;
  timestamp: string;
}

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    let textToCopy = "";
    switch (message.data.type) {
      case "text":
        textToCopy = message.data.content || "";
        break;
      case "detail":
        textToCopy = Object.entries(message.data.detailData || {})
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        break;
      case "table":
        const headers = message.data.tableColumns?.join("\t|\t") || "";
        const rows =
          message.data.tableData
            ?.map((row) =>
              message.data.tableColumns?.map((col) => row[col]).join("\t|\t")
            )
            .join("\n") || "";
        textToCopy = `${headers}\n${"-".repeat(headers.length * 1.5)}\n${rows}`;
        break;
      default:
        break;
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        toast({ title: "Copied to clipboard!" });
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    // MODIFIED: This container is now the relative group for positioning
    <div className={cn("group relative flex w-full mb-4 items-end", isUser ? "justify-end" : "justify-start")}>
      {/* MODIFIED: For user messages, the button comes first visually */}
      {isUser && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity mr-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}

      {/* The message bubble itself */}
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 pt-3 pb-2",
          isUser
            ? "bg-chat-user text-accent-foreground"
            : "bg-chat-bot text-card-foreground"
        )}
      >
        {/* Text Content */}
        {message.data.type === "text" && message.data.content && (
          <p className="text-sm whitespace-pre-wrap">{message.data.content}</p>
        )}

        {/* Table Data */}
        {message.data.type === "table" &&
          message.data.tableData &&
          message.data.tableColumns && (
            <DataTableCard
              data={message.data.tableData}
              columns={message.data.tableColumns}
            />
          )}

        {/* Detail Card */}
        {message.data.type === "detail" && message.data.detailData && (
          <DetailCard data={message.data.detailData} />
        )}

        {/* Actions */}
        {message.data.actions && message.data.actions.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {message.data.actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "outline"}
                size="sm"
                onClick={action.onClick}
                className="text-xs"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end mt-2 h-5">
          <div className="flex-grow flex items-center">
            <p className={cn("text-xs opacity-60")}>
              {message.timestamp}
            </p>
          </div>
        </div>
      </div>

      {/* MODIFIED: For bot messages, the button comes after visually */}
      {!isUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
      )}
    </div>
  );
};