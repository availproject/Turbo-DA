"use client";
import { Tabs, TabsList, TabsTrigger } from "@/components/tabs";
import { HISTORY_TYPES } from "@/lib/types";
import { ReactNode } from "react";

const HistoryWrapper = ({ children }: { children: ReactNode }) => {
  const historyTabs = [
    { value: HISTORY_TYPES.CREDIT, label: "Credit History" },
    {
      value: HISTORY_TYPES.PUBLISH,
      label: "Data Posting History",
    },
  ];

  return (
    <Tabs defaultValue={HISTORY_TYPES.CREDIT} className="w-full gap-y-0">
      <TabsList className="bg-transparent p-0 h-auto pb-4">
        {historyTabs.map((tab) => (
          <TabsTrigger value={tab.value} key={tab.value} variant="secondary">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
};

export default HistoryWrapper;
