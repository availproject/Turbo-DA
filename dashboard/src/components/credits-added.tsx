import { Card, CardContent } from "@/components/ui/card";
import useBalance from "@/hooks/useBalance";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Close, DialogTitle } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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

  return (
    <Dialog
      open={"credit-added" === open}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="p-0 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] text-white max-w-[600px] w-[600px] rounded-2xl">
        <div className="bg-[url('/credits-added-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />

        <Card className="relative w-[600px] h-[400px] bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent">
          <DialogTitle></DialogTitle>
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-4 right-4">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>

          <CardContent className="flex flex-col items-center justify-center h-full pt-0">
            <div className="w-[328px] gap-4 flex flex-col items-center">
              <div className="gap-2 relative self-stretch w-full flex flex-col items-center">
                <div className="w-44 flex items-center justify-center">
                  <DotLottieReact
                    src={"credit-added.lottie"}
                    loop
                    autoplay
                    playOnHover={true}
                    width={100}
                    height={100}
                  />
                </div>

                <Text
                  weight={"semibold"}
                  size={"sxl"}
                  className="relative self-stretch text-center"
                >
                  {credits}
                </Text>
              </div>

              <Text
                size={"2xl"}
                weight={"semibold"}
                className="text-[#78C47B] text-center"
              >
                Credits Added Successfully
              </Text>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
