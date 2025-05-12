import Button from "@/components/button";
import useBalance from "@/hooks/useBalance";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, formatDataBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/credit/response";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "react-toastify";
import { Text } from ".//text";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";
import Success from "./toast/success";
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
  const { updateCreditBalance } = useBalance();

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await AppService.reclaimCredits({
        token: token!,
        amount,
        appId: appData.id,
      });
      console.log({
        response,
      });
      updateCreditBalance();
      setOpen("");
      toast(
        <Success
          label="Credits Reclaimed Successfully!"
          description={`${formatDataBytes(
            +amount
          )} credits successfully reclaimed from ${appData.app_name}`}
        />,
        {
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
            width: "530px",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
          },
        }
      );
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
      <DialogContent className="min-w-[600px] h-[600px] border bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] shadow-primary border-border-grey rounded-2xl overflow-hidden p-4 flex flex-col focus-within:outline-0">
        <div className="flex justify-between items-center mb-2">
          <DialogTitle>
            <Text weight={"semibold"} size={"2xl"}>
              Reclaim Credits
            </Text>
          </DialogTitle>

          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          <div className="flex items-center gap-x-2">
            {appData?.app_logo?.includes(".") ? (
              <Image
                className="w-10 h-auto mb-1"
                alt={appData.app_name}
                src={baseImageUrl(appData.app_logo)}
                width={40}
                height={40}
              />
            ) : (
              <div className="w-10 h-10 rounded overflow-hidden mb-1">
                {avatarList?.[appData?.app_logo]?.path ? (
                  <DotLottieReact
                    src={avatarList?.[appData.app_logo].path}
                    loop
                    autoplay
                    playOnHover={true}
                    width={40}
                    height={40}
                  />
                ) : null}
              </div>
            )}
            <div className="">
              <Text size={"sm"} variant={"light-grey"} weight="medium">
                {appData.app_name} Balance
              </Text>
              <Text size={"2xl"} weight={"semibold"}>
                {formatDataBytes(+appData.credit_balance)}
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-2 w-full">
              <Text size={"sm"} weight={"medium"} as="label">
                From
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
                        src={avatarList?.[appData.app_logo].path}
                        loop
                        autoplay
                        playOnHover={true}
                        width={24}
                        height={24}
                      />
                    ) : null}
                  </div>
                )}
                <Text size={"sm"} weight={"medium"} as="label">
                  {appData.app_name}
                </Text>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Text size={"sm"} weight={"medium"} as="label">
                To
              </Text>
              <div className="relative border border-border-blue flex rounded-lg items-center p-3 h-12">
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
                  of {formatDataBytes(+appData.credit_balance, 2)}
                </Text>
              }
              className="border-0 px-0 text-white w-full"
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
              error={
                +appData.credit_balance < +amount
                  ? `Amount can’t exceed the app balance ${appData.credit_balance}`
                  : ""
              }
            />
          </div>
        </div>

        <div className="mt-auto pt-20">
          <Button
            variant={
              !amount || +appData.credit_balance < +amount
                ? "disabled"
                : "secondary"
            }
            disabled={loading || !amount || +appData.credit_balance < +amount}
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
      </DialogContent>
    </Dialog>
  );
}
