import { cn } from "@/lib/utils";
import { Progress } from ".";

interface DuoProgressProps {
  progress: [number, number];
  colors: [string, string];
}

const DuoProgress = ({ progress, colors }: DuoProgressProps) => {
  const diagonalStripes = {
    backgroundImage: `repeating-linear-gradient(
      60deg,
      #dadada33,
      #dadada33 3px,
      transparent 3px,
      transparent 10px
    )`,
    width: `${progress[1]}%`,
  };
  return (
    <div className="w-full h-1.5 bg-grey-800 rounded-md">
      <div
        className={cn(
          `h-full rounded-full transition-all duration-300 ease-in-out w-full`,
          colors[1] ? `bg-${colors[1]}` : "bg-grey-800"
        )}
        style={diagonalStripes}
      >
        <Progress
          value={progress[0]}
          className="h-1.5 w-full"
          indicatorClassName={cn(
            "rounded-full",
            colors[0] && `bg-${colors[0]}`
          )}
        />
      </div>
    </div>
  );
};

export default DuoProgress;
