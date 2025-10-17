interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const WelcomeScreen = ({ onPromptClick }: WelcomeScreenProps) => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        {/* Main Title */}
        <h1 className="text-5xl font-bold text-primary mb-6">SAP Assistant</h1>
        
        {/* Friendly Greeting */}
        <h2 className="text-3xl font-light text-foreground mb-6">
          {getGreeting()}! How can I help you today?
        </h2>

        {/* Guidance Text */}
        <p className="text-base text-muted-foreground leading-relaxed">
          You can ask me to{" "}
          <span className="font-medium text-accent">check stock levels</span>,{" "}
          <span className="font-medium text-accent">find sales orders</span> or{" "}
          <span className="font-medium text-accent">approve requests</span>.
        </p>
      </div>
    </div>
  );
};
