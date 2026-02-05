"use client";
import DashboardWrapper from "@/components/dashboard-wrapper";
import TurboOnWallet from "@/components/lottie-comp/turbo-on-wallet";
import { TabsContent } from "@/components/tabs";
import { Text } from "@/components/text";
import { Card, CardContent } from "@/components/ui/card";
import { HISTORY_TYPES } from "@/lib/types";
import { APP_TABS } from "@/lib/utils";
import HistoryWrapper from "@/module/transactions-history";
import { useAuthState } from "@/providers/AuthProvider";
import { Key, ArrowRight } from "lucide-react";
import Link from "next/link";

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

export default function Page() {
  const { isLoggedOut } = useAuthState();

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
              <Link href="/mpc" className="block">
                <Card className="border-border-blue/30 bg-bg-secondary/50 shadow-primary hover:bg-bg-secondary/70 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue/30 to-blue/10 flex items-center justify-center border border-blue/20 group-hover:scale-105 transition-transform flex-shrink-0">
                        <Key size={24} className="text-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text weight="semibold" size="lg" className="text-white mb-1">
                          MPC Participant Portal
                        </Text>
                        <Text variant="light-grey" className="text-sm opacity-70">
                          Sign decryption requests without login
                        </Text>
                      </div>
                      <ArrowRight size={20} className="text-light-grey opacity-50 group-hover:text-blue group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <CreditBalance />
              <AppsCard />
              {isLoggedOut && (
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
              )}
            </div>
            <div className="flex flex-col w-full min-lg:w-[721px] gap-4">
              <BuyCreditsCard />
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
            <CreditHistory />
          </TabsContent>
          <TabsContent value={HISTORY_TYPES.PUBLISH}>
            <DataPostingHistory />
          </TabsContent>
        </HistoryWrapper>
      </TabsContent>
    </DashboardWrapper>
  );
}
