"use client";
import Button from "@/components/button";
import { DialogTitle } from "@/components/dialog";
import { useDialog } from "@/components/dialog/provider";
import PrimaryInput from "@/components/input/primary";
import AvatarWrapper from "@/components/lottie-comp/avatar-container";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import useApp from "@/hooks/useApp";
import { avatarList } from "@/lib/constant";
import { baseImageUrl } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, Lock, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

type EnableEncryptionDialogProps = {
  id: string;
  appData: AppDetails;
};

export default function EnableEncryptionDialog({
  id,
  appData,
}: EnableEncryptionDialogProps) {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const [participants, setParticipants] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const { updateAppList } = useApp();
  const { success, error: errorToast } = useAppToast();

  const participantsList = useMemo(() => {
    return participants
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [participants]);

  const isValid = useMemo(() => {
    if (participantsList.length === 0) return false;
    const thresholdNum = parseInt(threshold, 10);
    if (isNaN(thresholdNum) || thresholdNum < 1) return false;
    if (thresholdNum > participantsList.length) return false;
    return true;
  }, [participantsList, threshold]);

  const handleSubmit = async () => {
    if (!token || !isValid) return;

    try {
      setLoading(true);
      const thresholdNum = parseInt(threshold, 10);

      await AppService.toggleEncryption({
        token,
        appId: appData.id,
        participants: participantsList,
        threshold: thresholdNum,
      });

      success({
        label: "Encryption enabled successfully",
        description: `Added ${participantsList.length} participants with threshold ${thresholdNum}`,
      });
      updateAppList();
      setOpen("");
      setParticipants("");
      setThreshold("1");
    } catch (error: any) {
      errorToast({
        label: error.message || "Failed to enable encryption",
      });
    } finally {
      setLoading(false);
    }
  };

  const validationError = useMemo(() => {
    if (participantsList.length === 0) {
      return "Please enter at least one participant address";
    }
    const thresholdNum = parseInt(threshold, 10);
    if (isNaN(thresholdNum) || thresholdNum < 1) {
      return "Threshold must be at least 1";
    }
    if (thresholdNum > participantsList.length) {
      return `Threshold cannot exceed number of participants (${participantsList.length})`;
    }
    return "";
  }, [participantsList, threshold]);

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="min-w-[600px] h-auto max-h-[90vh] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative h-full flex flex-col p-4 z-1">
            <div className="flex justify-between items-center mb-4 relative z-1">
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <Lock size={24} />
                  <Text weight={"bold"} size={"2xl"}>
                    Enable Encryption
                  </Text>
                </div>
              </DialogTitle>

              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </div>

            <div className="flex flex-col gap-4 flex-1 relative z-1">
              {/* App Info */}
              <div className="flex items-center gap-2 p-3 border border-border-blue rounded-lg bg-black/20">
                {appData?.app_logo?.includes(".") ? (
                  <Image
                    className="w-8 h-8 rounded"
                    alt={appData.app_name}
                    src={baseImageUrl(appData.app_logo)}
                    width={32}
                    height={32}
                  />
                ) : (
                  <div className="w-8 rounded overflow-hidden">
                    {avatarList?.[appData?.app_logo]?.path ? (
                      <AvatarWrapper
                        path={avatarList?.[appData?.app_logo]?.path}
                        width={32}
                        height={32}
                      />
                    ) : null}
                  </div>
                )}
                <div className="flex flex-col">
                  <Text weight={"semibold"}>{appData.app_name}</Text>
                  <Text size={"xs"} variant={"light-grey"}>
                    App ID: {appData.app_id}
                  </Text>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 border border-border-blue rounded-lg bg-[#2b47611a]">
                <Text size={"sm"} variant={"light-grey"}>
                  Enable threshold encryption for this app. Participants will need
                  to sign decryption requests. You must provide at least one
                  participant address.
                </Text>
              </div>

              {/* Participants Input */}
              <PrimaryInput
                label="Participants (Required)"
                placeholder="0x123..., 0x456..., 0x789..."
                value={participants}
                onChange={setParticipants}
                className="px-0 text-white w-full"
              />
              <Text size={"xs"} variant={"light-grey"} className="-mt-2">
                Enter comma-separated Ethereum addresses that can sign decryption
                requests
              </Text>

              {/* Threshold Input */}
              <PrimaryInput
                label="Threshold"
                placeholder="e.g. 2"
                value={threshold}
                onChange={(value) => {
                  if (value === "" || /^\d+$/.test(value)) {
                    setThreshold(value);
                  }
                }}
                className="px-0 text-white w-full"
                error={validationError}
              />
              <Text size={"xs"} variant={"light-grey"} className="-mt-2">
                Minimum number of signatures required to decrypt (must be &le;{" "}
                {participantsList.length || "number of participants"})
              </Text>

              {/* Participant Count */}
              {participantsList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {participantsList.map((p, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue/20 text-blue text-xs rounded-full"
                    >
                      {p.slice(0, 6)}...{p.slice(-4)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 relative z-1">
              <Button
                variant={!isValid ? "disabled" : "primary"}
                disabled={loading || !isValid}
                onClick={handleSubmit}
              >
                {loading ? (
                  <LoaderCircle
                    className="animate-spin mx-auto"
                    color="#fff"
                    size={24}
                  />
                ) : !isValid ? (
                  "Enter Participants"
                ) : (
                  "Enable Encryption"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
