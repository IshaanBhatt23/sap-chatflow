import { cn } from "@/lib/utils";
import { DataTableCard } from "./DataTableCard";
import { DetailCard } from "./DetailCard";
import { Button } from "@/components/ui/button";

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

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
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

        {/* Timestamp */}
        <p className={cn("text-xs mt-2 opacity-60")}>
          {message.timestamp}
        </p>
      </div>
    </div>
  );
};
