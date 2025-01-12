"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, ChevronLeft, ChevronRight, InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "./ui/badge";
import { useCommonStore } from "@/store/common";
import useTransactions from "@/hooks/useTransactions";
import { useAuth } from "@clerk/nextjs";
import NoData from "./ui/nodata";
import { Logger } from "@/lib/logger";
import { Spinner } from "./ui/spinner";

export default function Component() {
  const { recentTransactions } = useCommonStore();
  const { getTransactions } = useTransactions();
  const { isSignedIn, isLoaded } = useAuth();

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(recentTransactions.length / itemsPerPage);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast({
        title: "Copied!",
        description: "Token address copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const paginatedTokens = recentTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    (async () => {
      if (isSignedIn && isLoaded) {
        setTransactionLoading(true);
        try {
          await getTransactions();
        } catch (error: any) {
          Logger.error(`Error fetching token balances ${error.message}`);
        } finally {
          setTransactionLoading(false);
        }
      }
    })();
  }, [getTransactions, isLoaded, isSignedIn]);

  return transactionLoading ? (
    <Spinner className="!h-[20vh]"/>
  ) : (
    <>
      <Table>
        {paginatedTokens.length > 0 ? (
          <TableHeader className="border-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">#</TableHead>
              <TableHead className="whitespace-nowrap">Token Name</TableHead>
              <TableHead>Token Address</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right whitespace-nowrap">Transaction Status</TableHead>
            </TableRow>
          </TableHeader>
        ) : null}
        <TableBody>
          {paginatedTokens.length > 0 ? (
            paginatedTokens.map((token, index) => (
              <TableRow key={token.id} className="hover:bg-transparent">
                <TableCell className="font-medium">
                  {index}
                </TableCell>
                <TableCell className="font-medium">
                  {token.token_name}
                </TableCell>
                <TableCell className="font-mono">
                  <div className="flex items-center space-x-2">
                    <span>{token.token_address.substring(0, 4)}...</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(token.token_address, token.id)
                      }
                      className="h-8 w-8 p-0"
                    >
                      <Copy
                        className={`h-4 w-4 ${
                          copiedId === token.id ? "text-green-500" : ""
                        }`}
                      />
                      <span className="sr-only">Copy address</span>
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {/* {formatUnits(BigInt(token.amount_token_deposited), 18)} */}
                  {token.amount_token_deposited}
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={`px-2 py-1 ${
                      token.request_status === "Completed"
                        ? "border-[#343434] text-[#C0C0C0]"
                        : "border-[#4A3720] text-[#FF9E0B]"
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        token.request_status === "Completed"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      } animate-pulse`}
                    ></span>
                    {token.request_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <NoData
              content="No Previous Transactions Found"
              icon={<InfoIcon className="h-8 w-8 text-[#ffffff8b]" />}
            />
          )}
        </TableBody>
      </Table>
      <div className="mt-4 flex justify-end items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="h-6 w-6 bg-[#262626] !border-0 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>
        <span className="text-xs text-gray-400">
          {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          disabled={currentPage === totalPages}
          className="h-6 w-6 bg-[#262626] !border-0 p-0"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </>
  );
}
