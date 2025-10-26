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
    <div className="flex flex-col h-full w-full bg-background">
      {/* Header - Compact on mobile */}
      <div className="flex-shrink-0 border-b border-border px-3 md:px-6 py-2 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={onToggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <h2 className="text-base md:text-xl font-semibold text-primary">SAP ChatFlow</h2>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={cn(
              "text-xs md:text-sm",
              isConnected ? "bg-green-500 hover:bg-green-500/90 text-white" : ""
            )}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Desktop-only social links */}
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

            <div className="h-6 w-px bg-border mx-2"></div>
          </div>
          
          {/* Theme toggle - always visible */}
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
                  <Sun className="h-4 w-4 md:h-5 md:w-5" />
                </motion.span>
              ) : (
                <motion.span key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="h-4 w-4 md:h-5 md:w-5" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </div>
      </div>
      
      {/* Main scrolling content area - Full height on mobile */}
      <div 
        ref={scrollViewportRef} 
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden",
          messages.length > 0 ? "p-3 md:p-6" : "p-0"
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