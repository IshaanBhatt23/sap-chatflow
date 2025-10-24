import { useEffect, useRef } from "react"
import { MessageBubble, Message } from "@/components/MessageBubble" 
import { WelcomeScreen } from "@/components/WelcomeScreen" 
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Github, Linkedin, Globe, Menu } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface ChatWindowProps {
  messages: Message[]
  onPromptClick: (prompt: string) => void
  onFormSubmit?: (formData: Record<string, any>) => void;
  isConnected: boolean
  isBotTyping: boolean
  onToggleSidebar: () => void;
}

const TypingIndicator = () => (
    <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="flex items-center justify-start mb-4"
  >
    <div className="flex items-center space-x-1.5 rounded-lg bg-muted px-4 py-3">
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0 }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  </motion.div>
);

export const ChatWindow = ({ messages, onPromptClick, onFormSubmit, isConnected, isBotTyping, onToggleSidebar }: ChatWindowProps) => {
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isBotTyping]);

  const { theme, setTheme } = useTheme();

  return (
    // This root div is now correctly structured for flexbox layout
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      {/* --- MODIFIED: Reduced vertical padding on mobile (py-3) --- */}
      <div className="flex-shrink-0 border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden" // Only shows on screens smaller than medium
            onClick={onToggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* --- MODIFIED: Title is smaller on mobile, larger on desktop --- */}
          <h2 className="text-lg md:text-xl font-semibold text-primary">SAP Assistant</h2>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={isConnected ? "bg-green-500 hover:bg-green-500/90 text-white" : ""}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        {/* --- MODIFIED: This outer div now handles the theme button visibility --- */}
        <div className="flex items-center gap-3">
          {/* --- MODIFIED: This entire div is now hidden on mobile (screens < md) --- */}
          <div className="hidden md:flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Made by Ishaan Bhatt</p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="https://github.com/IshaanBhatt23" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                      <Github className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent><p>GitHub</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="https://www.linkedin.com/in/ishaan-bhatt-110a93256/" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent><p>LinkedIn</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a href="https://personal-portfolio-puce-delta-61.vercel.app/" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent><p>Portfolio</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* --- MODIFIED: This divider is also hidden on mobile --- */}
            <div className="h-6 w-px bg-border mx-2"></div>
          </div>
          
          {/* --- This Button is outside the hidden div, so it's ALWAYS visible --- */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="relative overflow-hidden rounded-full h-8 w-8"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === "light" ? (
                <motion.span key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Sun className="h-5 w-5" />
                </motion.span>
              ) : (
                <motion.span key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="h-5 w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
      
      {/* --- 
        THIS IS THE MAIN FIX 
        This div is the main scrolling container.
        We use cn() to conditionally apply padding:
        - "p-6" (default padding) when messages.length > 0
        - "p-0" (no padding) when messages.length === 0 (so WelcomeScreen fits)
      --- */}
      <div 
        ref={scrollViewportRef} 
        className={cn(
          "flex-1 overflow-y-auto",
          messages.length > 0 ? "p-6" : "p-0"
        )}
      >
        {messages.length === 0 && !isBotTyping ? (
          <WelcomeScreen onPromptClick={onPromptClick} />
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} onFormSubmit={onFormSubmit} />
          ))
        )}
        <AnimatePresence>
          {isBotTyping && <TypingIndicator />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}