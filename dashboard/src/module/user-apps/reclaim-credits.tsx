import Button from "@/components/button";
import useApp from "@/hooks/useApp";
import useBalance from "@/hooks/useBalance";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, formatDataBytes, formatInBytes } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import AppService from "@/services/app";
import { AppDetails } from "@/services/app/response";
import { Close } from "@radix-ui/react-dialog";
import { LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { DialogTitle } from "../../components/dialog";
import { useDialog } from "../../components/dialog/provider";
import PrimaryInput from "../../components/input/primary";
import AvatarWrapper from "../../components/lottie-comp/avatar-container";
import { Text } from "../../components/text";
import { useAppToast } from "../../components/toast";
import { Dialog, DialogContent } from "../../components/ui/dialog";

const ReclaimCredits = ({
  id,
  appData,
}: {
  id: string;
  appData: AppDetails;
}) => {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { updateCreditBalance } = useBalance();
  const { success } = useAppToast();
  const { updateAppList } = useApp();

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await AppService.reclaimCredits({
        token: token!,
        amount,
        appId: appData.id,
      });
      if (response?.state === "SUCCESS") {
        updateCreditBalance();
        updateAppList();
        setOpen("");
        success({
          label: "Credits Reclaimed Successfully!",
          description: `${formatDataBytes(
            +amount
          )} successfully reclaimed from ${appData.app_name}`,
        });
      }
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
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative h-full flex flex-col p-4 z-1">
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
                    className="w-10 h-10 mb-1 rounded"
                    alt={appData.app_name}
                    src={baseImageUrl(appData.app_logo)}
                    width={40}
                    height={40}
                  />
                ) : (
                  <div className="w-10 h-10 rounded overflow-hidden mb-1">
                    {avatarList?.[appData?.app_logo]?.path ? (
                      <AvatarWrapper
                        path={avatarList?.[appData.app_logo].path}
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
                        className="w-8 h-8 rounded"
                        alt={appData.app_name}
                        src={baseImageUrl(appData.app_logo)}
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className="w-6 rounded overflow-hidden">
                        {avatarList?.[appData?.app_logo]?.path ? (
                          <AvatarWrapper
                            path={avatarList?.[appData.app_logo].path}
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
                      className="opacity-40 w-[180px] text-end"
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
                    const validValue = /^\d+(\.\d*)?$/.test(value);

                    if (validValue) {
                      setAmount(value);
                    }
                  }}
                  value={amount}
                  error={
                    +appData.credit_balance < formatInBytes(+amount)
                      ? `Amount can’t exceed the app balance`
                      : ""
                  }
                />
              </div>
            </div>

            <div className="mt-auto pt-20 ">
              <Button
                variant={
                  !amount || +appData.credit_balance < formatInBytes(+amount)
                    ? "disabled"
                    : "primary"
                }
                disabled={
                  loading ||
                  !amount ||
                  +appData.credit_balance < formatInBytes(+amount)
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReclaimCredits;
