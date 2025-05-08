import Button from "@/components/button";
import { formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import CreditService from "@/services/credit";
import { AppDetails } from "@/services/credit/response";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Text } from ".//text";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";
import { Dialog, DialogContent } from "./ui/dialog";

type ReclaimCreditsProps = {
  id: string;
  appData: AppDetails;
};

export default function ReclaimCredits({ id, appData }: ReclaimCreditsProps) {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await CreditService.reclaimCredits({
        token: token!,
        amount,
        appId: appData.id,
      });
      console.log({
        response,
      });
    } catch (error) {
    } finally {
      setLoading(false);
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
      <DialogContent className="w-full sm:max-w-[600px] bg-[#192a3d] rounded-2xl overflow-hidden border border-solid border-transparent p-4 flex flex-col focus-within:outline-0">
        <div className="flex justify-between items-center mb-6">
          <DialogTitle>
            <Text weight={"bold"} size={"2xl"}>
              Reclaim Credits
            </Text>
          </DialogTitle>

          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={32} strokeWidth={1} />
          </Close>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div className="flex items-center gap-2">
            <Image src="/logo.svg" width={40} height={40} alt="" />
            <div className="flex flex-col gap-y-1.5">
              <Text size={"sm"} variant={"light-grey"}>
                {appData.app_name} Balance
              </Text>
              <Text size={"2xl"} weight={"bold"}>
                {formatDataBytes(+appData.credit_balance)}
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-2 w-full">
              <Text size={"sm"} weight={"medium"} as="label">
                From
              </Text>
              <div className="relative border border-grey-900 rounded-lg items-center p-4 h-12 flex gap-x-2">
                <Image src="/logo.svg" width={40} height={40} alt="" />
                <Text size={"sm"} weight={"medium"} as="label">
                  {appData.app_name}
                </Text>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Text size={"sm"} weight={"medium"} as="label">
                To
              </Text>
              <div className="relative border border-grey-900 flex rounded-lg items-center p-4 h-12">
                <Text size={"sm"} weight={"medium"} as="label">
                  Main Credit Balance
                </Text>
              </div>
            </div>
            <PrimaryInput
              placeholder="e.g. 500"
              label="Amount"
              rightElement={
                <Text
                  className="opacity-40 w-[120px] text-end"
                  size={"base"}
                  weight={"bold"}
                >
                  of {formatDataBytes(+appData.credit_balance)}
                </Text>
              }
              className="border-0 px-0 text-white w-full"
              onChange={(value) => {
                if (value === "") {
                  setAmount("");
                  return;
                }
                if (isNaN(+value)) {
                  return;
                }

                const parsedValue = parseInt(value);
                setAmount(parsedValue.toString());
              }}
              value={amount}
            />
          </div>
        </div>

        <div className="mt-auto pt-20">
          <Button
            variant={!amount ? "disabled" : "primary"}
            disabled={loading || !amount}
            onClick={handleSubmit}
          >
            {loading ? (
              <LoaderCircle
                className="animate-spin mx-auto"
                color="#fff"
                size={24}
              />
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
