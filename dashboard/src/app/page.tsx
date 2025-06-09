import DashboardWrapper from "@/components/dashboard-wrapper";
import TurboOnWallet from "@/components/lottie-comp/turbo-on-wallet";
import { TabsContent } from "@/components/tabs";
import { Text } from "@/components/text";
import { Card } from "@/components/ui/card";
import { HISTORY_TYPES } from "@/lib/types";
import { APP_TABS, template } from "@/lib/utils";
import HistoryWrapper from "@/module/transactions-history";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import dynamic from "next/dynamic";
import { Suspense } from "react";
const CreditHistory = dynamic(
  () => import("@/module/transactions-history/components/credit-history"),
  {
    loading: () => <div>Loading....</div>,
  },
);
const DataPostingHistory = dynamic(
  () => import("@/module/transactions-history/components/data-posting-history"),
  {
    loading: () => <div>Loading....</div>,
  },
);

const BuyCreditsCard = dynamic(() => import("@/module/purchase-credit"));
const CreditBalance = dynamic(() => import("@/module/credit-balance"));
const AppsCard = dynamic(() => import("@/module/user-apps"));

export default async function Page() {
  const { getToken } = await auth();
  const token = (await getToken({ template })) ?? undefined;
  return (
    <DashboardWrapper>
      <TabsContent
        value={APP_TABS.OVERVIEW}
        className="border-t border-[#2B4761] pt-4"
      >
        <Suspense
          fallback={
            <Text size={"xs"} color="white">
              Loading...
            </Text>
          }
        >
          <div className="flex gap-4">
            <div className="flex flex-col w-full gap-4">
              <SignedIn>
                <CreditBalance token={token} />
                <AppsCard token={token} />
              </SignedIn>
              <SignedOut>
                <div className="relative w-full h-[520px] rounded-2xl">
                  <div className="absolute w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px">
                    <Card className="border-none shadow-primary rounded-2xl pt-0 gap-0 flex-1 flex justify-center items-center flex-col gap-y-2.5 bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] relative h-full pb-0 overflow-hidden">
                      <div className="bg-[url('/sign-in-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
                      <TurboOnWallet />
                      <Text weight={"semibold"} size={"base"}>
                        Sign In and Connect Your Wallet To Buy Credits
                      </Text>
                    </Card>
                  </div>
                </div>
              </SignedOut>
            </div>
            <div className="flex flex-col w-full min-lg:w-[721px] gap-4">
              <BuyCreditsCard token={token} />
              {/* <SignedIn>
                <CreditUsage token={token} />
              </SignedIn> */}
            </div>
          </div>
        </Suspense>
      </TabsContent>
      <TabsContent
        value={APP_TABS.HISTORY}
        className="border-t border-[#2B4761] pt-4 w-full"
      >
        <HistoryWrapper>
          <TabsContent value={HISTORY_TYPES.CREDIT}>
            <CreditHistory token={token} />
          </TabsContent>
          <TabsContent value={HISTORY_TYPES.PUBLISH}>
            <DataPostingHistory token={token} />
          </TabsContent>
        </HistoryWrapper>
      </TabsContent>
    </DashboardWrapper>
  );
}
