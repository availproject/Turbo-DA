import DashboardWrapper from "@/components/dashboard-wrapper";
import TurboOnWallet from "@/components/lottie-comp/turbo-on-wallet";
import { TabsContent } from "@/components/tabs";
import { Text } from "@/components/text";
import HistoryWrapper from "@/components/transactions-history";
import { Card } from "@/components/ui/card";
import { HISTORY_TYPES } from "@/lib/types";
import { APP_TABS, template } from "@/lib/utils";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import dynamic from "next/dynamic";
import { Suspense } from "react";
const CreditUsage = dynamic(() => import("@/components/credit-usage"), {
  loading: () => <div>Loading....</div>,
});
const CreditHistory = dynamic(
  () => import("@/components/transactions-history/credit-history"),
  {
    loading: () => <div>Loading....</div>,
  }
);
const DataPostingHistory = dynamic(
  () => import("@/components/transactions-history/data-posting-history"),
  {
    loading: () => <div>Loading....</div>,
  }
);

const BuyCreditsCard = dynamic(() => import("@/components/buy-credit-cards"));
const CreditBalance = dynamic(() => import("@/module/credit-balance"));
const AppsCard = dynamic(() => import("@/components/apps-card"));

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
          <div className="flex flex-col min-lg:flex-row gap-4">
            <div className="flex flex-col w-full gap-4">
              <SignedIn>
                <CreditBalance token={token} />
                <AppsCard token={token} />
              </SignedIn>
              <SignedOut>
                <Card className="border-border-grey shadow-primary rounded-lg pt-0 gap-0 flex-1 flex justify-center items-center flex-col gap-y-2.5 h-[520px] bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] relative">
                  <div className="bg-[url('/sign-in-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
                  <TurboOnWallet />
                  <Text weight={"semibold"} size={"base"}>
                    Sign In and Connect Your Wallet To Buy Credits
                  </Text>
                </Card>
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
