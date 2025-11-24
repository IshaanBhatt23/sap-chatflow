import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTableCard } from "./DataTableCard";
import { DetailCard } from "./DetailCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface MessageBubbleProps {
  message: Message;
  onFormSubmit?: (formData: Record<string, any>) => void;
}

// 🔹 Helper: clean leading/trailing quotes from AI text
const cleanText = (text: string | undefined | null) => {
  if (!text) return "";
  let t = text.trim();

  // If wrapped in matching straight quotes "..." or '...'
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  // Extra safety: strip any leading/trailing unicode/straight quotes
  t = t
    .replace(/^[“”"'`]+/, "") // start
    .replace(/[“”"'`]+$/, "") // end
    .trim();

  return t;
};

const LeaveApplicationForm = ({ onSubmit }: { onSubmit?: (data: any) => void }) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    employeeName: "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [error, setError] = useState<string | null>(null);

  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = String(todayDate.getMonth() + 1).padStart(2, "0");
  const day = String(todayDate.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setError("Start date cannot be after the end date.");
      return;
    }

    if (onSubmit) {
      setError(null);
      onSubmit(formData);
      setIsSubmitted(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1">
      <h3 className="font-semibold text-lg">Leave Application</h3>
      <div className="space-y-2">
        <Label htmlFor="employeeName">Employee Name</Label>
        <Input
          id="employeeName"
          name="employeeName"
          value={formData.employeeName}
          onChange={handleChange}
          disabled={isSubmitted}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            min={today}
            value={formData.startDate}
            onChange={handleChange}
            disabled={isSubmitted}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            min={formData.startDate || today}
            value={formData.endDate}
            onChange={handleChange}
            disabled={isSubmitted}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-2">
        <Label htmlFor="reason">Reason for Leave</Label>
        <Textarea
          id="reason"
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          disabled={isSubmitted}
          required
        />
      </div>

      {!isSubmitted && (
        <Button type="submit" className="w-full mt-2">
          Submit Application
        </Button>
      )}
    </form>
  );
};

export interface MessageAction {
  label: string;
  variant?: "default" | "destructive" | "outline";
  onClick: () => void;
}

export interface MessageData {
  type: "text" | "table" | "detail" | "leave_application_form";
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

export const MessageBubble = ({ message, onFormSubmit }: MessageBubbleProps) => {
  const isUser = message.role === "user";
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = cleanText(message.data.content || "");
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
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "group relative flex w-full mb-4 items-end",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {isUser && message.data.type === "text" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity mr-2 flex-shrink-0"
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
          "relative max-w-[80%] rounded-lg px-4 pt-3 pb-2 break-words",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-card-foreground"
        )}
      >
        {message.data.type === "leave_application_form" && (
          <LeaveApplicationForm onSubmit={onFormSubmit} />
        )}

        {message.data.type === "text" && message.data.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{cleanText(message.data.content)}</ReactMarkdown>
          </div>
        )}

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

        <div className="flex items-center justify-end mt-2 h-5">
          <p className="text-xs opacity-60">{message.timestamp}</p>
        </div>
      </div>

      {/* Assistant copy button on the right */}
      {!isUser && message.data.type === "text" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
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
