import Button from "@/components/button";
import useAPIKeys from "@/hooks/useApiKeys";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { Text } from ".//text";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import Success from "./toast/success";
import { Dialog, DialogContent } from "./ui/dialog";

const DeleteKeyAlert = ({
  id,
  identifier,
  clearAlertCallback,
}: {
  id: string;
  identifier: string;
  clearAlertCallback: () => void;
}) => {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const { updateAPIKeys } = useAPIKeys();
  const [loading, setLoading] = useState(false);

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
      if (response) {
        updateAPIKeys();
        toast(<Success label="Deleted Successfully!" />, {
          theme: "colored",
          progressClassName: "bg-[#78C47B]",
          closeButton: (
            <X
              color="#FFF"
              size={20}
              className="cursor-pointer"
              onClick={() => toast.dismiss()}
            />
          ),
          style: {
            backgroundColor: "#78C47B29",
            width: "300px",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
          },
        });
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
      <DialogContent className="min-w-[600px] p-6 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden border border-solid flex flex-col focus-within:outline-0">
        <div className="flex justify-end items-center mb-6">
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>
        </div>

        <div className="flex flex-col gap-y-2 text-center">
          <DialogTitle>
            <>
              <Text weight={"bold"} size={"4xl"}>
                Are you sure you want to delete your Key?
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
          <Button disabled={loading} variant={"danger"} onClick={handleDelete}>
            {loading ? (
              <LoaderCircle
                className="animate-spin mx-auto"
                color="#fff"
                size={24}
              />
            ) : (
              <Text weight={"semibold"} size={"lg"} className="text-[#CB6262]">
                Confirm
              </Text>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteKeyAlert;
