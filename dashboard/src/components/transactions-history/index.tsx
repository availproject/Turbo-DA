"use client";
import { HISTORY_TYPES } from "@/lib/types";
import Link from "next/link";
import { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "../tabs";

const HistoryWrapper = ({
  selectedHistory = HISTORY_TYPES.CREDIT,
  children,
}: {
  selectedHistory?: HISTORY_TYPES;
  children: ReactNode;
}) => {
  const historyTabs = [
    { value: HISTORY_TYPES.CREDIT, label: "Credit History" },
    {
      value: HISTORY_TYPES.PUBLISH,
      label: "Data Posting History",
      isAuthRequired: true,
    },
  ];

  return (
    <Tabs defaultValue={selectedHistory} className="w-full gap-y-0">
      <TabsList className="bg-transparent p-0 h-auto pb-4">
        {historyTabs.map((tab) => (
          <Link key={tab.value} href={"/history?type=" + tab.value}>
            <TabsTrigger value={tab.value} key={tab.value} variant="regular">
              {tab.label}
            </TabsTrigger>
          </Link>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
};

export default HistoryWrapper;
