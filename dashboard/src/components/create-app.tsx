"use client";
import Button from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import useApp from "@/hooks/useApp";
import { baseImageUrl } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, X } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useCallback, useRef, useState } from "react";
import { Text } from ".//text";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";
import AvatarList from "./lottie-comp/avatar-list";
import { useAppToast } from "./toast";

type CreateAppProps = {
  type?: "create" | "edit";
  appData?: AppDetails;
  id?: string;
};

export default function CreateApp({
  type = "create",
  appData,
  id,
}: CreateAppProps) {
  const [appName, setAppName] = useState(appData?.app_name || "");
  const [appId, setAppId] = useState(appData?.app_id || "");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedAvatar, setUploadedAvatar] = useState<File>();
  const [previewUploadedAvatar, setPreviewUploadedAvatar] = useState<string>();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    appData?.app_logo ?? ""
  );
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const { updateAppList } = useApp();
  const { success, error: failure } = useAppToast();

  const saveAppDetails = useCallback(async () => {
    if ((!selectedAvatar && !previewUploadedAvatar) || !appId || !appName) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    try {
      const uploadAvatar = uploadedAvatar
        ? await AppService.uploadFile({
            token: token!,
            file: uploadedAvatar!,
          })
            .then((response) => {
              return response?.file;
            })
            .catch((error) => {
              setLoading(false);
              return undefined;
            })
        : selectedAvatar;

      if (!uploadAvatar) return;

      const response =
        type === "edit"
          ? await AppService.updateApp({
              token: token!,
              appId: +appData?.app_id!,
              appName,
              avatar: uploadAvatar,
              id: appData?.id!,
              fallbackEnabled: appData?.fallback_enabled,
            })
          : await AppService.createApp({
              token: token!,
              appId: +appId!,
              appName,
              avatar: uploadAvatar,
            });

      if (response.state !== "SUCCESS") {
        setLoading(false);
        failure({ label: response?.message ?? "Failed to create app" });
        return;
      }

      updateAppList();
      success({
        label:
          type === "edit" ? "Updated Successfully!" : "Created Successfully!",
      });
      setOpen("");
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [token, selectedAvatar, appId, appName, previewUploadedAvatar]);

  const handleClick = () => inputRef.current?.click();

  const convertImageToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);

      reader.onerror = (error) => reject(error);

      reader.readAsDataURL(file);
    });

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploadedAvatar(e.target.files?.[0]);
    const binaryData = await convertImageToBase64(e.target.files?.[0]);
    setPreviewUploadedAvatar(binaryData);
    setSelectedAvatar("");
  };

  const clearUploadAvatar = () => {
    setPreviewUploadedAvatar(undefined);
    setUploadedAvatar(undefined);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const resetFields = () => {
    setAppName("");
    setAppId("");
    setUploadedAvatar(undefined);
    setPreviewUploadedAvatar(undefined);
    setSelectedAvatar("");
    setError("");
  };

  return (
    <Dialog
      open={open === (id ?? "create-app")}
      onOpenChange={(value) => {
        setOpen(value ? "create-app" : "");
        if (!value) {
          resetFields();
        }
      }}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl flex flex-col gap-y-0">
        <div className="relative h-full flex flex-col">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-6 right-6">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>

          <DialogHeader className="px-6 pt-6 block">
            <DialogTitle>
              <Text size={"2xl"} weight={"bold"}>
                {type === "create" ? "Create New App" : "Edit App"}
              </Text>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col px-6 gap-6 mt-8">
            <PrimaryInput
              placeholder="eg. Aakash's App"
              label="App Name"
              value={appName}
              onChange={(value) => setAppName(value)}
            />

            <div className="flex flex-col gap-2 relative z-1">
              <Text
                as="label"
                size={"sm"}
                weight={"medium"}
                variant={"light-grey"}
              >
                Choose An Avatar
              </Text>
              <div className="flex flex-col gap-4">
                <AvatarList
                  selected={selectedAvatar}
                  onClick={(value) => {
                    setSelectedAvatar(value);
                    setPreviewUploadedAvatar(undefined);
                    setUploadedAvatar(undefined);
                  }}
                />
                {selectedAvatar?.includes(".") && !previewUploadedAvatar && (
                  <div className="flex items-center gap-x-3">
                    <div className="relative w-10 h-10 bg-[#2B4761] border border-grey-900 rounded">
                      <X
                        color="#FFF"
                        className="absolute -top-2.5 -right-2.5 bg-[#CF6679] rounded-full cursor-pointer p-0.5"
                        size={20}
                        onClick={() => {
                          setSelectedAvatar("");
                        }}
                      />

                      <Image
                        src={baseImageUrl(selectedAvatar)}
                        alt="Avatar option"
                        width={32}
                        height={32}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
                {previewUploadedAvatar && (
                  <div className="flex items-center gap-x-3">
                    <div className="relative w-10 h-10 bg-[#2B4761] border border-grey-900 rounded-md p-1.5">
                      <X
                        color="#FFF"
                        className="absolute -top-2.5 -right-2.5 bg-[#CF6679] rounded-full cursor-pointer p-0.5"
                        size={20}
                        onClick={clearUploadAvatar}
                      />

                      <Image
                        src={previewUploadedAvatar}
                        alt="Avatar option"
                        width={40}
                        height={40}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                <Button
                  variant={"ghost"}
                  className="flex items-center gap-1.5 py-1 cursor-pointer w-fit"
                  onClick={handleClick}
                >
                  <div className="w-8 h-8 rounded overflow-hidden border border-dashed border-white flex items-center justify-center">
                    <Plus size={24} color="#FFF" strokeWidth={1} />
                  </div>
                  <Text size={"sm"} weight={"medium"} variant={"light-grey"}>
                    Upload From Device
                  </Text>
                  <input
                    type="file"
                    hidden
                    ref={inputRef}
                    accept="*/png"
                    onChange={handleChange}
                  />
                </Button>
              </div>
            </div>
            <PrimaryInput
              placeholder="eg. 1234"
              label="App ID"
              type="text"
              value={`${appId}`}
              onChange={(value) => {
                if (value === "") {
                  setAppId("");
                  return;
                }
                if (value.match(/\b\d+(\.\d+)?\b/)) {
                  setAppId(value);
                }
              }}
            />
          </div>

          <div className="px-6 mt-auto mb-6 pt-12 flex flex-col gap-y-2 items-center relative z-1">
            {!!error && (
              <Text variant={"error"} size={"xs"}>
                {error}
              </Text>
            )}
            <Button
              onClick={saveAppDetails}
              variant={
                !appName || !appId || (!selectedAvatar && !uploadedAvatar)
                  ? "disabled"
                  : "primary"
              }
              disabled={
                loading ||
                !appName ||
                !appId ||
                (!selectedAvatar && !uploadedAvatar)
              }
            >
              {loading ? (
                <LoaderCircle
                  className="animate-spin mx-auto"
                  color="#fff"
                  size={24}
                />
              ) : type === "edit" ? (
                "Save"
              ) : (
                "Create New App"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
