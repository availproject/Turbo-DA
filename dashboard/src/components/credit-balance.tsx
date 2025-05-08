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
      <Card className="bg-[#192a3d] border-none shadow-[0px_4.37px_96.13px_-17.48px_#13151d] rounded-2xl p-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={40} color="#FFF" strokeWidth={1} />
              <div className="flex flex-col gap-2">
                <Text
                  as="span"
                  size={"sm"}
                  weight={"medium"}
                  variant={"light-grey"}
                >
                  Main Credit Balance
                </Text>
                <Text as="span" weight={"bold"} size={"2xl"}>
                  {!!creditBalance ? formatDataBytes(creditBalance) : "-"}
                </Text>
                <Button
                  variant={"link"}
                  className="underline-offset-[2.5px]"
                  onClick={() => setOpen("main-credit-balance")}
                >
                  <Text
                    as="span"
                    size={"sm"}
                    weight={"bold"}
                    variant={"light-grey"}
                  >
                    Check Fees Discount Eligibility
                  </Text>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <DiscountEligibility token={token} />
    </>
  );
};

export default CreditBalance;
