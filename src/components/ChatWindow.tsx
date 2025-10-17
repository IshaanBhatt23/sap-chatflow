import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble, Message } from "./MessageBubble"
import { WelcomeScreen } from "./WelcomeScreen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

// NEW: Add isBotTyping to the props interface
interface ChatWindowProps {
  messages: Message[]
  onPromptClick: (prompt: string) => void
  isConnected: boolean
  isBotTyping: boolean 
}

// NEW: A simple, animated typing indicator component
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
    className="flex items-center justify-start mb-4"
  >
    <div className="flex items-center space-x-1 rounded-lg bg-chat-bot-bg px-4 py-3">
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0 }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-muted-foreground"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  </motion.div>
);


export const ChatWindow = ({ messages, onPromptClick, isConnected, isBotTyping }: ChatWindowProps) => { // NEW: Destructure isBotTyping
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const firstRender = useRef(true)
  const { theme, setTheme } = useTheme()

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
  }, [messages, isBotTyping]) // NEW: Also trigger scroll when typing indicator appears/disappears

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

        {/* 🌞 / 🌙 Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="relative overflow-hidden rounded-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            {theme === "light" ? (
              <motion.span
                key="sun"
                initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 flex items-center justify-center text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]"
              >
                <Sun className="h-[1.2rem] w-[1.2rem]" />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ rotate: 90, opacity: 0, scale: 0.8 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 flex items-center justify-center text-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.6)]"
              >
                <Moon className="h-[1.2rem] w-[1.2rem]" />
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea
        ref={scrollAreaRef}
        className="flex-1 chat-scrollbar"
        onScrollCapture={handleScroll}
      >
        <div className="px-6 py-4">
          {messages.length === 0 && !isBotTyping ? ( // MODIFIED: Don't show welcome screen if bot is about to type
            <WelcomeScreen onPromptClick={onPromptClick} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {/* NEW: Conditionally render the typing indicator */}
          <AnimatePresence>
            {isBotTyping && <TypingIndicator />}
          </AnimatePresence>

          {/* Invisible anchor div for autoscroll */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}