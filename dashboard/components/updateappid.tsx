"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useUserInfo from "@/hooks/useUserInfo";
import {
  ApiKey,
  generateApikey,
  getAllApiKeys,
  updateAppID,
} from "@/lib/services";
import { template } from "@/lib/utils";
import { useCommonStore } from "@/store/common";
import { showFailedMessage, showSuccessMessage } from "@/utils/toasts";
import { useAuth } from "@clerk/nextjs";
import { Button, Input } from "degen";
import { Copy, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";
import ApiKeysTable from "./apikeytable";
import Loader from "./loader";
import { Alert, AlertDescription } from "./ui/alert";

export default function UpdateAppId() {
  const { user } = useCommonStore();
  const { getToken, isSignedIn } = useAuth();
  const [token, setToken] = useState<null | string>("");
  const { getUserInfo } = useUserInfo();

  const [updatedAppID, setUpdatedAppID] = useState<number>(0);
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingKey, setGeneratingKey] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [showCopyAlert, setShowCopyAlert] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      isSignedIn && setToken(await getToken({ template }));
    })();
  }, [getToken, isSignedIn]);

  const generateKey = async () => {
    try {
      setGeneratingKey(true);
      if (!token) throw new Error("Token not found");
      const key = await generateApikey(token);
      setGeneratedApiKey(key.api_key);
      setShowCopyAlert(true);
      showSuccessMessage({
        title: "API Key Generated",
        description: "New API key has been generated successfully.",
      });
    } catch (err) {
      console.error("Failed to generate API key: ", err);
      showFailedMessage({
        title: "Error",
        description: "Failed to generate new API key",
      });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showSuccessMessage({
        title: "Copied!",
        description: "API key copied to clipboard",
      });
    } catch (err) {
      showFailedMessage({
        title: "Error",
        description: "Failed to copy API key",
      });
    }
  };


  /**
   *
   * TODO
   *
   * 1. check if the appID is set to 0
   * 2. if it is, show alert as the dialog open trigger asking user to update the appID
   * 3. make user update the app using the api
   * 4. change the trigger to appID to set {x}
   */

  if (user) {
    return (

        <div className="pl-2">
          <h1 className="text-left text-2xl font-mono text-white pb-2 pt-4 ">
            AppID<Badge className="ml-2 text-lg">Current: {user.app_id}</Badge>
          </h1>
          <p className="text-opacity-60 text-white pb-2">
            This is your AppId, the data you submit can be queried with this.{" "}
            <a
              href="https://docs.availproject.org/docs/appid"
              target="_blank"
              className="underline"
            >
              Read More
            </a>
          </p>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger>
              <div className="pb-4">
                <p className="hover:underline text-blue-400 text-mono text-left ">
                  Click here to re-configure
                </p>
              </div>
            </DialogTrigger>
            <DialogContent className="bg-[#131313] border-0 flex flex-col items-center justify-center !rounded-xl !bg-opacity-100">
              <DialogHeader>
                <DialogTitle className="!text-white !text-left font-thin text-2xl !text-opacity-80 py-3">
                  Configure AppID
                </DialogTitle>
                <DialogDescription>
                  <p className="mb-4">
                    Update your AppID to enable the data submission script to
                    work with your specific app.
                  </p>
                  <div className="flex flex-row space-x-2 items-center justify-center">
                    {" "}
                    <Input
                      type="number"
                      label=""
                      placeholder="Enter your AppID"
                      onChange={(e) => setUpdatedAppID(Number(e.target.value))}
                    />{" "}
                    <div className="mt-[.4rem]">
                      <Button
                        variant="tertiary"
                        loading={loading}
                        size="medium"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            const token = await getToken({ template });
                            if (!token)
                              throw new Error("User is not authenticated");

                            const update = await updateAppID(
                              token,
                              updatedAppID
                            );
                            if (update.success) {
                              await getUserInfo();
                              showSuccessMessage({
                                title: "App ID updated successfully",
                                description: `App ID set to ${updatedAppID}`,
                              });
                              setOpenDialog(false);
                            } else {
                              showFailedMessage({
                                title: "Failed to update AppID",
                                description:
                                  update.error || "Unable to update App ID",
                              });
                            }
                          } catch (e: any) {
                            showFailedMessage({
                              title: "Failed to update AppID",
                              description: e || "Unable to update App ID",
                            });
                            console.error(e);
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <h1 className="text-left text-2xl font-mono text-white pb-2 pt-4 ">
            API Keys
          </h1>
        <div className="text-opacity-60 text-white pb-6">
          <p className="mb-4">
            You can use this API key to submit data. We&apos;ll fund your data credit based on this key.
          </p>
          
          <div className="flex flex-col space-y-4">
            <button
              onClick={generateKey}
              disabled={generatingKey}
              className="inline-flex items-center space-x-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              {generatingKey ? (
                <span className="flex items-center space-x-2">
                  <Loader />
                  <span>Generating new key...</span>
                </span>
              ) : (
                <span className="underline">Generate new key</span>
              )}
            </button>

            {generatedApiKey && (
              <div className="space-y-4">
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertDescription className="text-yellow-200">
                    Important: This API key will only be shown once. Please copy it now and store it securely.
                  </AlertDescription>
                </Alert>
                
                <div className="flex items-center space-x-2 bg-black/30 p-3 rounded-lg">
                  <code className="font-mono flex-1 break-all">
                    {generatedApiKey}
                  </code>
                  <button
                    onClick={() => handleCopy(generatedApiKey)}
                    className="p-2 hover:bg-white/10 rounded-md transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
            {token && <ApiKeysTable token={token} />}
        </div>
      </div>
);
  }

  return <>...</>;
}
