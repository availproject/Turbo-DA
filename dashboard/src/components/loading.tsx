import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="h-[70vh] w-screen flex flex-col items-center justify-center space-y-8">
      <Loader2 className={`h-12 w-12 animate-spin text-white text-opacity-80`} />
        <h1 className="text-white text-opacity-70 text-md font-sans font-thin">Fetching your balances.</h1>
    </div>
  );
}
