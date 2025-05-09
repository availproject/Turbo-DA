import Button from "@/components/button";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Text } from ".//text";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import { Dialog, DialogContent } from "./ui/dialog";

export default function DeleteKeyAlert({ id }: { id: string }) {
  const { open, setOpen } = useDialog();

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="w-full sm:max-w-[600px] bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent p-4 flex flex-col focus-within:outline-0">
        <div className="flex justify-end items-center mb-6">
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={32} strokeWidth={1} />
          </Close>
        </div>

        <div className="flex flex-col gap-y-2 text-center">
          <DialogTitle>
            <>
              <Text weight={"bold"} size={"4xl"}>
                Are you sure you want to delete your Key?
              </Text>
              <Text weight={"bold"} size={"4xl"}>
                ....86612
              </Text>
            </>
          </DialogTitle>
        </div>

        <div className="mt-auto pt-20 flex gap-x-4 max-w-[444px] mx-auto w-full">
          <Button className="w-full h-12 border border-[#949494] rounded-[48px] font-inter font-bold bg-transparent hover:bg-transparent">
            Cancel
          </Button>
          <Button className="w-full h-12 bg-[#CB6262] hover:bg-[#CB6262]/90 rounded-[48px] font-inter font-bold">
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
