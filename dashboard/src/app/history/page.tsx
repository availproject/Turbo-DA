import DashboardWrapper from "@/components/dashboard-wrapper";
import { TabsContent } from "@/components/tabs";
import { Text } from "@/components/text";
import HistoryWrapper from "@/components/transactions-history";
import CreditHistory from "@/components/transactions-history/credit-history";
import DataPostingHistory from "@/components/transactions-history/data-posting-history";
import { HISTORY_TYPES, PageProps } from "@/lib/types";
import { APP_TABS, template } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

export default async function Page({ searchParams }: PageProps) {
  const { getToken } = await auth();
  const token = (await getToken({ template })) ?? undefined;
  const selectedHistory = await searchParams;

  return (
    <DashboardWrapper selectedTab={APP_TABS.HISTORY}>
      <TabsContent
        value={APP_TABS.HISTORY}
        className="border-t border-[#575757] pt-4 w-full"
      >
        <Suspense
          fallback={
            <Text size={"xs"} color="white">
              Loading...
            </Text>
          }
        >
          <HistoryWrapper
            selectedHistory={selectedHistory?.type as HISTORY_TYPES}
          >
            <TabsContent value={HISTORY_TYPES.CREDIT}>
              <CreditHistory token={token} />
            </TabsContent>
            <TabsContent value={HISTORY_TYPES.PUBLISH}>
              <DataPostingHistory token={token} />
            </TabsContent>
          </HistoryWrapper>
        </Suspense>
      </TabsContent>
    </DashboardWrapper>
  );
}
