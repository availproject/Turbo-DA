"use client";
import Button from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfig } from "@/providers/ConfigProvider";
import CreditService from "@/services/credit";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, X } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useCallback, useRef, useState } from "react";
import { Text } from ".//text";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";

const avatarOptions = ["smile", "sad", "band"];

type CreateAppProps = {
  type?: "create" | "edit";
  appData?: any;
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
  const [customImages, setCustomImages] = useState([]);
  const [uploadedAvatar, setUploadedAvatar] = useState<File>();
  const [previewUploadedAvatar, setPreviewUploadedAvatar] = useState<string>();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    appData?.app_logo ?? ""
  );
  const { open, setOpen } = useDialog();
  const { token } = useConfig();

  const saveAppDetails = useCallback(async () => {
    console.log({
      selectedAvatar,
      previewUploadedAvatar,
    });

    if ((!selectedAvatar && !previewUploadedAvatar) || !appId || !appName) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    try {
      const uploadAvatar = uploadedAvatar
        ? await CreditService.uploadFile({
            token: token!,
            file: uploadedAvatar!,
          })
            .then((response) => {
              console.log(response);
              return response?.file;
            })
            .catch((error) => {
              setLoading(true);
              return undefined;
            })
        : selectedAvatar;

      console.log({
        uploadAvatar,
      });

      const response =
        type === "edit"
          ? await CreditService.updateApp({
              token: token!,
              appId,
              appName,
              avatar: uploadAvatar!,
              id: appData.id,
            })
          : await CreditService.createApp({
              token: token!,
              appId,
              appName,
              avatar: uploadAvatar!,
            });
      console.log({
        response,
      });
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [token, selectedAvatar, appId, appName, previewUploadedAvatar]);

  const handleClick = () => inputRef.current?.click();

  function convertImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsDataURL(file);
    });
  }

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

  return (
    <Dialog
      open={open === (id ?? "create-app")}
      onOpenChange={(value) => {
        setOpen(value ? "create-app" : "");
      }}
    >
      <DialogContent className="p-0 border-none bg-[#192a3d] text-white max-w-[600px] w-[600px] rounded-2xl outline-0">
        <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-4 right-4">
          <X color="#FFF" size={32} strokeWidth={1} />
        </Close>

        <DialogHeader className="p-4">
          <DialogTitle>
            <Text size={"2xl"} weight={"bold"}>
              {type === "create" ? "Create New App" : "Edit App"}
            </Text>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col px-4 gap-6">
          <PrimaryInput
            placeholder="eg. Aakash's App"
            label="App Name"
            value={appName}
            onChange={(value) => setAppName(value)}
          />

          <div className="flex flex-col gap-2">
            <Text
              as="label"
              size={"sm"}
              weight={"medium"}
              variant={"light-grey"}
            >
              Choose An Avatar
            </Text>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-x-3">
                {avatarOptions.map((avatar, index) => (
                  <div
                    key={index}
                    className={`w-10 h-10 bg-white rounded overflow-hidden flex items-center justify-center ${
                      selectedAvatar === avatar
                        ? "bg-[#44515f] p-1.5 border border-[#bbbbbb]"
                        : "cursor-pointer"
                    }`}
                    onClick={() => {
                      setSelectedAvatar(avatar);
                      clearUploadAvatar();
                    }}
                  >
                    <div className="w-full h-full bg-white rounded flex items-center justify-center">
                      <Image
                        src="/logo.svg"
                        alt="Avatar option"
                        width={32}
                        height={32}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {previewUploadedAvatar && (
                <div className="flex items-center gap-x-3">
                  <div className="relative w-10 h-10 bg-[#44515f] border border-[#bbbbbb] rounded">
                    <X
                      color="#000"
                      className="absolute -top-1 -right-2 bg-white rounded-full cursor-pointer"
                      size={14}
                      onClick={clearUploadAvatar}
                    />
                    <Image
                      src={previewUploadedAvatar}
                      alt="Avatar option"
                      width={32}
                      height={32}
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
            placeholder="eg. AV1234"
            label="App ID"
            value={appId}
            onChange={(value) => setAppId(value)}
          />
        </div>

        <div className="px-4 mt-auto mb-4 pt-12 flex flex-col gap-y-2 items-center">
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
            // onClick={() => {
            //   saveAppDetails;
            //   toast();
            // toast({
            //   variant: "destructive",
            //   title: "Uh oh! Something went wrong.",
            //   description: "There was a problem with your request.",
            //   action: ACTION_TYPES.ADD_TOAST,
            // });
            // toast(
            //   <div className="flex w-fit gap-x-2">
            //     <div className="bg-white border border-[#E9EAEB] h-10 w-10 rounded flex items-center justify-center">
            //       <div className="border-2 border-[#88d67b] rounded-full flex items-center justify-center w-5 h-5">
            //         <Check color="#88d67b" size={20} />
            //       </div>
            //     </div>
            //     <div className="flex flex-col gap-y-0">
            //       <Text size={"sm"} weight={"bold"}>
            //         Credits Allocated Successfully!
            //       </Text>
            //       <Text size={"sm"} variant={"light-grey"} weight={"normal"}>
            //         500 credits have been successfully allocated to App A
            //       </Text>
            //     </div>
            //   </div>,
            //   {
            //     cancel: {
            //       label: <X color="#FFF" size={32} strokeWidth={1} />,
            //       onClick: () => console.log("Undo"),
            //     },
            //     cancelButtonStyle: {
            //       backgroundColor: "transparent",
            //     },
            //     className: "bg-black text-white",
            //   }
            // );
            // }}
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
      </DialogContent>
    </Dialog>
  );
}
