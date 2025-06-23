"use client";
import { APP_TABS } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { memo, ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";

const DashboardWrapper = ({ children }: { children: ReactNode }) => {
  const { setMainTabSelected, mainTabSelected } = useOverview();
  const mainTabs = [
    {
      value: APP_TABS.OVERVIEW,
      label: "Overview",
      link: "/",
    },
    {
      value: APP_TABS.HISTORY,
      label: "History",
      link: "/history",
    },
  ];

  return (
    <div className="relative min-h-[90vh] pb-12 pt-2">
      <main className="container max-w-[1200px] mx-auto px-4 py-10 w-full">
        <div className="flex flex-col gap-4">
          <div>
            <Text size={"3mxl"} weight={"semibold"}>
              TurboDA
            </Text>
            <Text size={"base"} weight={"medium"} variant={"secondary-grey"}>
              Buy credits, post data at a guaranteed rate.
            </Text>
            <Tabs value={mainTabSelected} className="w-full gap-y-0 mt-3">
              <TabsList className="bg-transparent p-0 h-auto relative -bottom-px">
                {mainTabs.map((tab) => (
                  <TabsTrigger
                    value={tab.value}
                    key={tab.value}
                    onClick={() => setMainTabSelected(tab.value)}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {children}
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default memo(DashboardWrapper);
