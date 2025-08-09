"use client";
import { APP_TABS } from "@/lib/utils";
import { useOverview } from "@/providers/OverviewProvider";
import { memo, ReactNode, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";
import { Check, Copy } from "lucide-react";
const DashboardWrapper = ({ children }: { children: ReactNode }) => {
  const { setMainTabSelected, mainTabSelected } = useOverview();
  const [isCopied, setIsCopied] = useState(false);
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const displayApiUrl = rawApiUrl.replace(/\/core-api\/?$/, "");
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
                  className=" px-[8px] py-[12px] border border-[#4C4C4C] rounded-t-[8px] flex items-center"
                  style={{
                    background:
                      "var(--Gradient-Secondary-Base, linear-gradient(90deg, var(--Color-bg-gradients-surface-secondary-leftshade, #0D2335) 0%, var(--Color-bg-gradients-surface-secondary-rightshade, #141B29) 100%))",
                  }}
                >
                  <p className="text-[#CCC] font-semibold leading-[18px] text-sm">
                    API Endpoint:{" "}
                    <span className="text-[#3CA3FC] text-base">
                      {displayApiUrl}
                    </span>
                  </p>
                  <div className="mx-[6px] cursor-pointer relative ">
                    <Copy
                      className={`absolute transition-opacity duration-100 hover:opacity-80 ${
                        isCopied
                          ? "opacity-0 pointer-events-none"
                          : "opacity-100"
                      }`}
                      size={20}
                      color="#FFFFFF"
                      strokeWidth={1}
                      onClick={() => {
                        navigator.clipboard.writeText(displayApiUrl);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                    />
                    <Check
                      className={`transition-opacity duration-100 ${
                        isCopied
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                      }`}
                      size={20}
                      color="#22C55E"
                      strokeWidth={1}
                    />
                  </div>
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
