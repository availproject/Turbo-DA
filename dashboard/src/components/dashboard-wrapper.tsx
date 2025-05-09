import { APP_TABS } from "@/lib/utils";
import { SignedIn } from "@clerk/nextjs";
import Link from "next/link";
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
    <div className="relative min-h-[90vh] bg-[#112235] pb-10">
      <main className="container max-w-[1200px] mx-auto px-4 py-10 w-full">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Text size={"2xl"} weight={"bold"} as="h1">
              Turbo DA
            </Text>
            <div className="flex items-start justify-between w-full">
              <Text size={"base"} weight={"medium"} variant={"light-grey"}>
                Buy credits, post data at a guaranteed rate.
              </Text>
            </div>
            <Tabs defaultValue={selectedTab} className="w-full gap-y-0">
              <TabsList className="bg-transparent p-0 h-auto pb-4">
                {mainTabs.map((tab) => (
                  <Fragment key={tab.value}>
                    {tab.isAuthRequired ? (
                      <SignedIn>
                        <Link href={tab.link}>
                          <TabsTrigger value={tab.value} variant="outline">
                            {tab.label}
                          </TabsTrigger>
                        </Link>
                      </SignedIn>
                    ) : (
                      <Link href={tab.link}>
                        <TabsTrigger value={tab.value} variant="outline">
                          {tab.label}
                        </TabsTrigger>
                      </Link>
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
