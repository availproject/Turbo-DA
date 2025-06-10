import Button from "@/components/button";
import useAPIKeys from "@/hooks/useApiKeys";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { DialogTitle } from "../../components/dialog";
import { useDialog } from "../../components/dialog/provider";
import { Text } from "../../components/text";
import { useAppToast } from "../../components/toast";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { ClickHandler } from "../purchase-credit/utils/types";

const DeleteKeyAlert = ({
  id,
  identifier,
  clearAlertCallback,
}: {
  id: string;
  identifier: string;
  clearAlertCallback: ClickHandler;
}) => {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const { updateAPIKeys } = useAPIKeys();
  const [loading, setLoading] = useState(false);
  const { success } = useAppToast();

  const closeModal = () => {
    clearAlertCallback();
    setOpen("");
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const response = await AppService.deleteAPIKey({
        token: token!,
        identifier,
      });
      if (response.state === "SUCCESS") {
        updateAPIKeys();
        success({ label: "Deleted Successfully!" });
        closeModal();
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(true);
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
      <DialogContent className="min-w-[600px] h-[400px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className=" h-full flex flex-col p-6 z-1">
            <div className="flex justify-end items-center mb-6">
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </div>

            <div className="flex flex-col gap-y-2 text-center">
              <DialogTitle>
                <>
                  <Text weight={"bold"} size={"4xl"}>
                    Are you sure you want to delete your key?
                  </Text>
                  <Text weight={"bold"} size={"4xl"} className="mt-1">
                    ....{identifier}
                  </Text>
                </>
              </DialogTitle>
            </div>

            <div className="mt-auto pt-20 flex gap-x-4 max-w-[444px] mx-auto w-full">
              <Button variant={"secondary"} onClick={closeModal}>
                <Text weight={"semibold"} size={"lg"}>
                  Cancel
                </Text>
              </Button>
              <Button
                disabled={loading}
                variant={"danger"}
                onClick={handleDelete}
              >
                {loading ? (
                  <LoaderCircle
                    className="animate-spin mx-auto"
                    color="#fff"
                    size={24}
                  />
                ) : (
                  <Text weight={"semibold"} size={"lg"}>
                    Confirm
                  </Text>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteKeyAlert;
