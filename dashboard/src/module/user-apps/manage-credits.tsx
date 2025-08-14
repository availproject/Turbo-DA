import Button from "@/components/button";
import useApp from "@/hooks/useApp";
import useBalance from "@/hooks/useBalance";
import { avatarList } from "@/lib/constant";
import {
  baseImageUrl,
  cn,
  formatDataBytes,
  formatInBytes,
  formatInKB,
} from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import PrimaryProgress from "@/components/progress/primary-progress";
import { DialogTitle } from "../../components/dialog";
import { useDialog } from "../../components/dialog/provider";
import PrimaryInput from "../../components/input/primary";
import { RadioButton } from "../../components/input/radio";
import AvatarWrapper from "../../components/lottie-comp/avatar-container";
import { Text } from "../../components/text";
import { useAppToast } from "../../components/toast";
import { Dialog, DialogContent } from "../../components/ui/dialog";

type ManageCreditsProps = {
  id: string;
  appData: AppDetails;
};

export default function ManageCredits({ id, appData }: ManageCreditsProps) {
  const { open, setOpen } = useDialog();
  const { creditBalance } = useOverview();
  const { token } = useConfig();
  const { updateCreditBalance } = useBalance();
  const { updateAppList } = useApp();
  const { success } = useAppToast();

  const assignedCreditsLeft = +appData.credit_balance || 0;
  const totalCreditsUsed = +appData.credit_used + +appData.fallback_credit_used;
  const totalAssignedCredits = assignedCreditsLeft + +appData.credit_used;

  const [selectedOption, setSelectedOption] = useState(() => {
    if (assignedCreditsLeft > 0) {
      return appData.fallback_enabled ? "assigned-with-fallback" : "assigned-credits";
    }
    return "main-balance";
  });
  const [activeTab, setActiveTab] = useState("assign");
  const [assignAmount, setAssignAmount] = useState("");
  const [unassignAmount, setUnassignAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSwitchWarning, setShowSwitchWarning] = useState(false);
  const [pendingOption, setPendingOption] = useState<string | null>(null);

  const assignInvalid = useMemo(() => {
    return (
      !assignAmount ||
      !creditBalance ||
      creditBalance < formatInBytes(+assignAmount)
    );
  }, [assignAmount, creditBalance]);

  const unassignInvalid = useMemo(() => {
    return (
      !unassignAmount ||
      !assignedCreditsLeft ||
      assignedCreditsLeft < formatInBytes(+unassignAmount)
    );
  }, [unassignAmount, assignedCreditsLeft]);

  const handleAssignCredits = async () => {
    if (!token || assignInvalid) return;
    try {
      setLoading(true);
      const response = await AppService.assignCredits({
        token,
        amount: `${formatInBytes(+assignAmount)}`,
        appId: appData.id,
      });

      if (response?.state === "SUCCESS") {
        success({
          label: "Credits Assigned Successfully!",
          description: `${assignAmount} credits successfully assigned from main credit balance`,
        });
        updateCreditBalance();
        updateAppList();
        setAssignAmount("");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignCredits = async () => {
    if (!token || unassignInvalid) return;
    try {
      setLoading(true);
      const response = await AppService.reclaimCredits({
        token,
        amount: `${formatInBytes(+unassignAmount)}`,
        appId: appData.id,
      });

      if (response?.state === "SUCCESS") {
        success({
          label: "Credits Unassigned Successfully!",
          description: `${unassignAmount} credits successfully returned to main credit balance`,
        });
        updateCreditBalance();
        updateAppList();
        setUnassignAmount("");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (newOption: string) => {
    // If switching to main balance from any assigned credit option
    if (newOption === "main-balance" && assignedCreditsLeft > 0) {
      setPendingOption(newOption);
      setShowSwitchWarning(true);
      return;
    }

    // If switching between assigned credit options and user has assigned credits
    if ((newOption === "assigned-credits" || newOption === "assigned-with-fallback") && 
        (selectedOption === "assigned-credits" || selectedOption === "assigned-with-fallback") &&
        selectedOption !== newOption && assignedCreditsLeft > 0) {
      setPendingOption(newOption);
      setShowSwitchWarning(true);
      return;
    }

    // For all other cases, switch directly
    setSelectedOption(newOption);
  };

  const handleConfirmSwitch = async () => {
    if (!token || !pendingOption) return;

    try {
      setLoading(true);

      // If switching to main balance, unassign all credits
      if (pendingOption === "main-balance" && assignedCreditsLeft > 0) {
        const response = await AppService.reclaimCredits({
          token,
          amount: `${assignedCreditsLeft}`, // Use raw bytes, not formatted
          appId: appData.id,
        });

        if (response?.state === "SUCCESS") {
          success({
            label: "Switched to Main Balance!",
            description: `All assigned credits returned to main balance`,
          });
          updateCreditBalance();
          updateAppList();
        }
      } else if (pendingOption === "assigned-credits" || pendingOption === "assigned-with-fallback") {
        // For switching between assigned credit options, just update the fallback setting
        const fallbackEnabled = pendingOption === "assigned-with-fallback";
        const response = await AppService.updateApp({
          token,
          appId: appData.app_id,
          appName: appData.app_name,
          avatar: appData.app_logo,
          id: appData.id,
          fallbackEnabled,
        });

        if (response) {
          success({
            label: "Credit Option Updated!",
            description: `Switched to ${pendingOption === "assigned-credits" ? "assigned credits only" : "assigned credits with fallback"}`,
          });
          updateAppList();
        }
      }

      // Switch to the new option
      setSelectedOption(pendingOption);
      setShowSwitchWarning(false);
      setPendingOption(null);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl ">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative h-full flex flex-col p-4 z-1 ">
            {/* fix this header to top */}
            <div className="flex justify-between items-center mb-6 sticky z-1 top-0 ">
              <DialogTitle className="">
                <Text weight={"bold"} size={"2xl"}>
                  Manage Credits
                </Text>
              </DialogTitle>
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </div>

            <div className="flex flex-col gap-6 flex-1 relative z-1 overflow-y-auto">
              {/* Credit Information Row */}
              <div className="flex items-center justify-between w-full bg-[#2B4761]/24 py-4 px-6">
                <div className="flex flex-col items-center">
                  <Text size={"sm"} variant={"light-grey"}>
                    Main Credit Balance
                  </Text>
                  <Text size={"lg"} weight={"bold"}>
                    {formatInKB(creditBalance).fixedValue}
                  </Text>
                </div>
                <div className="flex flex-col items-center">
                  <Text size={"sm"} variant={"light-grey"}>
                    Assigned Credit Left
                  </Text>
                  <Text size={"lg"} weight={"bold"}>
                    {totalAssignedCredits > 0
                      ? `${formatInKB(assignedCreditsLeft).fixedValue}/${
                          formatInKB(totalAssignedCredits).fixedValue
                        }`
                      : "-"}
                  </Text>
                </div>
                <div className="flex flex-col items-center">
                  <Text size={"sm"} variant={"light-grey"}>
                    Total Credit Used
                  </Text>
                  <Text size={"lg"} weight={"bold"}>
                    {formatInKB(totalCreditsUsed).fixedValue}
                  </Text>
                </div>
              </div>

              {/* App Information */}
              <div className="flex items-center gap-3 p-3 border border-border-blue rounded-lg">
                <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                  {appData?.app_logo?.includes(".") ? (
                    <Image
                      className="w-10 h-10 rounded"
                      alt={appData.app_name}
                      src={baseImageUrl(appData.app_logo)}
                      width={40}
                      height={40}
                    />
                  ) : (
                    <div className="w-10 rounded overflow-hidden">
                      {avatarList?.[appData?.app_logo]?.path ? (
                        <AvatarWrapper
                          path={avatarList?.[appData?.app_logo]?.path}
                          width={40}
                          height={40}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <Text weight={"semibold"}>{appData.app_name}</Text>
                  <div className="flex items-center gap-1.5">
                    <Text variant={"light-grey"} weight={"medium"} size={"sm"}>
                      App ID:
                    </Text>
                    <Text size={"sm"} weight={"bold"}>
                      {appData.app_id}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Credit Options */}
              <div className="flex flex-col gap-4">
                <Text size={"base"} weight={"medium"}>
                  How should this app use credits?
                </Text>

                <div className="flex flex-col gap-3">
                  {/* Option 1: Use main credit balance */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <RadioButton
                      name="credit-option"
                      value="main-balance"
                      checked={selectedOption === "main-balance"}
                      onChange={() => handleOptionChange("main-balance")}
                    />
                    <Text size={"sm"}>Use main credit balance</Text>
                  </label>

                  {/* Option 2: Use assigned credits */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <RadioButton
                      name="credit-option"
                      value="assigned-credits"
                      checked={selectedOption === "assigned-credits"}
                      onChange={() => handleOptionChange("assigned-credits")}
                    />
                    <Text size={"sm"}>Use assigned credits</Text>
                  </label>

                  {/* Option 3: Use assigned credit with fallback enabled */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <RadioButton
                      name="credit-option"
                      value="assigned-with-fallback"
                      checked={selectedOption === "assigned-with-fallback"}
                      onChange={() =>
                        handleOptionChange("assigned-with-fallback")
                      }
                    />
                    <Text size={"sm"}>
                      Use assigned credit with fallback enabled
                    </Text>
                  </label>
                </div>

                {/* Green card for main balance option */}
                {selectedOption === "main-balance" && (
                  <div
                    className="p-4 rounded-lg mt-4"
                    style={{
                      borderRadius: "8px",
                      background: "rgba(120, 196, 123, 0.16)",
                    }}
                  >
                    <Text size={"base"} weight={"medium"}>
                      Only main balance will be used by this app.
                    </Text>
                  </div>
                )}

                {/* Green card for assigned credits option */}
                {selectedOption === "assigned-credits" && (
                  <>
                    <div
                      className="p-4 rounded-lg mt-4"
                      style={{
                        borderRadius: "8px",
                        background: "rgba(120, 196, 123, 0.16)",
                      }}
                    >
                      <Text size={"base"} weight={"medium"}>
                        Assign credits from the main balance. Only credits you
                        assign would be used by this app. You can also unassign
                        credits if no longer required.
                      </Text>
                    </div>
                    {/* Tabs */}
                    <div className="flex border-b border-border-blue mb-4 w-full">
                      <button
                        className={`px-4 py-2 text-sm font-medium w-full ${
                          activeTab === "assign"
                            ? "border-b-2 border-blue-500 text-white"
                            : "text-gray-400"
                        }`}
                        onClick={() => setActiveTab("assign")}
                      >
                        Assign Credits
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium w-full ${
                          activeTab === "unassign"
                            ? "border-b-2 border-blue-500 text-white"
                            : "text-gray-400"
                        } ${
                          assignedCreditsLeft === 0
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        onClick={() =>
                          assignedCreditsLeft > 0 && setActiveTab("unassign")
                        }
                        disabled={assignedCreditsLeft === 0}
                      >
                        Unassign Credits
                      </button>
                    </div>

                    {/* Assign Credits Tab */}
                    {activeTab === "assign" && (
                      <div className="space-y-4">
                        <Text size={"sm"} weight={"medium"}>
                          How much would you like to assign?
                        </Text>
                        <div className="flex items-center gap-2">
                          <div className="w-full">
                            <PrimaryInput
                              placeholder="e.g. 500"
                              value={assignAmount}
                              onChange={(value) => {
                                if (value === "") {
                                  setAssignAmount("");
                                  return;
                                }
                                const validValue = /^\d+(\.\d*)?$/.test(value);
                                if (validValue) {
                                  setAssignAmount(value);
                                }
                              }}
                              className="px-0 text-white w-full"
                              rightElement={
                                <button
                                  onClick={() => {
                                    const formatBytes =
                                      formatInKB(creditBalance);
                                    setAssignAmount(
                                      String(formatBytes.fixedValue)
                                    );
                                  }}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#425C72] bg-[rgba(43,71,97,0.24)] text-xs font-medium text-white uppercase hover:bg-[rgba(43,71,97,0.35)] transition-colors"
                                >
                                  MAX
                                </button>
                              }
                              error={
                                creditBalance < formatInBytes(+assignAmount)
                                  ? `Amount should be less than main credit balance.`
                                  : ""
                              }
                            />
                          </div>

                          <Button
                            variant={assignInvalid ? "disabled" : "primary"}
                            disabled={loading || assignInvalid}
                            onClick={handleAssignCredits}
                            className="px-4 py-2 w-[146px]"
                          >
                            {loading ? (
                              <LoaderCircle
                                className="animate-spin mx-auto"
                                size={16}
                              />
                            ) : (
                              "Assign"
                            )}
                          </Button>
                        </div>
                        <Text size={"xs"} variant={"light-grey"}>
                          Available credits:{" "}
                          {formatInKB(creditBalance).fixedValue}
                        </Text>
                      </div>
                    )}

                    {/* Unassign Credits Tab */}
                    {activeTab === "unassign" && (
                      <div className="space-y-4">
                        <Text size={"sm"} weight={"medium"}>
                          How much would you like to unassign?
                        </Text>
                        <div className="flex items-center gap-2">
                          <div className="w-full">
                            <PrimaryInput
                              placeholder="e.g. 200"
                              value={unassignAmount}
                              onChange={(value) => {
                                if (value === "") {
                                  setUnassignAmount("");
                                  return;
                                }
                                const validValue = /^\d+(\.\d*)?$/.test(value);
                                if (validValue) {
                                  setUnassignAmount(value);
                                }
                              }}
                              className="px-0 text-white w-full"
                              rightElement={
                                <button
                                  onClick={() => {
                                    const formatBytes =
                                      formatInKB(assignedCreditsLeft);
                                    setUnassignAmount(
                                      String(formatBytes.fixedValue)
                                    );
                                  }}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#425C72] bg-[rgba(43,71,97,0.24)] text-xs font-medium text-white uppercase hover:bg-[rgba(43,71,97,0.35)] transition-colors"
                                >
                                  MAX
                                </button>
                              }
                              error={
                                assignedCreditsLeft <
                                formatInBytes(+unassignAmount)
                                  ? `Amount should be less than assigned credits.`
                                  : ""
                              }
                            />
                          </div>

                          <Button
                            variant={unassignInvalid ? "disabled" : "primary"}
                            disabled={loading || unassignInvalid}
                            onClick={handleUnassignCredits}
                            className="px-4 py-2 w-[146px]"
                          >
                            {loading ? (
                              <LoaderCircle
                                className="animate-spin mx-auto"
                                size={16}
                              />
                            ) : (
                              "Unassign"
                            )}
                          </Button>
                        </div>
                        <Text size={"xs"} variant={"light-grey"}>
                          Available credits:{" "}
                          {formatInKB(assignedCreditsLeft).fixedValue}
                        </Text>
                      </div>
                    )}
                  </>
                )}

                {/* Green card for assigned credits with fallback option */}
                {selectedOption === "assigned-with-fallback" && (
                  <>
                    <div
                      className="p-4 rounded-lg mt-4"
                      style={{
                        borderRadius: "8px",
                        background: "rgba(120, 196, 123, 0.16)",
                      }}
                    >
                      <Text size={"base"} weight={"medium"}>
                        Assign credits from the main balance. First assigned
                        credits would be used by this app, on exhaustion, main
                        balance credits would be used as fallback.
                      </Text>
                    </div>
                    {/* Tabs */}
                    <div className="flex border-b border-border-blue mb-4 w-full">
                      <button
                        className={`px-4 py-2 text-sm font-medium w-full ${
                          activeTab === "assign"
                            ? "border-b-2 border-blue-500 text-white"
                            : "text-gray-400"
                        }`}
                        onClick={() => setActiveTab("assign")}
                      >
                        Assign Credits
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium w-full ${
                          activeTab === "unassign"
                            ? "border-b-2 border-blue-500 text-white"
                            : "text-gray-400"
                        } ${
                          assignedCreditsLeft === 0
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        onClick={() =>
                          assignedCreditsLeft > 0 && setActiveTab("unassign")
                        }
                        disabled={assignedCreditsLeft === 0}
                      >
                        Unassign Credits
                      </button>
                    </div>

                    {/* Assign Credits Tab */}
                    {activeTab === "assign" && (
                      <div className="space-y-4">
                        <Text size={"sm"} weight={"medium"}>
                          How much would you like to assign?
                        </Text>
                        <div className="flex items-center gap-2">
                          <div className="w-full">
                            <PrimaryInput
                              placeholder="e.g. 500"
                              value={assignAmount}
                              onChange={(value) => {
                                if (value === "") {
                                  setAssignAmount("");
                                  return;
                                }
                                const validValue = /^\d+(\.\d*)?$/.test(value);
                                if (validValue) {
                                  setAssignAmount(value);
                                }
                              }}
                              className="px-0 text-white w-full"
                              rightElement={
                                <button
                                  onClick={() => {
                                    const formatBytes =
                                      formatInKB(creditBalance);
                                    setAssignAmount(
                                      String(formatBytes.fixedValue)
                                    );
                                  }}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#425C72] bg-[rgba(43,71,97,0.24)] text-xs font-medium text-white uppercase hover:bg-[rgba(43,71,97,0.35)] transition-colors"
                                >
                                  MAX
                                </button>
                              }
                              error={
                                creditBalance < formatInBytes(+assignAmount)
                                  ? `Amount should be less than main credit balance.`
                                  : ""
                              }
                            />
                          </div>

                          <Button
                            variant={assignInvalid ? "disabled" : "primary"}
                            disabled={loading || assignInvalid}
                            onClick={handleAssignCredits}
                            className="px-4 py-2 w-[146px]"
                          >
                            {loading ? (
                              <LoaderCircle
                                className="animate-spin mx-auto"
                                size={16}
                              />
                            ) : (
                              "Assign"
                            )}
                          </Button>
                        </div>
                        <Text size={"xs"} variant={"light-grey"}>
                          Available credits:{" "}
                          {formatInKB(creditBalance).fixedValue}
                        </Text>
                      </div>
                    )}

                    {/* Unassign Credits Tab */}
                    {activeTab === "unassign" && (
                      <div className="space-y-4">
                        <Text size={"sm"} weight={"medium"}>
                          How much would you like to unassign?
                        </Text>
                        <div className="flex items-center gap-2">
                          <div className="w-full">
                            <PrimaryInput
                              placeholder="e.g. 200"
                              value={unassignAmount}
                              onChange={(value) => {
                                if (value === "") {
                                  setUnassignAmount("");
                                  return;
                                }
                                const validValue = /^\d+(\.\d*)?$/.test(value);
                                if (validValue) {
                                  setUnassignAmount(value);
                                }
                              }}
                              className="px-0 text-white w-full"
                              rightElement={
                                <button
                                  onClick={() => {
                                    const formatBytes =
                                      formatInKB(assignedCreditsLeft);
                                    setUnassignAmount(
                                      String(formatBytes.fixedValue)
                                    );
                                  }}
                                  className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-[#425C72] bg-[rgba(43,71,97,0.24)] text-xs font-medium text-white uppercase hover:bg-[rgba(43,71,97,0.35)] transition-colors"
                                >
                                  MAX
                                </button>
                              }
                              error={
                                assignedCreditsLeft <
                                formatInBytes(+unassignAmount)
                                  ? `Amount should be less than assigned credits.`
                                  : ""
                              }
                            />
                          </div>

                          <Button
                            variant={unassignInvalid ? "disabled" : "primary"}
                            disabled={loading || unassignInvalid}
                            onClick={handleUnassignCredits}
                            className="px-4 py-2 w-[146px]"
                          >
                            {loading ? (
                              <LoaderCircle
                                className="animate-spin mx-auto"
                                size={16}
                              />
                            ) : (
                              "Unassign"
                            )}
                          </Button>
                        </div>
                        <Text size={"xs"} variant={"light-grey"}>
                          Available credits:{" "}
                          {formatInKB(assignedCreditsLeft).fixedValue}
                        </Text>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Switch Warning */}
            <div
              className={cn(
                "absolute transition-all duration-500 bg-[#13334F] w-full left-0 p-4 flex gap-y-3 flex-col border-t border-border-blue z-10",
                showSwitchWarning ? "bottom-0" : "-bottom-50"
              )}
            >
              <div className="flex justify-between items-start">
                <Text size={"lg"} weight={"bold"}>
                  {pendingOption === "main-balance" 
                    ? "Switch to main balance?" 
                    : pendingOption === "assigned-credits"
                    ? "Switch to assigned credits only?"
                    : "Switch to assigned credits with fallback?"
                  }
                </Text>
                <X
                  size={22}
                  color="#fff"
                  className="cursor-pointer"
                  onClick={() => {
                    setShowSwitchWarning(false);
                    setPendingOption(null);
                  }}
                />
              </div>

              <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
                {pendingOption === "main-balance" 
                  ? "You've already assigned credits to this app. Switching to main balance will unassign those credits and return them to your main balance."
                  : pendingOption === "assigned-credits"
                  ? "You've already assigned credits to this app. Switching to assigned credits only will disable the main balance fallback for this app."
                  : "You've already assigned credits to this app. Switching to assigned credits with fallback will enable main balance as backup when assigned credits are exhausted."
                }
              </Text>

              <div className="flex gap-3 mt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowSwitchWarning(false);
                    setPendingOption(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSwitch}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin mx-auto" size={16} />
                  ) : (
                    "Switch"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
