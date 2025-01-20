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
import { updateAppID } from "@/lib/services";
import { template } from "@/lib/utils";
import { useCommonStore } from "@/store/common";
import { showFailedMessage, showSuccessMessage } from "@/utils/toasts";
import { useAuth } from "@clerk/nextjs";
import { Button, Input } from "degen";
import { Copy, ShieldAlert } from "lucide-react";
import { useState } from "react";

export default function UpdateAppId() {
  const { user } = useCommonStore();
  const { getToken } = useAuth();
  const { getUserInfo } = useUserInfo();

  const [updatedAppID, setUpdatedAppID] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);

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
      <>
        <div className="pl-2">
          <h1 className="text-left text-4xl font-mono text-white pb-2 pt-4 ">AppID</h1>
          <p className="text-opacity-60 text-white pb-2">
            This is your AppId, the data would be submitted with this, please
            choose the correct appID.
          </p>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger>
              <div className="pb-4">
                <p className="underline text-blue-400 text-mono text-left ">
                  click here to re-configure.
                </p>
              </div>
            </DialogTrigger>
            <DialogContent className="bg-[#131313] border-0 flex flex-col items-center justify-center !rounded-xl !bg-opacity-100">
              <DialogHeader>
                <DialogTitle className="!text-white !text-left text-2xl !text-opacity-80 py-3">
                  Configure AppID
                </DialogTitle>
                <DialogDescription>
                  <p className="mb-4">
                    Update your AppID to enable the gas relayer to work with
                    your specific app.
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
          <h1 className="text-left text-4xl font-mono text-white pb-2 pt-4 ">ApiKey</h1>
          <span className="text-opacity-60 text-white pb-6">
           You can use this Api key to submit data with the script, can use to submit data with the script. <span className=" text-blue-400 flex flex-row items-center pt-2 pb-8 space-x-2"><p>Copy to clipboard</p> <Copy className="w-4 h-4"/></span>
          </span>
        </div>
      </>
    );
  }

  return <>...</>;
}
