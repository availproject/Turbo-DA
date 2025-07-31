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
  previousBalance?: number;
};
export default function CreditsAdded({ credits }: CreditsAddedProps) {
  const { open, setOpen } = useDialog();
  const { updateAllBalances, refreshCounter } = useBalance();

  useEffect(() => {
    const updateBalnceCallback = setTimeout(() => {
      if (open) {
        updateAllBalances();
      }
    }, 5000);
    return () => {
      clearTimeout(updateBalnceCallback);
    };
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
      <DialogContent className="p-0 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] text-white w-[600px] rounded-2xl h-[400px]">
        <div className="bg-[url('/credits-added-noise.png')] bg-repeat absolute flex w-full h-full opacity-80 z-1" />
        <Card className="relative w-full h-full bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent">
          <DialogTitle></DialogTitle>
          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer absolute top-4 right-4 z-2">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>

          <CardContent className="flex flex-col items-center justify-center h-full pt-0">
            <div className="w-[328px] gap-y-1 flex flex-col items-center">
              <div className="relative self-stretch w-full flex flex-col items-center">
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
                  size={"4xl"}
                  className="relative self-stretch text-center"
                >
                  {credits}
                </Text>
              </div>

              <Text
                size={"2xl"}
                weight={"semibold"}
                className="text-[#78C47B] drop-shadow-[0_0_26.04px_rgba(120,196,123,0.60)]"
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
