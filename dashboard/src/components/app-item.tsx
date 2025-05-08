"use client";
import { cn, formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import CreditService from "@/services/credit";
import { AppDetails } from "@/services/credit/response";
import { Copy, Info, InfoIcon, Pencil, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import AssignCredits from "./assign-credits";
import Button from "./button";
import CreateApp from "./create-app";
import DeleteKeyAlert from "./delete-key-alert";
import { useDialog } from "./dialog/provider";
import { Progress } from "./progress";
import ReclaimCredits from "./reclaim-credits";
import { Text } from "./text";
import { Skeleton } from "./ui/skeleton";
import { Switch } from "./ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import ViewKeys from "./view-keys";

const AppItem = ({ app }: { app: AppDetails }) => {
  const [displayAPIKey, setDisplayAPIKey] = useState(false);
  const { setOpen, open } = useDialog();
  const { token } = useConfig();
  const { apiKeys } = useOverview();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const progress =
    (+app.credit_used / +app.credit_balance + +app.credit_used) * 100;

  const generateApiKey = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await CreditService.generateAPIKey({
        token,
        appId: `${app.id}`,
      });
      setApiKey(response.data?.api_key);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  console.log({
    app,
  });

  return (
    <div className="flex items-start justify-between p-4 rounded-lg border border-solid border-[#565656] relative overflow-hidden">
      <div className="flex items-start gap-1.5 flex-1">
        <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
          <Image
            className="w-8 h-auto"
            alt="App icon"
            src="/logo.svg"
            width={32}
            height={40}
          />
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Text weight={"medium"} size={"base"}>
                  {app.app_name}
                </Text>
                <Button
                  variant="ghost"
                  className="w-6 h-6 p-0 bg-[#88919a] rounded-2xl hover:bg-[#88919a] cursor-pointer"
                  onClick={() => setOpen("update-app" + app.id)}
                >
                  <Pencil size={24} color="#FFF" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Text variant={"light-grey"} weight={"medium"} size={"sm"}>
                  App ID:
                </Text>
                <Text size={"base"} weight={"bold"}>
                  {app.app_id}
                </Text>
              </div>
            </div>

            {progress ? (
              <div className="flex flex-col w-[200px] items-end gap-2">
                <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
                  Used: {formatDataBytes(+app.credit_used)}/
                  {formatDataBytes(+app.credit_balance + +app.credit_used)}
                </Text>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <Progress value={30} color={"green"} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0F1F30]">
                    <div className="flex flex-col gap-y-2">
                      <div className="flex gap-x-1.5">
                        <div className="h-3 w-3 rounded-full bg-[#7DC372] mt-0.5" />
                        <div>
                          <Text
                            variant={"light-grey"}
                            weight={"medium"}
                            size={"xs"}
                          >
                            Used
                          </Text>
                          <Text weight={"medium"} size={"xs"}>
                            00
                          </Text>
                        </div>
                      </div>
                      <div className="flex gap-x-1.5">
                        <div className="h-3 w-3 rounded-full bg-[#62768C] flex justify-between items-center pl-[5px] -rotate-45 mt-0.5">
                          <div className="h-3 w-0.5 bg-[#dadada33]" />
                        </div>
                        <div>
                          <Text
                            variant={"light-grey"}
                            weight={"medium"}
                            size={"xs"}
                          >
                            Unused
                          </Text>
                          <Text weight={"medium"} size={"xs"}>
                            500KB
                          </Text>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
            {!progress ? (
              <div className="flex w-fit items-end gap-2">
                <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
                  [App will use unallocated credits]
                </Text>
                <Info color="#dadada" size={20} className="cursor-pointer" />
              </div>
            ) : null}
          </div>

          <div className="flex items-start gap-x-4 mt-1">
            <Text
              size={"sm"}
              weight={"bold"}
              variant={"blue"}
              className="underline underline-offset-[2.5px] cursor-pointer"
              onClick={() => {
                generateApiKey();
                setDisplayAPIKey(true);
              }}
            >
              Generate API Key
            </Text>
            <div
              className="flex gap-x-0.5 cursor-pointer"
              onClick={() => setOpen("view-key" + app.id)}
            >
              <Text
                size={"sm"}
                weight={"bold"}
                variant={"light-grey"}
                className={cn(
                  "underline underline-offset-[2.5px]",
                  !apiKeys?.[app.id]?.length && "opacity-30"
                )}
              >
                View All Keys
              </Text>
              {apiKeys?.[app.id]?.length ? (
                <Text size={"sm"} weight={"bold"} variant={"light-grey"}>
                  ({apiKeys?.[app.id]?.length})
                </Text>
              ) : null}
            </div>

            <Text
              size={"sm"}
              weight={"bold"}
              variant={"light-grey"}
              onClick={() => setOpen("assign-credits" + app.id)}
              className={cn(
                "underline underline-offset-[2.5px]",
                apiKeys?.[app.id]?.length ? "cursor-pointer" : "opacity-30"
              )}
            >
              Assign Credits
            </Text>
            <Text
              size={"sm"}
              weight={"bold"}
              variant={"light-grey"}
              className={cn(
                "underline underline-offset-[2.5px]",
                +app.credit_used ? "cursor-pointer" : "opacity-30"
              )}
              onClick={() => setOpen("reclaim-credits" + app.id)}
            >
              Reclaim Credits
            </Text>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <Switch id="airplane-mode" />
            <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
              Use Main Credit Balance
            </Text>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon size={20} color="#FFF" className="cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="bg-[#0F1F30] w-[300px]">
                <Text
                  size={"sm"}
                  weight={"medium"}
                  variant={"light-grey"}
                  className="text-[#aaabac]"
                >
                  By default, apps use your{" "}
                  <Text as="i">‘Unallocated Credits’</Text>. Click on{" "}
                  <Text as="i">‘Allocate Credits’</Text> and uncheck the
                  checkbox if you want to use your{" "}
                  <Text as="i">‘Allocated Credits’</Text> only.
                </Text>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-x-2 items-center mt-1">
            <div className="flex gap-x-1 border border-[#1FC16B] bg-[#1FC16B1A] py-0.5 px-2 rounded-full items-center">
              <div className="h-1.5 w-1.5 rounded-full bg-green" />
              <Text
                variant={"light-grey"}
                weight={"medium"}
                size={"xs"}
                className="uppercase"
              >
                Using Main Credit Balance Only
              </Text>
            </div>
          </div>
        </div>
      </div>
      <div
        className={cn(
          "absolute transition-all duration-500 bg-[#112133] w-full left-0 p-4 flex gap-y-2 flex-col",
          displayAPIKey ? "bottom-0" : "-bottom-32"
        )}
      >
        <div className="flex justify-between items-center">
          <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
            API Key
          </Text>
          <X
            size={22}
            color="#fff"
            className="cursor-pointer"
            onClick={() => setDisplayAPIKey(false)}
          />
        </div>
        {loading ? (
          <Skeleton className="h-4 w-[250px]" />
        ) : (
          <div className="flex items-center gap-x-2 cursor-pointer w-fit">
            <Text size={"base"} weight={"bold"}>
              {apiKey}
            </Text>
            <Copy size={24} color="#FFF" strokeWidth={1} />
          </div>
        )}

        <Text size={"xs"} weight={"medium"} variant={"yellow"}>
          This key will only be shown once. Please copy it and store it in a
          safe place
        </Text>
      </div>
      {open === "assign-credits" + app.id && (
        <AssignCredits id={"assign-credits" + app.id} appData={app} />
      )}
      {open === "reclaim-credits" + app.id && (
        <ReclaimCredits id={"reclaim-credits" + app.id} appData={app} />
      )}
      {open === "view-key" + app.id && <ViewKeys id={"view-key" + app.id} />}
      {open === "delete-key-alert" + app.id && (
        <DeleteKeyAlert id={"delete-key-alert" + app.id} />
      )}
      {open === "update-app" + app.id && (
        <CreateApp type="edit" appData={app} id={"update-app" + app.id} />
      )}
    </div>
  );
};

export default AppItem;
