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
import { ShieldAlert } from "lucide-react";
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
        <Dialog open={openDialog} onOpenChange={setOpenDialog} >
          <DialogTrigger>
            <div className="bg-[#1D1D1D] rounded-2xl mx-auto text-white p-2 text-mono px-4 flex flex-row items-center justify-center space-x-2">
              <ShieldAlert className="text-[#FF9E0B] w-4 h-4 mx-auto" />{" "}
              <span className="font-sans text-opacity-70 text-white">
                AppID is set to <span className="text-bold text-white">{user.app_id}</span>, click here to re-configure.
              </span>
            </div>
          </DialogTrigger>
          <DialogContent className="bg-[#131313] border-0 flex flex-col items-center justify-center !rounded-xl !bg-opacity-100">
            <DialogHeader>
              <DialogTitle className="!text-white !text-left text-2xl !text-opacity-80 py-3">
                Configure AppID
              </DialogTitle>
              <DialogDescription>
                <p className="mb-4">
                  Update your AppID to enable the gas relayer to work with your
                  specific app.
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
                        if (!token) throw new Error("User is not authenticated");

                        const update = await updateAppID(token, updatedAppID);
                        if (update.success) {
                         await getUserInfo();
                         showSuccessMessage({title: "App ID updated successfully",  description: `App ID set to ${updatedAppID}` })
                         setOpenDialog(false)
                        } else {
                          showFailedMessage({title: "Failed to update AppID",  description: update.error || "Unable to update App ID" })
                        }

                      } catch(e: any) {
                        showFailedMessage({title: "Failed to update AppID",  description: e || "Unable to update App ID" })
                        console.error(e)
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
      </>
    );
  }

  return <>...</>
}
