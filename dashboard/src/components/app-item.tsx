"use client";
import useAPIKeys from "@/hooks/useApiKeys";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, cn, formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { Copy, EllipsisVertical, Pencil, Trash2, X } from "lucide-react";
import Image from "next/image";
import { memo, useMemo, useState } from "react";
import AssignCredits from "./assign-credits";
import CreateApp from "./create-app";
import DeleteAppAlert from "./delete-app-alert";
import DeleteKeyAlert from "./delete-key-alert";
import { useDialog } from "./dialog/provider";
import AvatarWrapper from "./lottie-comp/avatar-container";
import PrimaryProgress from "./progress/primary-progress";
import SecondaryProgress from "./progress/secondary-progress";
import ReclaimCredits from "./reclaim-credits";
import SwitchDescription from "./switch-description";
import SwitchToMainBalanceAlert from "./switch-main-balance-alert";
import { Text } from "./text";
import { useAppToast } from "./toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import ViewKeys from "./view-keys";

const AppItem = ({ app }: { app: AppDetails }) => {
  const { apiKeys, creditBalance } = useOverview();
  const [displayAPIKey, setDisplayAPIKey] = useState(false);
  const [useMainBalance, setUseMainBalance] = useState(
    creditBalance ? app?.fallback_enabled : false
  );
  const { setOpen, open } = useDialog();
  const { token } = useConfig();
  const { updateAPIKeys } = useAPIKeys();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [openDeleteAlert, setOpenDeleteAlert] = useState<string>();
  const { success } = useAppToast();

  const generateApiKey = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await AppService.generateAPIKey({
        token,
        appId: `${app.id}`,
      });
      setApiKey(response.data?.api_key);
      response.data?.api_key && updateAPIKeys();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const updateFallbackHandler = async () => {
    try {
      const response = await AppService.updateApp({
        token: token!,
        appId: app.app_id,
        appName: app.app_name,
        avatar: app.app_logo,
        id: app.id,
        fallbackEnabled: !useMainBalance,
      });
    } catch (error) {
      console.log({
        error,
      });
    }
  };

  const creditsData = useMemo(() => {
    if (useMainBalance) {
      const totalMainCredit = creditBalance
        ? +app.fallback_credit_used + creditBalance
        : +app.fallback_credit_used;

      return {
        usedCredit: +app.fallback_credit_used,
        totalCredit: +totalMainCredit,
        remainingCredits: creditBalance,
      };
    }
    return {
      usedCredit: +app.credit_used,
      totalCredit: +app.credit_balance + +app.credit_used,
      remainingCredits: +app.credit_balance,
    };
  }, [useMainBalance, creditBalance]);

  const progress = useMemo(
    () => (creditsData?.usedCredit / creditsData?.totalCredit) * 100,
    [creditsData?.usedCredit, creditsData?.totalCredit]
  );

  return (
    <div className="w-full p-4 rounded-lg border border-solid border-border-blue relative overflow-hidden">
      <div className="flex w-full gap-x-1.5">
        <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
          {app?.app_logo?.includes(".") ? (
            <Image
              className="w-10 h-10 rounded"
              alt={app.app_name}
              src={baseImageUrl(app.app_logo)}
              width={40}
              height={40}
            />
          ) : (
            <div className="w-10 rounded overflow-hidden">
              {avatarList?.[app?.app_logo]?.path ? (
                <AvatarWrapper
                  path={avatarList?.[app?.app_logo]?.path}
                  width={40}
                  height={40}
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between flex-1">
          <div className="flex flex-col justify-between">
            <div className="flex items-center gap-x-1.5">
              <Text weight={"semibold"}>{app.app_name}</Text>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <EllipsisVertical
                    color="#B3B3B3"
                    size={20}
                    className="cursor-pointer"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52 border border-[#586472] bg-[#112235] p-0 rounded overflow-hidden">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setOpen("update-app" + app.id)}
                      className="flex gap-x-2.5 group hover:bg-[#414E5D] cursor-pointer rounded-none items-center p-2"
                    >
                      <Pencil
                        size={32}
                        className="text-[#B3B3B3] group-hover:text-white"
                      />
                      <Text
                        weight={"bold"}
                        variant={"secondary-grey"}
                        className="group-hover:text-white"
                      >
                        Edit App
                      </Text>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setOpen("delete-app-alert" + app.id)}
                      className="flex gap-x-2.5 group hover:bg-[#414E5D] cursor-pointer rounded-none items-center p-2"
                    >
                      <Trash2
                        size={32}
                        className="text-[#B3B3B3] group-hover:text-white"
                      />
                      <Text
                        weight={"bold"}
                        variant={"secondary-grey"}
                        className="group-hover:text-white"
                      >
                        Delete App
                      </Text>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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

          {creditsData.totalCredit ? (
            <div className="flex flex-col w-[200px] items-end gap-2">
              <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
                Used:{" "}
                {creditsData.usedCredit
                  ? formatDataBytes(creditsData.usedCredit)
                  : 0}
                /{formatDataBytes(creditsData.totalCredit)}
              </Text>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    {useMainBalance ? (
                      <PrimaryProgress progress={progress} color={"green"} />
                    ) : (
                      <SecondaryProgress progress={progress} />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-black w-[147px] p-2">
                  <div className="flex flex-col gap-y-2">
                    <div className="flex gap-x-1.5">
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full mt-0.5",
                          useMainBalance ? "bg-[#7DC372]" : "bg-[#FF82C8]"
                        )}
                      />
                      <div>
                        <Text
                          variant={"light-grey"}
                          weight={"medium"}
                          size={"xs"}
                        >
                          Used
                        </Text>
                        <Text weight={"medium"} size={"xs"}>
                          {formatDataBytes(creditsData.usedCredit)}
                        </Text>
                      </div>
                    </div>
                    <div className="flex gap-x-1.5">
                      {useMainBalance ? (
                        <div className="h-3 w-3 bg-grey-800 rounded-full" />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-[#62768C] flex justify-between items-center pl-[5px] -rotate-45 mt-0.5">
                          <div className="h-3 w-0.5 bg-[#dadada33]" />
                        </div>
                      )}
                      <div>
                        <Text
                          variant={"light-grey"}
                          weight={"medium"}
                          size={"xs"}
                        >
                          Unused
                        </Text>
                        <Text weight={"medium"} size={"xs"}>
                          {creditsData.remainingCredits
                            ? formatDataBytes(creditsData.remainingCredits)
                            : "0 B"}
                        </Text>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full mt-4">
        <div className="flex items-start gap-4 mt-1 justify-between flex-wrap">
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
            className={cn(
              "flex gap-x-0.5",
              apiKeys?.[app.id]?.length && "cursor-pointer"
            )}
            onClick={() =>
              apiKeys?.[app.id]?.length && setOpen("view-key" + app.id)
            }
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
              <Text size={"sm"} weight={"bold"} variant={"blue"}>
                ({apiKeys?.[app.id]?.length})
              </Text>
            ) : null}
          </div>

          <Text
            size={"sm"}
            weight={"bold"}
            variant={"light-grey"}
            onClick={() =>
              !useMainBalance &&
              creditBalance &&
              setOpen("assign-credits" + app.id)
            }
            className={cn(
              "underline underline-offset-[2.5px]",
              !useMainBalance && +creditBalance
                ? "cursor-pointer"
                : "opacity-30"
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
              +app.credit_balance && !useMainBalance
                ? "cursor-pointer"
                : "opacity-30"
            )}
            onClick={() =>
              +app.credit_balance &&
              !useMainBalance &&
              setOpen("reclaim-credits" + app.id)
            }
          >
            Unassigned Credits
          </Text>
        </div>
        <SwitchDescription
          id={app.id}
          disabled={!creditBalance}
          checked={useMainBalance}
          onChecked={(value) => {
            if (app?.credit_balance && +app?.credit_balance > 0) {
              setUseMainBalance(value);
              updateFallbackHandler();
            } else {
              if (value) {
                setUseMainBalance(value);
                updateFallbackHandler();
                return;
              }
              setOpen("switch-to-main-balance" + app.id);
            }
          }}
        />
        {useMainBalance && +creditBalance ? (
          <div className="flex gap-x-1 border border-[#1FC16B] bg-[#1FC16B1A] py-0.5 px-2 rounded-full w-fit items-center mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-green" />
            <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
              Using Main Credit Balance
            </Text>
          </div>
        ) : null}
        {+app.credit_balance && !useMainBalance ? (
          <div className="flex gap-x-1 border border-[#FF82C8CC] bg-[#FF82C829] py-0.5 px-2 rounded-full w-fit items-center mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#FF82C8]" />
            <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
              Using Assigned Credits
            </Text>
          </div>
        ) : null}
        {!+app?.credit_balance && !useMainBalance ? (
          <div className="flex gap-x-1 border border-[#E4A354CC] bg-[#E4A35429] py-0.5 px-2 rounded-full w-fit items-center mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#E4A354]" />
            <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
              Credits Inactive — Please Assign Some Or Use Main Balance
            </Text>
          </div>
        ) : null}
        {!+creditBalance && useMainBalance && !+app.credit_balance ? (
          <div className="flex gap-x-1 border border-[#CF6679] bg-[#CF667929] py-0.5 px-2 rounded-full w-fit items-center mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#CF6679]" />
            <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
              Credits Null — Please BUY Some TO POST data
            </Text>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "absolute transition-all duration-500 bg-[#13334F] w-full left-0 p-4 flex gap-y-1 flex-col border-t border-border-blue",
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
            className={cn(loading ? "pointer-events-none" : "cursor-pointer")}
            onClick={() => setDisplayAPIKey(false)}
          />
        </div>
        {loading ? (
          <Skeleton className="h-[24px] w-[380px] bg-black/40 rounded-xs" />
        ) : (
          <div className="flex items-center gap-x-2 cursor-pointer w-fit">
            <Text size={"xl"} weight={"bold"}>
              {apiKey}
            </Text>
            <Copy
              size={24}
              color="#FFF"
              strokeWidth={1}
              onClick={async () => {
                await navigator.clipboard.writeText(apiKey);
                success({ label: "API key copied" });
              }}
            />
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
      {open === "view-key" + app.id && (
        <ViewKeys
          id={"view-key" + app.id}
          appId={app.id}
          openDeleteAlert={(apiKey) => {
            setOpenDeleteAlert(apiKey);
            setOpen("delete-key-alert" + app.id);
          }}
        />
      )}
      {open === "delete-key-alert" + app.id && openDeleteAlert && (
        <DeleteKeyAlert
          id={"delete-key-alert" + app.id}
          identifier={openDeleteAlert}
          clearAlertCallback={() => {
            setOpenDeleteAlert(undefined);
          }}
        />
      )}
      {open === "delete-app-alert" + app.id && (
        <DeleteAppAlert
          id={"delete-app-alert" + app.id}
          appId={app.id}
          appName={app.app_name}
        />
      )}
      {open === "update-app" + app.id && (
        <CreateApp type="edit" appData={app} id={"update-app" + app.id} />
      )}
      {open === "switch-to-main-balance" + app.id && (
        <SwitchToMainBalanceAlert
          id={"switch-to-main-balance" + app.id}
          callback={() => {
            setUseMainBalance(false);
            updateFallbackHandler();
            setOpen("");
          }}
        />
      )}
    </div>
  );
};

export default memo(AppItem);
