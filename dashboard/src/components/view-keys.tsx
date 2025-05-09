import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Text } from ".//text";
import Button from "./button";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import { Dialog, DialogContent } from "./ui/dialog";

type ViewKeysProps = {
  id: string;
};

export default function ViewKeys({ id }: ViewKeysProps) {
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
      <DialogContent className="w-full sm:max-w-[600px] h-[600px] bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent flex flex-col focus-within:outline-0 p-0">
        <div className="flex justify-between items-center mb-0 p-4">
          <DialogTitle>
            <Text weight={"bold"} size={"2xl"}>
              All Active Keys (2)
            </Text>
          </DialogTitle>

          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={32} strokeWidth={1} />
          </Close>
        </div>

        <div>
          <div className="flex items-center gap-2 border-b border-[#575757] pb-2 justify-between px-4">
            <Text
              weight={"medium"}
              size={"xs"}
              variant={"light-grey"}
              className="w-4"
            >
              Sno.
            </Text>
            <Text
              weight={"medium"}
              size={"xs"}
              variant={"light-grey"}
              className="w-20"
            >
              Key
            </Text>
            <Text
              weight={"medium"}
              size={"xs"}
              variant={"light-grey"}
              className="w-[100px] text-right"
            >
              Action
            </Text>
          </div>
          <div className="flex flex-col gap-y-4 pt-4">
            <div className="flex items-center gap-2 justify-between px-4 h-8">
              <Text weight={"bold"} className="w-4">
                1
              </Text>
              <Text weight={"bold"} className="w-20">
                ...67890
              </Text>
              <Button className="bg-[#CB62623D] hover:bg-[#CB62623D]/90 rounded-full h-8 w-[98px] flex justify-center items-center">
                <Text
                  weight={"medium"}
                  size={"sm"}
                  className="w-[100px] text-[#CB6262]"
                >
                  Delete
                </Text>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
