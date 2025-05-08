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
    color: "#dadada",
  },
  mainBalance: {
    label: "Main Balance",
    color: "#dadada",
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

const CreditUsage = ({ token }: { token?: string }) => {
  const [filter, setFilter] = useState(month[0]);

  return (
    <Card className="w-full min-lg:w-[464px] bg-[#192A3D] rounded-2xl border-[#444753] p-0 gap-0">
      <CardHeader className="p-4 border-b border-[#565656]">
        <div className="flex items-center justify-between">
          <CardTitle>
            <Text weight={"bold"} size={"xl"}>
              Credit Usage
            </Text>
          </CardTitle>
          <SecondarySelect
            label="Time"
            options={month}
            onChange={(value) => setFilter(value)}
            value={filter}
          />
        </div>
      </CardHeader>
      <ChartContainer
        config={chartConfig}
        className="min-h-[340px] w-full my-4"
      >
        <BarChart accessibilityLayer data={chartData}>
          <Bar dataKey="assignedBalance" fill="#EB7BF4" radius={[3, 3, 0, 0]} />
          <Bar dataKey="mainBalance" fill="#88D67B" radius={[3, 3, 0, 0]} />
          <ChartTooltip
            content={
              <ChartTooltipContent className="bg-[#0F1F30] border border-[#444753] text-white" />
            }
            cursor={false}
          />
          <XAxis
            dataKey="appName"
            tickLine={false}
            tickMargin={10}
            axisLine={true}
          />
          <YAxis
            dataKey="assignedBalance"
            tickLine={false}
            tickMargin={10}
            axisLine={true}
            tickCount={7}
          />
        </BarChart>
      </ChartContainer>
    </Card>
  );
};

export default CreditUsage;
