import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { turboDADocLink } from "@/lib/constant";
import { convertBytes, formatInBytes, kbToCredits } from "@/lib/utils";
import CreditService from "@/services/credit";
import { useAuth } from "@/providers/AuthProvider";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

function DiscountEligibility() {
  const { token } = useAuth();
  const [batchValue, setBatchValue] = useState<number>();
  const deferredQuery = useDeferredValue(batchValue);
  const debouncedValue = useDebounce(deferredQuery, 500);
  const [credits, setCredits] = useState<number | null>();
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const { open, setOpen } = useDialog();

  useEffect(() => {
    if (!token) return;
    if (!debouncedValue) {
      return;
    }

    setIsLoadingCredits(true);
    CreditService.creditEstimates({
      token,
      data: formatInBytes(debouncedValue) || 0,
    })
      .then((response) => {
        // Convert API response from KB to credits
        const creditsValue = response?.data ? kbToCredits(response.data) : null;
        setCredits(creditsValue);
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setIsLoadingCredits(false);
      });
  }, [debouncedValue]);

  const batchSizeData = useMemo(() => {
    if (!debouncedValue) {
      return {
        size: "100 KB",
        credits: "71.82",
      };
    }

    return {
      size: `${convertBytes(debouncedValue)}`,
      credits: credits || "71.82",
    };
  }, [debouncedValue, credits]);

  const graphData = useMemo(() => {
    const dataPoints = [
      { batchSize: 10, cost: 0.9653 },
      { batchSize: 25, cost: 0.9126 },
      { batchSize: 50, cost: 0.8365 },
      { batchSize: 75, cost: 0.772 },
      { batchSize: 100, cost: 0.7168 },
      { batchSize: 150, cost: 0.6271 },
      { batchSize: 200, cost: 0.5573 },
      { batchSize: 300, cost: 0.4559 },
      { batchSize: 400, cost: 0.3857 },
      { batchSize: 500, cost: 0.3343 },
      { batchSize: 750, cost: 0.2507 },
      { batchSize: 1000, cost: 0.2005 },
      { batchSize: 1500, cost: 0.18 },
      { batchSize: 2000, cost: 0.17 },
      { batchSize: 3000, cost: 0.16 },
      { batchSize: 4000, cost: 0.155 },
      { batchSize: 5000, cost: 0.15 },
      { batchSize: 10000, cost: 0.14 },
    ];
    const maxBatchSize = 10000;
    const maxCost = 1.0;

    const points = dataPoints.map((point) => ({
      x: (point.batchSize / maxBatchSize) * 455,
      y: 190 - (point.cost / maxCost) * 190,
    }));

    const pathData = points
      .map((point, index) =>
        index === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`,
      )
      .join(" ");

    return pathData;
  }, []);

  return (
    <Dialog
      open={open === "main-credit-balance"}
      onOpenChange={(value) => !value && setOpen("")}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative">
            <DialogHeader className="p-6 pb-0 flex justify-between flex-row">
              <DialogTitle>
                <Text weight={"bold"} size={"2xl"} as="span">
                  Calculate Credit Consumption
                </Text>
              </DialogTitle>
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </DialogHeader>

            <div className="flex flex-col p-6 gap-4 mt-2">
              <PrimaryInput
                placeholder="eg. 100 KB"
                value={`${batchValue ?? ""}`}
                label={"Enter Your Batch Size In KBs"}
                onChange={(value) => {
                  if (value === "") {
                    setBatchValue(undefined);
                    return;
                  }
                  const validValue = /^\d+(\.\d*)?$/.test(value);

                  if (validValue) {
                    setBatchValue(+value);
                  }
                }}
                type="text"
              />

              <div className="bg-[#88d67b3d] border-none rounded-lg p-2">
                <Text className="text-sm leading-[18px]">
                  <Text
                    as="span"
                    weight={"semibold"}
                    size={"sm"}
                    className="text-[#88d67b]"
                  >
                    For a batch size of{" "}
                  </Text>
                  <Text as="span" weight={"bold"} size={"sm"}>
                    {batchSizeData.size}
                  </Text>
                  <Text
                    as="span"
                    size={"sm"}
                    weight={"medium"}
                    className="text-[#88d67b]"
                  >
                    {" "}
                    you will consume{" "}
                  </Text>
                  <Text as="span" size={"sm"} weight={"bold"}>
                    {isLoadingCredits && debouncedValue ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="w-2 h-2 animate-spin" />
                        credits
                      </span>
                    ) : (
                      `${batchSizeData.credits} credits`
                    )}
                    . The higher the batch size, the lower would be your credit
                    consumption.
                  </Text>
                </Text>
                <Link href={turboDADocLink} target="_blank" className="w-fit">
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
                </Link>
              </div>

              <Card className="border-none bg-transparent shadow-none">
                <CardContent className="p-0 relative h-32 min-sm:h-[244px] border-none bg-transparent shadow-none">
                  <div className="relative w-11/12 h-full border-l border-b border-gray-500 mx-auto">
                    <div className="w-full h-full flex justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="455"
                        height="190"
                        viewBox="0 0 455 190"
                        fill="none"
                        className="h-full"
                      >
                        <path
                          d={graphData}
                          stroke="#3CA3FC"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                    </div>

                    <div className="absolute top-1/2 -left-8 transform -rotate-90">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"semibold"}
                        className="uppercase"
                      >
                        COST
                      </Text>
                    </div>

                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"semibold"}
                        className="uppercase"
                      >
                        Batch Size
                      </Text>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DiscountEligibility;
