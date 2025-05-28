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
import { formatDataBytes, formatInKB } from "@/lib/utils";
import CreditService from "@/services/credit";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

function DiscountEligibility({ token }: { token?: string }) {
  const [batchValue, setBatchValue] = useState<number>();
  const deferredQuery = useDeferredValue(batchValue);
  const debouncedValue = useDebounce(deferredQuery, 500);
  const [credits, setCredits] = useState();
  const { open, setOpen } = useDialog();
  // const state = useFetch({
  //   url: `${process.env.NEXT_PUBLIC_API_URL}/v1/user/estimate_credits`,
  //   params: { data: debouncedValue },
  // });

  useEffect(() => {
    if (!token) return;
    if (!debouncedValue) {
      return;
    }

    CreditService.creditEstimates({
      token,
      data: +formatInKB(debouncedValue) || 0,
    })
      .then((response) => {
        setCredits(response?.data);
      })
      .catch((error) => {
        console.log(error);
      });
  }, [debouncedValue]);

  const batchSizeData = useMemo(() => {
    if (!debouncedValue) {
      return {
        size: "100 KB",
        discount: "50%",
        originalCredits: "500",
        equivalentCredits: "1000",
      };
    }

    const entervalue = formatDataBytes(debouncedValue);

    if (debouncedValue >= 100 * 1024) {
      const originalCredits = credits ? formatDataBytes(credits) : entervalue;
      return {
        size: formatDataBytes(debouncedValue),
        discount: "50%",
        originalCredits,
        equivalentCredits: credits
          ? formatDataBytes(+credits * 2)
          : originalCredits,
      };
    }

    return {
      size: entervalue,
      originalCredits: entervalue,
    };
  }, [debouncedValue, credits]);

  return (
    <Dialog
      open={open === "main-credit-balance"}
      onOpenChange={(value) => !value && setOpen("")}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative">
            <DialogHeader className="p-4 pb-0 flex justify-between flex-row">
              <DialogTitle>
                <Text weight={"bold"} size={"2xl"} as="span">
                  Fee Discount Calculator
                </Text>
              </DialogTitle>
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </DialogHeader>

            <div className="flex flex-col p-4 gap-4 mt-2">
              <PrimaryInput
                placeholder="eg. 100 KB"
                value={`${batchValue ?? ""}`}
                label={"Enter Your Batch Size"}
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
                  {batchSizeData.discount ? (
                    <>
                      <Text
                        as="span"
                        weight={"medium"}
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
                        Benefit: Your &apos;{batchSizeData.originalCredits}
                        &apos; credits would be equivalent to &apos;
                        {batchSizeData.equivalentCredits}&apos; credits.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text
                        as="span"
                        weight={"medium"}
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
                        weight={"bold"}
                        className="text-[#88d67b]"
                      >
                        {" "}
                        you will receive a{" "}
                      </Text>
                      <Text as="span" size={"sm"} weight={"bold"}>
                        {batchSizeData.originalCredits}
                      </Text>
                      <Text
                        as="span"
                        weight={"medium"}
                        size={"sm"}
                        className="text-[#88d67b]"
                      >
                        {" "}
                        on the fees.
                      </Text>
                    </>
                  )}
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
                      <Image
                        src={"/growth.svg"}
                        width={453}
                        height={168}
                        alt="growth graph"
                      />
                    </div>

                    <div className="absolute top-1/2 -left-10 transform -rotate-90">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"medium"}
                      >
                        Discount
                      </Text>
                    </div>

                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"medium"}
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
