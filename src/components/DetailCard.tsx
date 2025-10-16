interface DetailCardProps {
  data: Record<string, string | number>;
}

export const DetailCard = ({ data }: DetailCardProps) => {
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">{key}:</span>
          <span className="text-sm font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
};
