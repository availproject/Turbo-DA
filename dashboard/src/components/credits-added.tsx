import { Card, CardContent } from "@/components/ui/card";
import useBalance from "@/hooks/useBalance";
import { Close, DialogTitle } from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { useEffect } from "react";
import { Text } from ".//text";
import { useDialog } from "./dialog/provider";
import { Dialog, DialogContent } from "./ui/dialog";

type CreditsAddedProps = {
  credits?: string;
};
export default function CreditsAdded({ credits }: CreditsAddedProps) {
  const { open, setOpen } = useDialog();
  const { updateCreditBalance } = useBalance();

  useEffect(() => {
    if (open) {
      updateCreditBalance();
    }
  }, [open]);

  const popupData = {
    credits: credits,
    title: "Credits Added Successfully",
    description: "Allocate these credits to your app now",
  };

  return (
    <Dialog
      open={"credit-added" === open}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="p-0 border-none bg-[#192a3d] text-white max-w-[600px] w-[600px] rounded-2xl">
        <Card className="relative w-[600px] h-[400px] bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent">
          <DialogTitle></DialogTitle>
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-4 right-4">
            <X color="#FFF" size={32} strokeWidth={1} />
          </Close>

          <CardContent className="flex flex-col items-center justify-center h-full pt-0">
            <div className="w-[328px] gap-4 flex flex-col items-center">
              <div className="gap-2 relative self-stretch w-full flex flex-col items-center">
                <div className="relative w-16 h-16 bg-[#88d67b] rounded-[32px] flex items-center justify-center">
                  <Check color="#FFF" size={47} strokeWidth={4} />
                </div>

                <Text
                  weight={"bold"}
                  size={"sxl"}
                  className="relative self-stretch text-center"
                >
                  {popupData.credits}
                </Text>
              </div>

              <Text
                size={"2xl"}
                weight={"bold"}
                className="relative self-stretch text-[#88d67b] text-center"
              >
                {popupData.title}
              </Text>

              <Text
                weight={"medium"}
                variant={"light-grey"}
                size={"sm"}
                className="relative w-fit text-center"
              >
                {popupData.description}
              </Text>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
