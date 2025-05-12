"use client";
import { APP_TABS } from "@/lib/utils";
import { SignedIn } from "@clerk/nextjs";
import { Fragment, ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import { Text } from "./text";

const DashboardWrapper = ({
  selectedTab,
  children,
}: {
  selectedTab: APP_TABS;
  children: ReactNode;
}) => {
  const mainTabs = [
    {
      value: "overview",
      label: "Overview",
      link: "/",
    },
    {
      value: "history",
      label: "History",
      link: "/history",
      isAuthRequired: true,
    },
  ];

  return (
    <div className="relative min-h-[90vh] pb-10">
      <main className="container max-w-[1200px] mx-auto px-4 py-10 w-full">
        <div className="flex flex-col gap-4">
          <div>
            <Text size={"3mxl"} weight={"semibold"}>
              Turbo DA
            </Text>
            <Text size={"base"} weight={"medium"} variant={"secondary-grey"}>
              Buy credits, post data at a guaranteed rate.
            </Text>
            <Tabs
              defaultValue={APP_TABS.OVERVIEW}
              className="w-full gap-y-0 mt-3"
            >
              <TabsList className="bg-transparent p-0 h-auto pb-4">
                {mainTabs.map((tab) => (
                  <Fragment key={tab.value}>
                    {tab.isAuthRequired ? (
                      <SignedIn>
                        <TabsTrigger value={tab.value} variant="outline">
                          {tab.label}
                        </TabsTrigger>
                      </SignedIn>
                    ) : (
                      <TabsTrigger value={tab.value} variant="outline">
                        {tab.label}
                      </TabsTrigger>
                    )}
                  </Fragment>
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

export default DashboardWrapper;
