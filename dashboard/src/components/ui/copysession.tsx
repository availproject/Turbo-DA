"use client";

import { Button } from "@/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { template } from "@/lib/utils";
import { showFailedMessage, showSuccessMessage } from "@/utils/toasts";
import { useAuth } from "@clerk/nextjs";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

export default function CopySession() {
  const [token, setToken] = useState<null | string>("");
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    (async () => {
      isSignedIn && setToken(await getToken({ template }));
    })();
  }, [getToken, isSignedIn]);

  const copyToken = async () => {
    try {
      token && (await navigator.clipboard.writeText(token));
      showSuccessMessage({
        title: "Token Copied",
        description:
          "You can use this api-key to get funded and submit data through the script.",
      });
    } catch (err) {
      console.error("Failed to copy token: ", err);
      showFailedMessage({
        title: "Error",
        description: "Failed to copy token",
      });
    }
  };

  return isSignedIn && isLoaded ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild className="bg-inherit border-opacity-25">
          <Button
            variant="outline"
            size="icon"
            onClick={copyToken}
            aria-label="Copy session token"
            className="!rounded-full w-7 h-7"
          >
            <KeyRound className="h-3 w-3 " />
          </Button>
        </TooltipTrigger>
        <TooltipContent
          align="center"
          side="bottom"
          className="bg-black text-secondary-foreground !border-0 mt-2 mr-12"
        >
          <p className="text-xs font-sans font-thin">
            This is the api-key you&apos;ll use
            <br /> when submitting data through
            <br /> the script.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <></>
  );
}
