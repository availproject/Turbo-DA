import Button from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDataBytes } from "@/lib/utils";
import CreditService from "@/services/credit";
import { Close } from "@radix-ui/react-dialog";
import { InfoIcon, X } from "lucide-react";
import Image from "next/image";
import { useDeferredValue, useEffect, useState } from "react";
import { Text } from ".//text";
import { useDialog } from "./dialog/provider";
import PrimaryInput from "./input/primary";

type DiscountEligibilityProps = {
  token?: string;
};

function DiscountEligibility({ token }: DiscountEligibilityProps) {
  const [batchValue, setBatchValue] = useState<number>();
  const deferredQuery = useDeferredValue(batchValue);
  const [credits, setCredits] = useState();
  const { open, setOpen } = useDialog();

  useEffect(() => {
    if (!token) return;
    if (!batchValue) {
      return;
    }

    CreditService.creditEstimates({
      token,
      data: deferredQuery ?? 0,
    })
      .then((response) => {
        setCredits(response);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [deferredQuery]);

  const batchSizeData = {
    size: "100 KB",
    discount: "50%",
    originalCredits: "500",
    equivalentCredits: "1000",
  };

  return (
    <Dialog
      open={open === "main-credit-balance"}
      onOpenChange={(value) => !value && setOpen("")}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl outline-0">
        <div className="relative">
          <DialogHeader className="p-4 pb-0 flex justify-between flex-row">
            <DialogTitle>
              <Text weight={"bold"} size={"2xl"} as="span">
                Fee Discount Eligibility
              </Text>
            </DialogTitle>
            <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
              <X color="#FFF" size={24} strokeWidth={1} />
            </Close>
          </DialogHeader>

          <div className="flex flex-col p-4 gap-4 mt-2">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Text
                    as="label"
                    size={"sm"}
                    variant={"light-grey"}
                    weight={"medium"}
                  >
                    Enter Your Batch Size
                  </Text>
                  <InfoIcon color="#dadada" size={16} />
                </div>
                <PrimaryInput
                  placeholder="eg. 100 KB"
                  value={`${batchValue ?? ""}`}
                  onChange={(value) => {
                    if (value === "") {
                      setBatchValue(undefined);
                      return;
                    }
                    if (isNaN(+value)) {
                      return;
                    }

                    const parsedValue = parseInt(value);
                    setBatchValue(parsedValue);
                  }}
                  type="text"
                />
              </div>
            </div>

            <div className="bg-[#88d67b3d] border-none rounded-lg p-2">
              <Text className="text-sm leading-[18px]">
                <Text
                  as="span"
                  weight={"medium"}
                  size={"sm"}
                  className="text-[#88d67b]"
                >
                  For a batch size of{" "}
                </Text>
                <Text as="span" weight={"bold"} size={"sm"}>
                  {deferredQuery
                    ? formatDataBytes(deferredQuery)
                    : batchSizeData.size}
                </Text>
                <Text
                  as="span"
                  size={"sm"}
                  weight={"bold"}
                  className="text-[#88d67b]"
                >
                  {" "}
                  you will receive a{" "}
                </Text>
                <Text as="span" size={"sm"} weight={"bold"}>
                  {batchSizeData.discount} discount (Max)
                </Text>
                <Text
                  as="span"
                  weight={"medium"}
                  size={"sm"}
                  className="text-[#88d67b]"
                >
                  {" "}
                  on the fees.
                  <br />
                </Text>
                <Text as="span" size={"sm"} weight={"bold"}>
                  Benefit: Your &apos;{batchSizeData.originalCredits}&apos;
                  credits would be equivalent to &apos;
                  {batchSizeData.equivalentCredits}&apos; credits.
                </Text>
              </Text>
              <Button variant="link" className="underline pl-0">
                <Text
                  as="span"
                  size={"sm"}
                  weight={"bold"}
                  variant={"light-grey"}
                >
                  Read Docs
                </Text>
              </Button>
            </div>

            <Card className="border-none bg-transparent shadow-none">
              <CardContent className="p-0 relative h-32 min-sm:h-[244px] border-none bg-transparent shadow-none">
                <div className="relative w-11/12 h-full border-l border-b border-gray-500 mx-auto">
                  <div className="w-full h-full flex justify-center">
                    <Image
                      src={"/growth.svg"}
                      width={453}
                      height={168}
                      alt="growth graph"
                    />
                  </div>

                  <div className="absolute top-1/2 -left-10 transform -rotate-90">
                    <Text size={"xs"} variant={"light-grey"} weight={"medium"}>
                      Discount
                    </Text>
                  </div>

                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                    <Text size={"xs"} variant={"light-grey"} weight={"medium"}>
                      Batch Size
                    </Text>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DiscountEligibility;
