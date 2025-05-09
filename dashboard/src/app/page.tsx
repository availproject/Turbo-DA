import AppsCard from "@/components/apps-card";
import BuyCreditsCard from "@/components/buy-credit-cards";
import CreditBalance from "@/components/credit-balance";
import DashboardWrapper from "@/components/dashboard-wrapper";
import { TabsContent } from "@/components/tabs";
import { Text } from "@/components/text";
import { Card } from "@/components/ui/card";
import { APP_TABS, template } from "@/lib/utils";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Suspense } from "react";

const CreditUsage = dynamic(() => import("@/components/credit-usage"), {
  loading: () => <div>Loading....</div>,
});
export default async function Page() {
  const { getToken } = await auth();
  const token = (await getToken({ template })) ?? undefined;
  return (
    <DashboardWrapper selectedTab={APP_TABS.OVERVIEW}>
      <TabsContent
        value={APP_TABS.OVERVIEW}
        className="border-t border-[#575757] pt-4"
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
                <Card className="bg-[#192a3d] border-none shadow-[0px_4.37px_96.13px_-17.48px_#13151d] rounded-lg pt-0 gap-0 flex-1 flex justify-center items-center flex-col gap-y-2.5 h-[520px]">
                  <Image
                    src={"/signout.svg"}
                    width={159}
                    height={134}
                    alt="empty-state"
                  />
                  <Text weight={"semibold"} size={"base"}>
                    Sign In and Connect Your Wallet To Buy Credits
                  </Text>
                </Card>
              </SignedOut>
            </div>
            <div className="flex flex-col w-full min-lg:w-[721px] gap-4">
              <BuyCreditsCard token={token} />
              <SignedIn>
                <CreditUsage token={token} />
              </SignedIn>
            </div>
          </div>
        </Suspense>
      </TabsContent>
    </DashboardWrapper>
  );
}
