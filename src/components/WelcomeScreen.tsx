import { motion } from "framer-motion";
import { Lightbulb, Package, FileText, Calendar } from "lucide-react";

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const promptSuggestions = [
  {
    icon: <Package className="h-5 w-5" />,
    text: "Check stock levels",
  },
  {
    icon: <FileText className="h-5 w-5" />,
    text: "Find sales orders",
  },
  {
    icon: <Calendar className="h-5 w-5" />,
    text: "Draft a leave request",
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    text: "What is the purchase order?",
  },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const WelcomeScreen = ({ onPromptClick }: WelcomeScreenProps) => {
  return (
    // --- MODIFIED: Reduced vertical padding even more on mobile (py-4) ---
    <div className="flex flex-col items-center justify-center text-center p-4 py-4 md:py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-2xl mx-auto w-full"
      >
        {/* --- MODIFIED: Reduced margin-bottom (mb-3) --- */}
        <div className="mx-auto mb-3 h-12 w-12 md:h-16 md:w-16 flex items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a10 10 0 0 0 10-10H2a10 10 0 0 0 10 10z"/><path d="m14.5 13-1.4-1.4a2 2 0 0 0-2.8 0L9 13"/><path d="M12 22V8"/><path d="m12 8-1.5-1.5a2.83 2.83 0 0 1 0-4 2.83 2.83 0 0 1 4 0 2.83 2.83 0 0 1 0 4L12 8z"/></svg>
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
          SAP Assistant
        </h1>
        {/* --- MODIFIED: Reduced margin-top (mt-2) --- */}
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">
          {getGreeting()}! How can I help you today?
        </p>

        {/* --- MODIFIED: Reduced margin-top (mt-5) and button gap (gap-2) --- */}
        <div className="mt-5 md:mt-8 grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2">
          {promptSuggestions.map((prompt, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.1, ease: "easeOut" }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPromptClick(prompt.text)}
              // --- MODIFIED: Reduced button padding (p-3) and gap (gap-3) ---
              className="group flex items-start gap-3 rounded-lg border bg-card p-3 sm:p-4 text-left transition-colors hover:bg-muted/50"
            >
              {/* --- MODIFIED: Reduced icon padding (p-1.5) --- */}
              <div className="flex-shrink-0 rounded-md bg-primary/10 p-1.5 sm:p-2 text-primary">
                {prompt.icon}
              </div>
              <div>
                <p className="font-medium text-card-foreground">{prompt.text}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
