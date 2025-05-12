import Button from "@/components/button";
import useBalance from "@/hooks/useBalance";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, Wallet, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "react-toastify";
import { Text } from ".//text";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";
import Success from "./toast/success";
import { Dialog, DialogContent } from "./ui/dialog";

type AssignCreditsProps = {
  id: string;
  appData: AppDetails;
};

export default function AssignCredits({ id, appData }: AssignCreditsProps) {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const { creditBalance } = useOverview();
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { updateCreditBalance } = useBalance();

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await AppService.assignCredits({
        token: token!,
        amount,
        appId: appData.id,
      });
      console.log({
        response,
      });
      toast(
        <Success
          label="Credits Assigned Successfully!"
          description={`${formatDataBytes(
            +amount
          )} credits successfully assigned from main credit balance`}
        />,
        {
          theme: "colored",
          progressClassName: "bg-[#78C47B]",
          closeButton: () => (
            <X
              color="#FFF"
              size={20}
              className="cursor-pointer"
              onClick={() => toast.dismiss()}
            />
          ),
          style: {
            backgroundColor: "#78C47B29",
            width: "530px",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
            top: "60px",
          },
        }
      );
      updateCreditBalance();
      setOpen("");
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
      <DialogContent className="min-w-[600px] h-[600px] border bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] shadow-primary border-border-grey rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 p-0">
        <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
        <div className="relative h-full flex flex-col p-4 z-1">
          <div className="flex justify-between items-center mb-2 relative z-1">
            <DialogTitle>
              <Text weight={"bold"} size={"2xl"}>
                Assign Credits
              </Text>
            </DialogTitle>

            <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
              <X color="#FFF" size={24} strokeWidth={1} />
            </Close>
          </div>

          <div className="flex flex-col gap-4 flex-1 relative z-1">
            <div className="flex items-center gap-2">
              <Wallet color="#B3B3B3" strokeWidth={1} size={40} />
              <div className="flex flex-col gap-y-1.5">
                <Text size={"sm"} variant={"light-grey"} weight={"medium"}>
                  Main Credit Balance
                </Text>
                <Text size={"2xl"} weight={"semibold"}>
                  {formatDataBytes(creditBalance)}
                </Text>
              </div>
            </div>

            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-2 w-full">
                <Text size={"sm"} weight={"medium"} as="label">
                  From
                </Text>
                <div className="relative border border-border-blue flex rounded-lg items-center p-3 h-12">
                  <Text weight={"semibold"} as="label">
                    Main Credit Balance
                  </Text>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Text size={"sm"} weight={"medium"} as="label">
                  To
                </Text>

                <div className="relative border border-border-blue rounded-lg items-center p-3 h-12 flex gap-x-2">
                  {appData?.app_logo?.includes(".") ? (
                    <Image
                      className="w-8 h-auto"
                      alt={appData.app_name}
                      src={baseImageUrl(appData.app_logo)}
                      width={32}
                      height={40}
                    />
                  ) : (
                    <div className="w-6 rounded overflow-hidden">
                      {avatarList?.[appData?.app_logo]?.path ? (
                        <DotLottieReact
                          src={avatarList?.[appData?.app_logo]?.path}
                          loop
                          autoplay
                          playOnHover={true}
                          width={24}
                          height={24}
                        />
                      ) : null}
                    </div>
                  )}
                  <Text weight={"semibold"} as="label">
                    {appData.app_name}
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
                    of {formatDataBytes(creditBalance, 2)}
                  </Text>
                }
                onChange={(value) => {
                  if (value === "") {
                    setAmount("");
                    return;
                  }

                  if (value.match(/\b\d+(\.\d+)?\b/)) {
                    setAmount(value);
                  }
                }}
                value={amount}
                className="px-0 text-white w-full"
                error={
                  creditBalance < +amount
                    ? `Amount can’t exceed the main credit balance. ${creditBalance}`
                    : ""
                }
              />
            </div>
          </div>

          <div className="mt-auto pt-20 relative z-1">
            <Button
              variant={
                !amount || !creditBalance || creditBalance < +amount
                  ? "disabled"
                  : "secondary"
              }
              disabled={
                loading || !amount || !creditBalance || creditBalance < +amount
              }
              onClick={handleSubmit}
            >
              {loading ? (
                <LoaderCircle
                  className="animate-spin mx-auto"
                  color="#fff"
                  size={24}
                />
              ) : !amount ? (
                "Enter Amount"
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
