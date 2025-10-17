import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble, Message } from "./MessageBubble"
import { WelcomeScreen } from "./WelcomeScreen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

interface ChatWindowProps {
  messages: Message[]
  onPromptClick: (prompt: string) => void
  isConnected: boolean
}

export const ChatWindow = ({ messages, onPromptClick, isConnected }: ChatWindowProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const firstRender = useRef(true)
  const { theme, setTheme } = useTheme()

  // ✅ Detect if user is near the bottom
  const handleScroll = () => {
    const scrollEl = scrollAreaRef.current
    if (!scrollEl) return
    const threshold = 80 // px from bottom
    const distanceFromBottom =
      scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight
    setIsNearBottom(distanceFromBottom < threshold)
  }

  // ✅ Scroll to bottom (smart behavior)
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
  }, [messages])

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
          {messages.length === 0 ? (
            <WelcomeScreen onPromptClick={onPromptClick} />
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          {/* Invisible anchor div for autoscroll */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  )
}
