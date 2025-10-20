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

const LeaveApplicationForm = ({ onSubmit }: { onSubmit: (data: any) => void }) => {
    const [formData, setFormData] = useState({
        employeeName: '',
        startDate: '',
        endDate: '',
        reason: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="font-semibold text-lg">Leave Application</h3>
            <div className="space-y-2">
                <Label htmlFor="employeeName">Employee Name</Label>
                <Input id="employeeName" name="employeeName" value={formData.employeeName} onChange={handleChange} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" name="startDate" type="date" value={formData.startDate} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" name="endDate" type="date" value={formData.endDate} onChange={handleChange} required />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="reason">Reason for Leave</Label>
                <Textarea id="reason" name="reason" value={formData.reason} onChange={handleChange} required />
            </div>
            <Button type="submit" className="w-full">Submit Application</Button>
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
    // This function can be expanded later
    let textToCopy = message.data.content || "";
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

      {/* --- 👇 THIS IS THE FIX (Part 1) --- */}
      {/* We add 'relative' here so the absolute button inside knows its boundaries */}
      <div
        className={cn(
          "relative max-w-[80%] rounded-lg px-4 pt-3 pb-2", 
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-card-foreground"
        )}
      >
        {/* --- 👇 THIS IS THE FIX (Part 2) --- */}
        {/* The copy button is now positioned absolutely inside the bubble */}
        {!isUser && (
            <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="absolute top-1 right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? (
                <Check className="h-4 w-4 text-green-500" />
                ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
                )}
            </Button>
        )}
        {/* --- END OF FIX --- */}

        {message.data.type === "leave_application_form" && (
            <LeaveApplicationForm onSubmit={onFormSubmit!} />
        )}
        
        {message.data.type === "text" && message.data.content && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
             <ReactMarkdown>{message.data.content}</ReactMarkdown>
          </div>
        )}

        {message.data.type === "table" && message.data.tableData && message.data.tableColumns && (
            <DataTableCard
              data={message.data.tableData}
              columns={message.data.tableColumns}
            />
        )}
        {message.data.type === "detail" && message.data.detailData && (
          <DetailCard data={message.data.detailData} />
        )}
        
        <div className="flex items-center justify-end mt-2 h-5">
            <div className="flex-grow flex items-center">
            <p className={cn("text-xs opacity-60")}>
                {message.timestamp}
            </p>
            </div>
        </div>
      </div>
      {/* The old button location is now removed, preventing the block */}
    </motion.div>
  );
};