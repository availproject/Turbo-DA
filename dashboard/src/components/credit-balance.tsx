"use client";
import { formatDataBytes } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { Wallet } from "lucide-react";
import Button from "./button";
import { useDialog } from "./dialog/provider";
import DiscountEligibility from "./discount-eligibility";
import { Text } from "./text";
import { Card, CardContent } from "./ui/card";

type CreditBalanceProps = {
  token?: string;
};

const CreditBalance = ({ token }: CreditBalanceProps) => {
  const { setOpen } = useDialog();
  const { creditBalance } = useOverview();

  return (
    <>
      <Card className="shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl p-0">
        <CardContent className="p-4">
          <div className="flex flex-col justify-between">
            <div className="flex items-start gap-x-1.5">
              <Wallet
                size={36}
                color="#B3B3B3"
                strokeWidth={1}
                className="mt-1"
              />
              <div className="flex flex-col">
                <Text
                  as="span"
                  size={"sm"}
                  weight={"medium"}
                  variant={"secondary-grey"}
                >
                  Main Credit Balance
                </Text>
                <Text as="span" weight={"bold"} size={"2xl"} className="mt-1">
                  {!!creditBalance ? formatDataBytes(creditBalance) : "-"}
                </Text>
              </div>
            </div>
            <Button
              variant={"link"}
              className="underline-offset-[1.5px] decoration-[1px] mt-2.5 ml-10 w-fit"
              onClick={() => setOpen("main-credit-balance")}
            >
              <Text
                as="span"
                size={"sm"}
                weight={"semibold"}
                variant={"grey-500"}
              >
                Check Fees Discount Eligibility
              </Text>
            </Button>
          </div>
        </CardContent>
      </Card>
      <DiscountEligibility token={token} />
    </>
  );
};

export default CreditBalance;
