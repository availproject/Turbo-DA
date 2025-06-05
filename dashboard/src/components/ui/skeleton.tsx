import { cn } from "@/lib/utils";
import Image from "next/image";

function Skeleton({
  className,
  sheen = true,
  ...props
}: React.ComponentProps<"div"> & { sheen?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-[#13334F] rounded-lg overflow-hidden w-full h-14",
        className
      )}
      {...props}
    >
      {sheen && (
        <Image
          src="/sheen-effect.svg"
          alt="sheen-effect"
          width={40}
          height={56}
          className="animate-toright h-full relative"
        />
      )}
    </div>
  );
}

export { Skeleton };
