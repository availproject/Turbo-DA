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
import Image from "next/image";
import useTransactions from "@/hooks/useTransactions";
import { useAuth } from "@clerk/nextjs";
import { get } from "http";
import { useCommonStore } from "@/store/common";
import { IconBookOpen } from "degen";
import NoData from "./ui/nodata";
import { Logger } from "@/lib/logger";
import { Spinner } from "./ui/spinner";

export default function Component() {
  const { getTokenBalances } = useTransactions();
  const { isSignedIn, isLoaded } = useAuth();
  const { tokenBalances } = useCommonStore();

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(tokenBalances.length / itemsPerPage);

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

  const paginatedtokenBalances = tokenBalances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    (async () => {
      if (isSignedIn && isLoaded) {
        try {
          setBalanceLoading(true);
          await getTokenBalances();
        } catch (error: any) {
          Logger.error(`Error fetching token balances ${error.message}`);
        } finally {
          setBalanceLoading(false);
        }
      }
    })();
  }, [getTokenBalances, isLoaded, isSignedIn]);

  return balanceLoading ? <Spinner className="!h-[20vh]"/> : (
    <>
      <Table>
        {paginatedtokenBalances.length > 0 ? (
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Logo</TableHead>
              <TableHead className="whitespace-nowrap">Token Name</TableHead>
              <TableHead>Token Address</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Amount Spent</TableHead>
            </TableRow>
          </TableHeader>
        ) : null}

        <TableBody>
          {paginatedtokenBalances.length > 0 ? (
            paginatedtokenBalances.map((token, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                <TableCell>
                  <Image
                    src={token.token_image}
                    alt={`${token.token_name} logo`}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {token.token_name}
                </TableCell>
                <TableCell className="font-mono">
                <div className="flex items-center space-x-2">
                    <span>{token.token_address.substring(0, 4)}...{token.token_address.slice(-3)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(token.token_address, index)
                      }
                      className="h-8 w-8 p-0"
                    >
                      <Copy
                        className={`h-4 w-4 ${
                          copiedId === index ? "text-green-500" : ""
                        }`}
                      />
                      <span className="sr-only">Copy address</span>
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                <span className="whitespace-nowrap"> {token.token_balance} {token.token_ticker}</span> 
                </TableCell>
                <TableCell className="text-right">
                <span className="whitespace-nowrap"> {token.token_used} {token.token_ticker}</span> 
                </TableCell>
              </TableRow>
            ))
          ) : (
            <NoData
              content={"You have no balances, try transferring some tokens?"}
              icon={<IconBookOpen size={"64px"} />}
            />
          )}
        </TableBody>
      </Table>

      {paginatedtokenBalances.length > 0 && (
        <div className="mt-4 flex flex-row justify-between items-center space-x-2">
          {" "}
          <div className="flex flex-row items-center justify-center space-x-1">
            <InfoIcon className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-[#ffffff84]">
              Recent balances may take up to 1-2 hours to be reflected in this
              table.
            </span>
          </div>{" "}
          <div className="flex flex-row items-center justify-end space-x-2">
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
              <span className="hidden md:flex"></span>{" "}
              <span>
                {" "}
                {currentPage} of {totalPages}
              </span>
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
          </div>{" "}
        </div>
      )}
    </>
  );
}
