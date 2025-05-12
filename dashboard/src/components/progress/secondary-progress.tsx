import { Progress } from ".";

interface SecondaryProgressProps {
  progress: number;
}

const SecondaryProgress = ({ progress }: SecondaryProgressProps) => {
  const diagonalStripes = {
    backgroundImage: `repeating-linear-gradient(
      60deg,
      #dadada33,
      #dadada33 3px,
      transparent 3px,
      transparent 10px
    )`,
    width: `100%`,
  };
  return (
    <div className="w-full h-1.5 rounded-md">
      <div
        className="h-full rounded-full transition-all duration-300 ease-in-out w-full bg-grey-800"
        style={diagonalStripes}
      >
        <Progress
          value={progress}
          className="h-1.5 w-full"
          indicatorClassName="rounded-full bg-[#FF82C8]"
        />
      </div>
    </div>
  );
};

export default SecondaryProgress;
