"use client";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Text } from ".//text";
import { Card, CardHeader, CardTitle } from "./ui/card";

import { useState } from "react";
import SecondarySelect from "./select/secondary-select";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "./ui/chart";

const chartData = [
  { appName: "App 1", assignedBalance: 2000, mainBalance: 2000 },
  { appName: "App 2", assignedBalance: 1750, mainBalance: 2000 },
  { appName: "App 3", assignedBalance: 1500, mainBalance: 2000 },
  { appName: "App 4", assignedBalance: 1250, mainBalance: 2000 },
  { appName: "App 5", assignedBalance: 1000, mainBalance: 2000 },
  { appName: "App 6", assignedBalance: 750, mainBalance: 2000 },
  { appName: "App 7", assignedBalance: 500, mainBalance: 2000 },
  { appName: "App 8", assignedBalance: 250, mainBalance: 2000 },
];

const chartConfig = {
  assignedBalance: {
    label: "Assigned Balance",
  },
  mainBalance: {
    label: "Main Balance",
  },
} satisfies ChartConfig;

const month = [
  "Jan",
  "Feb",
  "March",
  "April",
  "May",
  "June",
  "July",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

const CreditUsage = () => {
  const [filter, setFilter] = useState(month[0]);

  return (
    <Card className="w-full min-lg:w-[464px] shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl p-0 gap-0 overflow-hidden relative">
      <div className="bg-[url('/credit-usage-noise.png')] bg-repeat absolute h-full w-full min-lg:w-[464px] opacity-80" />
      <div className="flex flex-col z-1 relative">
        <CardHeader className="p-4 border-b border-border-blue">
          <div className="flex items-center justify-between">
            <CardTitle>
              <Text weight={"semibold"} size={"xl"}>
                Credit Usage
              </Text>
            </CardTitle>
            <SecondarySelect
              options={month}
              onChange={(value) => setFilter(value)}
              value={filter}
            />
          </div>
        </CardHeader>
        <ChartContainer
          config={chartConfig}
          className="min-h-[340px] w-full my-4 -ml-2"
        >
          <BarChart accessibilityLayer data={chartData}>
            <Bar dataKey="mainBalance" fill="#88D67B" radius={[3, 3, 0, 0]} />
            <Bar
              dataKey="assignedBalance"
              fill="#EB7BF4"
              radius={[3, 3, 0, 0]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel={true}
                  className="bg-black border border-border-grey shadow-primary text-white"
                />
              }
              cursor={false}
            />
            <XAxis
              dataKey="appName"
              tickLine={false}
              tickMargin={10}
              axisLine={true}
              fontWeight={500}
              style={{
                fill: "#C6CACF",
              }}
            />
            <YAxis
              dataKey="assignedBalance"
              tickLine={false}
              tickMargin={10}
              axisLine={true}
              tickCount={9}
              style={{
                fill: "#C6CACF",
              }}
              fontWeight={500}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  );
};

export default CreditUsage;
