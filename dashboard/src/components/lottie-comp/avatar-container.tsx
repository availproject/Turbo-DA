import { DotLottie, DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useRef } from "react";

const AvatarWrapper = ({
  path,
  width,
  height,
}: {
  path: string;
  width: number;
  height: number;
}) => {
  let dotLottieRef = useRef<DotLottie | null>(null);

  return (
    <DotLottieReact
      src={path}
      loop
      width={width}
      height={height}
      dotLottieRefCallback={(ref) => {
        dotLottieRef.current = ref;
      }}
      onMouseEnter={() => dotLottieRef.current?.play()}
      onMouseLeave={() => dotLottieRef.current?.stop()}
    />
  );
};

export default AvatarWrapper;
