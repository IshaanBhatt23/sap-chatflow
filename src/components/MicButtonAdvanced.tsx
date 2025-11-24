import React, { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";

type MicButtonAdvancedProps = {
  // Live transcription while speaking
  onTranscript: (text: string) => void;
  // When user double-taps the mic, send the last transcript
  onSend: (text: string) => void;
  // Inform parent when listening starts/stops (for waveform UI)
  onListeningChange?: (listening: boolean) => void;
};

const DOUBLE_TAP_DELAY = 350; // ms

const MicButtonAdvanced: React.FC<MicButtonAdvancedProps> = ({
  onTranscript,
  onSend,
  onListeningChange,
}) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastFinalTranscript, setLastFinalTranscript] = useState("");
  const [tapTime, setTapTime] = useState<number | null>(null);

  const recognitionRef = useRef<any | null>(null);

  const updateListening = (value: boolean) => {
    setListening(value);
    if (onListeningChange) onListeningChange(value);
  };

  const getRecognition = () => {
    if (recognitionRef.current) return recognitionRef.current;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in this browser. Try Chrome or Edge."
      );
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.interimResults = true; // live transcription
    recognition.continuous = false;
    recognition.lang = "en-US"; // fixed English, no selector

    recognition.onstart = () => {
      updateListening(true);
      setTranscript("");
    };

    recognition.onend = () => {
      updateListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript + " ";
        } else {
          interimText += res[0].transcript + " ";
        }
      }

      const combined = (finalText + interimText).trim();

      if (finalText.trim()) {
        setLastFinalTranscript(finalText.trim());
      }

      setTranscript(combined);
      onTranscript(combined);
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  // PUSH-TO-TALK: hold to record
  const handlePressStart = () => {
    const recognition = getRecognition();
    if (!recognition) return;

    try {
      recognition.start();
    } catch (err) {
      // calling start twice throws; ignore
      console.warn(err);
    }
  };

  const stopRecognition = () => {
    const recognition = recognitionRef.current;
    if (recognition && listening) {
      recognition.stop();
    }
  };

  const handlePressEnd = () => {
    stopRecognition();
  };

  // DOUBLE TAP TO SEND
  const handleClick = () => {
    const now = Date.now();

    if (tapTime && now - tapTime < DOUBLE_TAP_DELAY) {
      const textToSend = (transcript || lastFinalTranscript).trim();
      if (textToSend.length > 0) {
        onSend(textToSend);
      }
      setTapTime(null);
    } else {
      setTapTime(now);
    }
  };

  return (
    <button
      type="button"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onClick={handleClick} // for double-tap send
      className={`flex items-center justify-center rounded-full h-10 w-10 md:h-14 md:w-14 border text-lg
        ${
          listening
            ? "bg-red-500 border-red-600 text-white"
            : "bg-muted border-border text-primary"
        }`}
      title={
        listening
          ? "Release to stop, double-tap to send"
          : "Hold to record, double-tap to send last transcript"
      }
    >
      <Mic className="h-5 w-5 md:h-7 md:w-7" />
    </button>
  );
};

export default MicButtonAdvanced;
