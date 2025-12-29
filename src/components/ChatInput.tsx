import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import MicButtonAdvanced from "./MicButtonAdvanced";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  activeSessionId?: string;
}

const SAMPLE_COUNT = 120; // number of bars across the bar

export const ChatInput = ({
  onSendMessage,
  disabled,
  activeSessionId,
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [waveform, setWaveform] = useState<number[]>(
    () => Array(SAMPLE_COUNT).fill(0.02)
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // how "intense" the waves are – boosted when transcript changes
  const intensityRef = useRef(0.3);
  const lastTranscriptRef = useRef("");

  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSend = (overrideMessage?: string) => {
    const textToSend = (overrideMessage ?? message).trim();
    if (textToSend && !disabled) {
      onSendMessage(textToSend);
      setMessage("");
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 🔁 Pure animation loop (no audio API) – waves react to "intensity"
  useEffect(() => {
    const stopAnim = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setWaveform(Array(SAMPLE_COUNT).fill(0.02));
      intensityRef.current = 0.3;
    };

    if (!isListening) {
      stopAnim();
      return;
    }

    const center = (SAMPLE_COUNT - 1) / 2;

    const animate = () => {
      // decay intensity so waves calm down over time
      intensityRef.current = Math.max(0.3, intensityRef.current * 0.95);

      const intensity = intensityRef.current;
      const newWave: number[] = [];

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const distance = Math.abs(i - center) / center; // 0 center, 1 edges
        const weight = 0.2 + 0.8 * (1 - distance * distance); // stronger in center

        // random base movement
        const noise = (Math.random() - 0.5) * 2; // -1..1

        let value = Math.abs(noise) * intensity * weight;

        // ensure some minimum so baseline is always visible
        value = Math.max(0.02, value);

        newWave.push(value);
      }

      setWaveform(newWave);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      stopAnim();
    };
  }, [isListening]);

  // 🧠 Decide what to render: normal input vs waveform bar
  const renderInputOrWaveform = () => {
    if (!isListening) {
      return (
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask about anything in SAP..."
          disabled={disabled}
          className="flex-1 h-12 md:h-16 rounded-lg md:rounded-full bg-muted px-4 md:px-7 text-base md:text-xl"
        />
      );
    }

    const bars = waveform;
    const center = bars.length / 2;

    return (
      <div className="flex-1 h-12 md:h-16 rounded-lg md:rounded-full bg-muted px-4 md:px-7 flex items-center">
        <div className="relative w-full h-6 md:h-8">
          {/* dotted baseline across full width */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div
              className="w-full h-px"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(59,130,246,0.9) 0, rgba(59,130,246,0.9) 2px, transparent 2px, transparent 5px)",
              }}
            />
          </div>

          {/* reactive spikes */}
          <div className="absolute inset-0 flex items-center">
            <div className="flex w-full h-full items-center justify-between">
              {bars.map((value, idx) => {
                const distance = Math.abs(idx - center) / center;
                const weight = 0.3 + 0.7 * (1 - distance * distance);
                const amp = value * weight;

                const height = 2 + amp * 70; // 2–72px approx

                return (
                  <span
                    key={idx}
                    className="w-[2px] rounded-full bg-accent"
                    style={{
                      height: `${height}px`,
                      opacity: 0.25 + amp * 0.75,
                      transition: "height 80ms linear, opacity 80ms linear",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border-t border-border bg-background px-4 py-3 md:py-8">
      <div className="relative flex items-center gap-2 md:gap-4">
        {renderInputOrWaveform()}

        {/* Mic button: controls listening + sends transcript */}
        <MicButtonAdvanced
          onTranscript={(text) => {
            setMessage(text);

            // whenever transcript changes, spike intensity so waves go bigger
            if (text !== lastTranscriptRef.current) {
              intensityRef.current = 1; // max energy
              lastTranscriptRef.current = text;
            }
          }}
          onSend={(text) => {
            handleSend(text);
          }}
          onListeningChange={(listening) => setIsListening(listening)}
          disabled={disabled} // <--- ADDED THIS LINE
        />

        <Button
          onClick={() => handleSend()}
          disabled={!message.trim() || disabled}
          size="icon"
          className="bg-accent hover:bg-accent/90 h-10 w-10 md:h-14 md:w-14 flex-shrink-0 rounded-full"
        >
          <Send className="h-5 w-5 md:h-7 md:w-7" />
        </Button>
      </div>
    </div>
  );
};