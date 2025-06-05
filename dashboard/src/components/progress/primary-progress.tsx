import { cn } from "@/lib/utils";
import { Progress } from ".";

interface PrimaryProgressProps {
  progress: number;
  color: string;
}

const PrimaryProgress = ({ progress, color }: PrimaryProgressProps) => {
  return (
    <div className="w-full h-1.5 rounded-md">
      <div className="h-full rounded-full transition-all duration-300 ease-in-out w-full bg-grey-800">
        <Progress
          value={progress}
          className="h-1.5 w-full"
          indicatorClassName={cn("rounded-full", color && `bg-${color}`)}
        />
      </div>
    </div>
  );
};

export default PrimaryProgress;
