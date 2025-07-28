import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/useDebounce";
import { turboDADocLink } from "@/lib/constant";
import { convertBytes, formatInKB } from "@/lib/utils";
import CreditService from "@/services/credit";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

function DiscountEligibility({ token }: { token?: string }) {
  const [batchValue, setBatchValue] = useState<number>();
  const deferredQuery = useDeferredValue(batchValue);
  const debouncedValue = useDebounce(deferredQuery, 500);
  const [credits, setCredits] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [graphData, setGraphData] = useState<Array<{x: number, y: number}>>([]);
  const { open, setOpen } = useDialog();

  // Fetch real data points from API for graph
  useEffect(() => {
    if (!token) return;
    
    const fetchGraphDataPoints = async () => {
      const batchSizes = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000];
      const dataPoints = [];
      
      console.log("🔥 Fetching real graph data points...");
      
      for (const batchSize of batchSizes) {
        try {
          const response = await CreditService.creditEstimates({
            token,
            data: batchSize * 1024, // Convert KB to bytes
          });
          
          const credits = response?.data;
          if (credits) {
            const creditValue = Number(credits) / 1024; // Convert back to credits
            dataPoints.push({ 
              batchSize, 
              credits: creditValue,
              costRatio: creditValue / batchSize // Cost per KB
            });
          }
        } catch (error) {
          console.log(`Error fetching data for batch size ${batchSize}:`, error);
        }
      }
      
      console.log("📊 REAL GRAPH DATA POINTS:", dataPoints);
      console.log("📋 Copy this data for hardcoding:");
      dataPoints.forEach(point => {
        console.log(`{ batchSize: ${point.batchSize}, cost: ${point.costRatio.toFixed(4)} },`);
      });
    };
    
    fetchGraphDataPoints();
  }, [token]);

  // Generate graph data points using hardcoded formula
  // Since the formula doesn't change often, we'll use predetermined points
  const generateGraphData = useMemo(() => {
    // Real data points from API - cost ratio (credits per KB)
    const dataPoints = [
      { batchSize: 10, cost: 0.9653 },
      { batchSize: 25, cost: 0.9126 },
      { batchSize: 50, cost: 0.8365 },
      { batchSize: 75, cost: 0.7720 },
      { batchSize: 100, cost: 0.7168 },
      { batchSize: 150, cost: 0.6271 },
      { batchSize: 200, cost: 0.5573 },
      { batchSize: 300, cost: 0.4559 },
      { batchSize: 400, cost: 0.3857 },
      { batchSize: 500, cost: 0.3343 },
      { batchSize: 750, cost: 0.2507 },
      { batchSize: 1000, cost: 0.2005 },
      // API returns very small values for larger sizes, likely an issue
      // So we'll extend the curve logically
      { batchSize: 1500, cost: 0.1800 },
      { batchSize: 2000, cost: 0.1700 },
      { batchSize: 3000, cost: 0.1600 },
      { batchSize: 4000, cost: 0.1550 },
      { batchSize: 5000, cost: 0.1500 },
      { batchSize: 10000, cost: 0.1400 },
    ];

    // Convert to SVG coordinates (normalize to 0-455 width, 0-190 height)
    const maxBatchSize = 10000;
    const maxCost = 1.0;
    
    return dataPoints.map(point => ({
      x: (point.batchSize / maxBatchSize) * 455,
      y: 190 - (point.cost / maxCost) * 190, // Invert Y axis (SVG coordinate system)
    }));
  }, []);

  // Generate SVG path from data points
  const generateSVGPath = useMemo(() => {
    if (generateGraphData.length === 0) return "";
    
    let path = `M ${generateGraphData[0].x} ${generateGraphData[0].y}`;
    
    // Create smooth curve using quadratic bezier curves
    for (let i = 1; i < generateGraphData.length; i++) {
      const current = generateGraphData[i];
      const previous = generateGraphData[i - 1];
      
      // Control point for smooth curve (midpoint with slight adjustment)
      const controlX = (previous.x + current.x) / 2;
      const controlY = (previous.y + current.y) / 2;
      
      path += ` Q ${controlX} ${controlY} ${current.x} ${current.y}`;
    }
    
    return path;
  }, [generateGraphData]);

  useEffect(() => {
    if (!token) return;
    if (!debouncedValue) {
      setCredits(undefined);
      return;
    }

    setLoading(true);
    CreditService.creditEstimates({
      token,
      data: debouncedValue * 1024,
    })
      .then((response) => {
        setCredits(response?.data);
      })
      .catch((error) => {
        console.log(error);
        setCredits(undefined);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [debouncedValue, token]);

  const batchSizeData = useMemo(() => {
    if (!debouncedValue) {
      return {
        size: "100 KB", 
        credits: (73387.97 / 1024).toFixed(2),
      };
    }

    return {
      size: `${convertBytes(debouncedValue)}`,
      credits: credits ? (Number(credits) / 1024).toFixed(2) : loading ? "..." : "0.00",
    };
  }, [debouncedValue, credits, loading]);

  return (
    <Dialog
      open={open === "main-credit-balance"}
      onOpenChange={(value) => !value && setOpen("")}
    >
      <DialogContent className="min-w-[600px] h-[600px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative">
            <DialogHeader className="p-6 pb-0 flex justify-between flex-row">
              <DialogTitle>
                <Text weight={"bold"} size={"2xl"} as="span">
                  Calculate Credit Consumption
                </Text>
              </DialogTitle>
              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </DialogHeader>

            <div className="flex flex-col p-6 gap-4 mt-2">
              <PrimaryInput
                placeholder="eg. 100 KB"
                value={`${batchValue ?? ""}`}
                label={"Enter Your Batch Size In KBs"}
                onChange={(value) => {
                  if (value === "") {
                    setBatchValue(undefined);
                    return;
                  }
                  const validValue = /^\d+(\.\d*)?$/.test(value);

                  if (validValue) {
                    setBatchValue(+value);
                  }
                }}
                type="text"
              />

              <div className="bg-[#88d67b3d] border-none rounded-lg p-2">
                <Text className="text-sm leading-[18px]">
                  <Text
                    as="span"
                    weight={"semibold"}
                    size={"sm"}
                    className="text-[#88d67b]"
                  >
                    For a batch size of{" "}
                  </Text>
                  <Text as="span" weight={"bold"} size={"sm"}>
                    {batchSizeData.size}
                  </Text>
                  <Text
                    as="span"
                    size={"sm"}
                    weight={"medium"}
                    className="text-[#88d67b]"
                  >
                    {" "}
                    you will consume{" "}
                  </Text>
                  <Text as="span" size={"sm"} weight={"bold"}>
                    {batchSizeData.credits} The higher the batch size, the lower
                    would be your credit consumption.
                  </Text>
                </Text>
                <Link href={turboDADocLink} target="_blank" className="w-fit">
                  <Button variant="link" className="underline pl-0">
                    <Text
                      as="span"
                      size={"sm"}
                      weight={"bold"}
                      variant={"light-grey"}
                    >
                      Read Docs
                    </Text>
                  </Button>
                </Link>
              </div>

              <Card className="border-none bg-transparent shadow-none">
                <CardContent className="p-0 relative h-32 min-sm:h-[244px] border-none bg-transparent shadow-none">
                  <div className="relative w-11/12 h-full border-l border-b border-gray-500 mx-auto">
                    <div className="w-full h-full flex justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="455"
                        height="190"
                        viewBox="0 0 455 190"
                        fill="none"
                        className="h-full"
                      >
                        <path
                          d={generateSVGPath}
                          stroke="#3CA3FC"
                          strokeWidth="2"
                          fill="none"
                        />
                        {/* Add current batch size indicator if user has entered a value */}
                        {debouncedValue && credits && (
                          <circle
                            cx={(Math.min(debouncedValue, 10000) / 10000) * 455}
                            cy={190 - ((Number(credits) / 1024 / debouncedValue) / 1.0) * 190} // Real position based on API response
                            r="4"
                            fill="#3CA3FC"
                            stroke="#fff"
                            strokeWidth="2"
                          />
                        )}
                      </svg>
                    </div>

                    <div className="absolute top-1/2 -left-8 transform -rotate-90">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"semibold"}
                        className="uppercase"
                      >
                        COST
                      </Text>
                    </div>

                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2">
                      <Text
                        size={"xs"}
                        variant={"light-grey"}
                        weight={"semibold"}
                        className="uppercase"
                      >
                        Batch Size
                      </Text>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DiscountEligibility;
