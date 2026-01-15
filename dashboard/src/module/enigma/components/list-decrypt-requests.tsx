"use client";
import Button from "@/components/button";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useConfig } from "@/providers/ConfigProvider";
import EnigmaService from "@/services/enigma";
import { DecryptionRequestListItem } from "@/services/enigma/response";
import { ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 10;

const ListDecryptRequests = () => {
  const { token } = useConfig();
  const { error: errorToast } = useAppToast();

  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState("");
  const [requests, setRequests] = useState<DecryptionRequestListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (newOffset = 0) => {
    if (!token) return;
    if (!appId) {
      errorToast({ label: "Please enter App ID" });
      return;
    }

    try {
      setLoading(true);
      const response = await EnigmaService.listDecryptRequests({
        token,
        turbo_da_app_id: appId,
        offset: newOffset,
        limit: PAGE_SIZE,
      });

      setRequests(response.items);
      setTotal(response.total);
      setOffset(response.offset);
      setHasSearched(true);
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to fetch decrypt requests" });
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      handleSearch(Math.max(0, offset - PAGE_SIZE));
    }
  };

  const handleNextPage = () => {
    if (offset + PAGE_SIZE < total) {
      handleSearch(offset + PAGE_SIZE);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "text-green";
      case "pending":
        return "text-yellow";
      case "failed":
        return "text-red";
      default:
        return "text-blue";
    }
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* Search Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">
            List Decrypt Requests
          </Text>
          <Text variant="light-grey" size="sm">
            View all decryption requests for an application.
          </Text>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <PrimaryInput
              label="Turbo DA App ID"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={appId}
              onChange={setAppId}
            />
          </div>
          <Button
            className="w-12 h-12 rounded-lg p-0 mb-[2px]"
            onClick={() => handleSearch(0)}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Search size={20} />
            )}
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Text variant="light-grey" size="lg">
                No decrypt requests found
              </Text>
              <Text variant="light-grey" size="sm">
                No decryption requests have been created for this application
                yet.
              </Text>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <Text size="lg" weight="semibold">
                  Decrypt Requests ({total})
                </Text>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="w-8 h-8 p-0"
                      onClick={handlePrevPage}
                      disabled={offset === 0 || loading}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <Text size="sm" variant="light-grey">
                      {currentPage} / {totalPages}
                    </Text>
                    <Button
                      variant="secondary"
                      className="w-8 h-8 p-0"
                      onClick={handleNextPage}
                      disabled={offset + PAGE_SIZE >= total || loading}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border-blue overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border-blue bg-black/20">
                      <TableHead className="text-light-grey">
                        Request ID
                      </TableHead>
                      <TableHead className="text-light-grey">Status</TableHead>
                      <TableHead className="text-light-grey">
                        Signatures
                      </TableHead>
                      <TableHead className="text-light-grey">
                        Threshold
                      </TableHead>
                      <TableHead className="text-light-grey">
                        Created At
                      </TableHead>
                      <TableHead className="text-light-grey">
                        Completed At
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow
                        key={request.id}
                        className="border-border-blue/50"
                      >
                        <TableCell className="font-mono text-sm">
                          {request.id.slice(0, 8)}...
                          {request.id.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${getStatusColor(request.status)}`}
                          >
                            {request.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {request.submitted_signatures || "0"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {request.threshold}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-light-grey">
                          {formatDate(request.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-light-grey">
                          {request.completed_at
                            ? formatDate(request.completed_at)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ListDecryptRequests;
