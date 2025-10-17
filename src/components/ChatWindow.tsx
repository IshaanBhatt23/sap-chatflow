import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble, Message } from "./MessageBubble"
import { WelcomeScreen } from "./WelcomeScreen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Github, Linkedin, Globe } from "lucide-react" // Removed UserCircle, added Globe
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Interface and TypingIndicator component remain the same...
interface ChatWindowProps {
  messages: Message[]
  onPromptClick: (prompt: string) => void
  isConnected: boolean
  isBotTyping: boolean 
}

const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="flex items-center justify-start mb-4"
  >
    <div className="flex items-center space-x-1.5 rounded-lg bg-chat-bot-bg px-4 py-3">
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

export const ChatWindow = ({ messages, onPromptClick, isConnected, isBotTyping }: ChatWindowProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const firstRender = useRef(true)
  const { theme, setTheme } = useTheme()

  // Scroll logic remains the same...
  const handleScroll = () => {
    const scrollEl = scrollAreaRef.current
    if (!scrollEl) return
    const threshold = 80
    const distanceFromBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    setIsNearBottom(distanceFromBottom < threshold)
  }

  useEffect(() => {
    if (!messagesEndRef.current) return
    if (firstRender.current) {
      firstRender.current = false
      messagesEndRef.current.scrollIntoView({ behavior: "auto" })
      return
    }
    if (isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isBotTyping])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-primary">SAP Assistant</h2>
          <Badge
            variant={isConnected ? "default" : "destructive"}
            className={isConnected ? "bg-success hover:bg-success" : ""}
          >
            <span className="mr-2">●</span>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground hidden sm:block">Made by Ishaan Bhatt</p>
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

          {/* NEW: Added a visual separator */}
          <div className="h-6 w-px bg-border mx-2"></div>

          {/* Theme Toggle Button (restored) */}
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

      {/* Messages Area */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 chat-scrollbar"
        onScrollCapture={handleScroll}
      >
        <div className="px-6 py-4">
          {messages.length === 0 && !isBotTyping ? (
            <WelcomeScreen onPromptClick={onPromptClick} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <AnimatePresence>
            {isBotTyping && <TypingIndicator />}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}