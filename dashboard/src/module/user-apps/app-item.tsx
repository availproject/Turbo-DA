"use client";
import { useDialog } from "@/components/dialog/provider";
import AvatarWrapper from "@/components/lottie-comp/avatar-container";
import PrimaryProgress from "@/components/progress/primary-progress";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Skeleton } from "@/components/ui/skeleton";
import useAPIKeys from "@/hooks/useApiKeys";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, cn, formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import {
  AlertTriangle,
  Copy,
  EllipsisVertical,
  Eye,
  KeyRound,
  Pencil,
  ScrollText,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useMemo, useState } from "react";
import AssignCredits from "./assign-credits";
import CreateApp from "./create-app";
import DeleteAppAlert from "./delete-app-alert";
import DeleteKeyAlert from "./delete-key-alert";
import ManageCredits from "./manage-credits";
import ReclaimCredits from "./reclaim-credits";
import SwitchDescription from "./switch-description";
import SwitchToMainBalanceAlert from "./switch-main-balance-alert";
import ViewKeys from "./view-keys";
import useApp from "@/hooks/useApp";

const AppItem = ({ app }: { app: AppDetails }) => {
  const { apiKeys, creditBalance } = useOverview();
  const [displayAPIKey, setDisplayAPIKey] = useState(false);
  const { setOpen, open } = useDialog();
  const { token } = useConfig();
  const { updateAPIKeys } = useAPIKeys();
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [openDeleteAlert, setOpenDeleteAlert] = useState<string>();
  const { success } = useAppToast();
  const { updateAppList } = useApp();

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

  const toggleEncryption = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await AppService.toggleEncryption({
        token,
        appId: app.id,
      });
      updateAppList();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const updateFallbackHandler = async (creditSelection: number) => {
    try {
      const response = await AppService.updateApp({
        token: token!,
        appId: app.app_id,
        appName: app.app_name,
        avatar: app.app_logo,
        id: app.id,
        creditSelection,
      });
    } catch (error) {
      console.log({
        error,
      });
    }
  };

  const creditsData = useMemo(() => {
    // Use credit_selection from API to determine mode
    const creditSelection = app.credit_selection ?? 1; // Use nullish coalescing to avoid issues with 0

    console.log("Credit Selection Debug:", {
      creditSelection,
      original: app.credit_selection,
      typeof: typeof app.credit_selection,
    });

    if (creditSelection === 1) {
      // Using main balance only (credit_selection: 1)
      const used = +app.fallback_credit_used;
      const total = creditBalance || 0;
      const remaining = Math.max(total - used, 0);

      return {
        usedCredit: used,
        totalCredit: total,
        remainingCredits: remaining,
        mode: "main-balance" as const,
      };
    } else if (creditSelection === 0 || creditSelection === 2) {
      // Using assigned credits (credit_selection: 0 or 2)
      return {
        usedCredit: +app.credit_used,
        totalCredit: +app.credit_balance + +app.credit_used,
        remainingCredits: +app.credit_balance,
        mode: "assigned-credits" as const,
      };
    } else {
      // Fallback case
      console.warn("Unexpected credit_selection value:", creditSelection);
      const used = +app.fallback_credit_used;
      const total = creditBalance || 0;
      const remaining = Math.max(total - used, 0);

      return {
        usedCredit: used,
        totalCredit: total,
        remainingCredits: remaining,
        mode: "main-balance" as const,
      };
    }
  }, [
    app.credit_selection,
    app.credit_balance,
    app.credit_used,
    app.fallback_credit_used,
    creditBalance,
  ]);

  const progress = useMemo(() => {
    if (!creditsData?.totalCredit) return 0;
    const pct = (creditsData.usedCredit / creditsData.totalCredit) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [creditsData?.usedCredit, creditsData?.totalCredit]);

  // Check if assigned credits are near exhaustion (less than 10 credits)
  const isNearExhaustion = useMemo(() => {
    // Show near exhaustion when: credit_selection = 0, credit_used > 0, credit_balance/1024 < 100000
    // But NOT when app is inactive (credit_balance <= 0)
    return (
      app.credit_selection === 0 &&
      +app.credit_used > 0 &&
      +app.credit_balance / 1024 < 100000 &&
      +app.credit_balance > 0
    );
  }, [app.credit_selection, app.credit_used, app.credit_balance]);

  // Check if assigned credits are fully exhausted
  const isFullyExhausted = useMemo(() => {
    if (creditsData.mode !== "assigned-credits") return false;
    return creditsData.remainingCredits <= 0;
  }, [creditsData.mode, creditsData.remainingCredits]);

  console.log({
    creditBalance,
    creditsData,
    app: {
      credit_balance: app.credit_balance,
      credit_used: app.credit_used,
      fallback_credit_used: app.fallback_credit_used,
      credit_selection: app.credit_selection,
    },
  });

  return (
    <div
      className={cn(
        "w-full p-4 rounded-lg border border-solid relative overflow-hidden",
        isNearExhaustion ? "border-[#425C72]" : "border-border-blue",
      )}
      style={
        isNearExhaustion
          ? {
              background: "rgba(207, 102, 121, 0.16)",
              boxShadow: "4px 4px 23.1px 0 rgba(207, 102, 121, 0.32) inset",
            }
          : {}
      }
    >
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

        <div className="flex items-start justify-between flex-1">
          <div className="flex flex-col justify-between">
            <div className="flex items-center gap-x-1.5">
              <Text weight={"semibold"}>{app.app_name}</Text>
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
          <Menubar className="border-none p-0 items-start">
            <MenubarMenu>
              <MenubarTrigger className="p-0" asChild>
                <EllipsisVertical
                  color="#B3B3B3"
                  size={20}
                  className="cursor-pointer"
                />
              </MenubarTrigger>
              <MenubarContent className="w-52 border border-border-blue bg-[#112235] p-0 rounded-lg overflow-hidden">
                <MenubarGroup>
                  <MenubarItem
                    onClick={toggleEncryption}
                    className="flex gap-x-1.5 group hover:bg-[#2b47613d] cursor-pointer rounded-none items-center p-2 border-b border-b-border-blue"
                  >
                    <KeyRound
                      className="text-[#B3B3B3] group-hover:text-white"
                      strokeWidth={2}
                      size={24}
                    />
                    <Text weight={"semibold"}>
                      {app.encryption ? "Disable" : "Enable"} Encryption
                    </Text>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      generateApiKey();
                      setDisplayAPIKey(true);
                    }}
                    className="flex gap-x-1.5 group hover:bg-[#2b47613d] cursor-pointer rounded-none items-center p-2 border-b border-b-border-blue"
                  >
                    <KeyRound
                      className="text-[#B3B3B3] group-hover:text-white"
                      strokeWidth={2}
                      size={24}
                    />
                    <Text weight={"semibold"}>Generate API Key</Text>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      apiKeys?.[app.id]?.length && setOpen("view-key" + app.id);
                    }}
                    className={cn(
                      "flex gap-x-1.5 group hover:bg-[#2b47613d] rounded-none items-center p-2 border-b border-b-border-blue",
                      apiKeys?.[app.id]?.length
                        ? "cursor-pointer"
                        : "cursor-not-allowed",
                    )}
                  >
                    <Eye
                      className={cn(
                        "text-[#B3B3B3]",
                        apiKeys?.[app.id]?.length
                          ? "group-hover:text-white"
                          : "opacity-40",
                      )}
                      strokeWidth={2}
                      size={24}
                    />
                    <Text
                      weight={"semibold"}
                      className={cn(!apiKeys?.[app.id]?.length && "opacity-30")}
                    >
                      View All Keys
                    </Text>
                    {apiKeys?.[app.id]?.length ? (
                      <Text
                        size={"xs"}
                        weight={"semibold"}
                        className="rounded-full bg-[#2b47613d] border border-border-blue h-6 flex justify-center items-center px-[5px] pt-0.5"
                      >
                        {apiKeys?.[app.id]?.length}
                      </Text>
                    ) : null}
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => setOpen("manage-credits" + app.id)}
                    className="flex gap-x-1.5 group hover:bg-[#2b47613d] cursor-pointer rounded-none items-center p-2 border-b border-b-border-blue"
                  >
                    <ScrollText
                      className="text-[#B3B3B3] group-hover:text-white"
                      strokeWidth={2}
                      size={24}
                    />
                    <Text weight={"semibold"}>Manage Credits</Text>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => setOpen("update-app" + app.id)}
                    className="flex gap-x-1.5 group hover:bg-[#2b47613d] cursor-pointer rounded-none items-center p-2 border-b border-b-border-blue"
                  >
                    <Pencil
                      size={24}
                      className="text-[#B3B3B3] group-hover:text-white"
                    />
                    <Text
                      weight={"semibold"}
                      className="group-hover:text-white"
                    >
                      Edit App
                    </Text>
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => setOpen("delete-app-alert" + app.id)}
                    className="flex gap-x-1.5 group hover:bg-[#2b47613d] cursor-pointer rounded-none items-center p-2"
                  >
                    <Trash2
                      size={24}
                      className="text-[#B3B3B3] group-hover:text-white"
                    />
                    <Text
                      weight={"semibold"}
                      className="group-hover:text-white"
                    >
                      Delete App
                    </Text>
                  </MenubarItem>
                </MenubarGroup>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        </div>
      </div>
      {creditsData.mode === "main-balance" ? (
        <div className="mt-2">
          <Text size={"sm"} weight={"semibold"}>
            {formatDataBytes(creditsData.usedCredit || 0)} credits used from
            main balance
          </Text>
        </div>
      ) : null}
      {creditsData.mode === "assigned-credits" ? (
        <div className="flex flex-col w-full items-start gap-2 mt-2">
          {/* Show different text based on exhaustion state */}
          {isFullyExhausted && app?.credit_selection === 2 ? (
            <Text size={"sm"} weight={"semibold"}>
              {formatDataBytes(creditsData.totalCredit)} credits used of{" "}
              {formatDataBytes(creditsData.totalCredit)} assigned.{" "}
            </Text>
          ) : (
            <Text size={"sm"} weight={"semibold"}>
              {formatDataBytes(creditsData.usedCredit)} credits used of{" "}
              {formatDataBytes(creditsData.totalCredit)} assigned.{" "}
              {!isFullyExhausted &&
                `${formatDataBytes(creditsData.remainingCredits)} left.`}
            </Text>
          )}

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-md bg-[#2B4761]">
            <div
              className={cn(
                "h-1.5 rounded-md transition-all duration-300 ease-in-out",
                isFullyExhausted && app?.credit_selection === 0 && "opacity-40",
              )}
              style={{
                width: `${progress}%`,
                backgroundColor:
                  isFullyExhausted && app?.credit_selection === 2
                    ? "#1FC16B"
                    : "#FF82C8",
              }}
            />
          </div>

          {/* Show fallback text or main balance usage */}
          {app?.credit_selection === 2 ? (
            +app.fallback_credit_used > 0 ? (
              <Text size={"xs"} weight={"medium"} variant={"light-grey"}>
                {formatDataBytes(+app.fallback_credit_used)} credits used from
                main balance
              </Text>
            ) : (
              <Text size={"xs"} weight={"medium"} variant={"light-grey"}>
                Main credits will be used as fallback
              </Text>
            )
          ) : null}
        </div>
      ) : null}
      {creditsData.mode === "main-balance" && +creditBalance ? (
        <div className="flex gap-x-1 border border-[#1FC16B] bg-[#1FC16B1A] py-0.5 px-2 rounded-full w-fit items-center mt-3">
          <div className="h-1.5 w-1.5 rounded-full bg-green" />
          <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
            Using Main Credit Balance
          </Text>
        </div>
      ) : null}
      {creditsData.mode === "assigned-credits" ? (
        <div className="flex flex-col gap-2 mt-3">
          <div className="flex gap-[12px]">
            {/* Fully exhausted or no assigned credits without fallback - show yellow warning */}
            {((isFullyExhausted && app?.credit_selection === 0) ||
              (app?.credit_selection === 0 &&
                creditsData.totalCredit === 0)) && (
              <div className="flex gap-x-1 border border-[#E4A354CC] bg-[#E4A35429] py-0.5 px-2 rounded-full w-fit items-center">
                <div className="h-1.5 w-1.5 rounded-full bg-[#E4A354]" />
                <Text
                  weight={"semibold"}
                  size={"xs"}
                  className="uppercase mt-0.5"
                >
                  App Inactive — Please Assign Some Or Use Main Balance
                </Text>
              </div>
            )}

            {/* Fully exhausted with fallback - show green fallback label */}
            {isFullyExhausted && app?.credit_selection === 2 && (
              <div className="flex gap-x-1 border border-[#1FC16B] bg-[#1FC16B1A] py-0.5 px-2 rounded-full w-fit items-center">
                <div className="h-1.5 w-1.5 rounded-full bg-green" />
                <Text
                  weight={"semibold"}
                  size={"xs"}
                  className="uppercase mt-0.5"
                >
                  Using Main Credit Balance as fallback
                </Text>
              </div>
            )}

            {/* Near exhaustion without fallback - show red warning */}
            {!isFullyExhausted &&
              isNearExhaustion &&
              app?.credit_selection === 0 && (
                <div className="flex gap-x-1 border border-[#CF6679] bg-[#CF667929] py-0.5 px-2 rounded-full w-fit items-center">
                  <AlertTriangle size={12} color="#CF6679" />
                  <Text
                    weight={"semibold"}
                    size={"xs"}
                    className="uppercase mt-0.5"
                  >
                    Assigned Credits near exhaustion!
                  </Text>
                </div>
              )}

            {/* Normal state - show regular labels */}
            {!isFullyExhausted && !isNearExhaustion && (
              <>
                <div
                  className="flex gap-x-1 py-0.5 px-2 w-fit items-center"
                  style={{
                    borderRadius: "24px",
                    border: "1px solid #FF82C8",
                    background: "rgba(255, 130, 200, 0.16)",
                  }}
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-[#FF82C8]" />
                  <Text
                    weight={"semibold"}
                    size={"xs"}
                    className="uppercase mt-0.5"
                  >
                    Using Assigned Credits
                  </Text>
                </div>
                {app?.credit_selection === 2 && (
                  <div className="flex gap-x-1 border border-[#1FC16B] bg-[#1FC16B1A] py-0.5 px-2 rounded-full w-fit items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-green" />
                    <Text
                      weight={"semibold"}
                      size={"xs"}
                      className="uppercase mt-0.5"
                    >
                      Fallback enabled
                    </Text>
                  </div>
                )}
              </>
            )}
          </div>
          {!isFullyExhausted &&
            isNearExhaustion &&
            app?.credit_selection === 0 && (
              <Text size={"xs"} weight={"medium"} variant={"light-grey"}>
                Assign more credits or use main balance else your app might stop
                working.
              </Text>
            )}
        </div>
      ) : null}
      {!+creditBalance &&
      creditsData.mode === "main-balance" &&
      creditsData.totalCredit === 0 ? (
        <div className="flex gap-x-1 border border-[#CF6679] bg-[#CF667929] py-0.5 px-2 rounded-full w-fit items-center mt-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#CF6679]" />
          <Text weight={"semibold"} size={"xs"} className="uppercase mt-0.5">
            Credits Null — Please BUY Some TO POST data
          </Text>
        </div>
      ) : null}
      <div
        className={cn(
          "absolute transition-all duration-500 bg-[#13334F] w-full left-0 p-4 flex gap-y-1 flex-col border-t border-border-blue",
          displayAPIKey ? "bottom-0" : "-bottom-32",
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
      {open === "manage-credits" + app.id && (
        <ManageCredits id={"manage-credits" + app.id} appData={app} />
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
            updateFallbackHandler(1); // Switch to main balance (credit_selection: 1)
            setOpen("");
          }}
        />
      )}
    </div>
  );
};

export default memo(AppItem);
