import Button from "@/components/button";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import { Text } from "./text";
import { Dialog, DialogContent } from "./ui/dialog";

const SwitchToMainBalanceAlert = ({
  id,
  callback,
}: {
  id: string;
  callback: () => void;
}) => {
  const { open, setOpen } = useDialog();

  const closeModal = () => {
    setOpen("");
  };

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          closeModal();
        }
      }}
    >
      <DialogContent className="w-full sm:max-w-[600px] h-[400px] p-0 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden border flex flex-col focus-within:outline-0">
        <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
        <div className=" h-full flex flex-col p-6 z-1">
          <div className="flex justify-end items-center mb-6">
            <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
              <X color="#FFF" size={24} strokeWidth={1} />
            </Close>
          </div>

          <div className="flex flex-col gap-y-5 text-center max-w-[444px] mx-auto">
            <DialogTitle>
              <Text weight={"bold"} size={"2xl"}>
                Disabling Main Balance May Interrupt Your Service
              </Text>
            </DialogTitle>
            <Text weight={"bold"} variant={"secondary-grey"} size={"base"}>
              You're about to disable the fallback to your main balance. Since
              this app has already exhausted its assigned credits, it will
              immediately stop functioning unless new credits are assigned.
            </Text>
          </div>

          <div className="mt-auto pt-20 flex gap-x-4 max-w-[444px] mx-auto w-full">
            <Button variant={"secondary"} onClick={closeModal}>
              <Text weight={"semibold"} size={"lg"}>
                Cancel
              </Text>
            </Button>
            <Button variant={"danger"} onClick={callback}>
              <Text weight={"semibold"} size={"lg"} className="text-[#CB6262]">
                Confirm
              </Text>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SwitchToMainBalanceAlert;
