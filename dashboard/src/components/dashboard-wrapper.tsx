"use client";
import { APP_TABS } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { memo, ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";
import { Copy } from "lucide-react";

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
              <div className="flex justify-between">
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
                <div
                  className="w-[464px] px-[8px] py-[12px] border border-[#4C4C4C] rounded-t-[8px] flex items-center"
                  style={{
                    background:
                      "var(--Gradient-Secondary-Base, linear-gradient(90deg, var(--Color-bg-gradients-surface-secondary-leftshade, #0D2335) 0%, var(--Color-bg-gradients-surface-secondary-rightshade, #141B29) 100%))",
                  }}
                >
                  <p className="text-[#CCC] font-semibold leading-[18px] text-sm">
                    API Endpoint:{" "}
                    <span className="text-[#3CA3FC] text-base">
                      https://infinity.turbo-api.availproject.org/ 
                    </span>
                  </p>
                  <Copy
                    className="ml-[6px] cursor-pointer hover:opacity-80"
                    size={20}
                    color="#FFFFFF"
                    strokeWidth={1}
                    onClick={() => {
                      navigator.clipboard.writeText(
                        "https://infinity.turbo-api.availproject.org/"
                      );
                    }}
                  />
                </div>
              </div>
              {children}
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default memo(DashboardWrapper);
