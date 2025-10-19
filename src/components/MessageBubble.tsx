import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTableCard } from "./DataTableCard";
import { DetailCard } from "./DetailCard";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown"; // 👈 STEP 1: Import the new tool

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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("group relative flex w-full mb-4 items-end", isUser ? "justify-end" : "justify-start")}
    >
      {isUser && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity mr-2"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 pt-3 pb-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-card-foreground"
        )}
      >
        {/* --- 👇 THIS IS THE UPGRADE --- */}
        {message.data.type === "text" && message.data.content && (
          // We wrap the content in ReactMarkdown. It handles the rest!
          // The 'prose' classes give it nice default styling for lists, bold, etc.
          <div className="prose prose-sm dark:prose-invert max-w-none">
             <ReactMarkdown>{message.data.content}</ReactMarkdown>
          </div>
        )}
        {/* --- END OF UPGRADE --- */}

        {message.data.type === "table" &&
          message.data.tableData &&
          message.data.tableColumns && (
            <DataTableCard
              data={message.data.tableData}
              columns={message.data.tableColumns}
            />
          )}

        {message.data.type === "detail" && message.data.detailData && (
          <DetailCard data={message.data.detailData} />
        )}

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

      {!isUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ml-2"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
      )}
    </motion.div>
  );
};