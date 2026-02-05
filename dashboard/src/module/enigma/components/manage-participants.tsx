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
import { ChangeSignersRequest } from "@/services/enigma/response";
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Search,
  Wallet,
  ArrowLeft,
} from "lucide-react";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useModal } from "connectkit";
import { keccak256, toBytes } from "viem";

const PAGE_SIZE = 10;

type ViewMode = "list" | "create" | "detail";

const ChangeSignersManager = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedRequest, setSelectedRequest] = useState<ChangeSignersRequest | null>(null);
  const [appId, setAppId] = useState("");

  const handleSelectRequest = (request: ChangeSignersRequest) => {
    setSelectedRequest(request);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setSelectedRequest(null);
    setViewMode("list");
  };

  const handleCreateSuccess = () => {
    setViewMode("list");
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {viewMode === "list" && (
        <ChangeSignersList
          appId={appId}
          setAppId={setAppId}
          onSelect={handleSelectRequest}
          onCreate={() => setViewMode("create")}
        />
      )}
      {viewMode === "create" && (
        <ChangeSignersCreate
          appId={appId}
          onBack={handleBackToList}
          onSuccess={handleCreateSuccess}
        />
      )}
      {viewMode === "detail" && selectedRequest && (
        <ChangeSignersDetail
          request={selectedRequest}
          onBack={handleBackToList}
        />
      )}
    </div>
  );
};

// List Component
interface ChangeSignersListProps {
  appId: string;
  setAppId: (id: string) => void;
  onSelect: (request: ChangeSignersRequest) => void;
  onCreate: () => void;
}

const ChangeSignersList = ({ appId, setAppId, onSelect, onCreate }: ChangeSignersListProps) => {
  const { token } = useConfig();
  const { error: errorToast } = useAppToast();

  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ChangeSignersRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchRequests = async (newOffset = 0) => {
    if (!token) return;
    if (!appId) {
      errorToast({ label: "Please enter App ID" });
      return;
    }

    try {
      setLoading(true);
      const response = await EnigmaService.listChangeSignersRequests({
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
      errorToast({ label: err.message || "Failed to fetch change signers requests" });
      setRequests([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      fetchRequests(Math.max(0, offset - PAGE_SIZE));
    }
  };

  const handleNextPage = () => {
    if (offset + PAGE_SIZE < total) {
      fetchRequests(offset + PAGE_SIZE);
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
          <Text size="xl" weight="bold">Change Signers Requests</Text>
          <Text variant="light-grey" size="sm">
            View and manage change signers requests for an application.
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
            onClick={() => fetchRequests(0)}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Search size={20} />
            )}
          </Button>
          <Button
            className="w-12 h-12 rounded-lg p-0 mb-[2px]"
            onClick={onCreate}
            disabled={!appId}
            title="Create new request"
          >
            <Plus size={20} />
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Text variant="light-grey" size="lg">
                No change signers requests found
              </Text>
              <Text variant="light-grey" size="sm">
                No requests have been created for this application yet.
              </Text>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <Text size="lg" weight="semibold">
                  Requests ({total})
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
                      <TableHead className="text-light-grey">Request ID</TableHead>
                      <TableHead className="text-light-grey">Status</TableHead>
                      <TableHead className="text-light-grey">New Threshold</TableHead>
                      <TableHead className="text-light-grey">Participants</TableHead>
                      <TableHead className="text-light-grey">Created At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow
                        key={request.id}
                        className="border-border-blue/50 cursor-pointer hover:bg-white/5"
                        onClick={() => onSelect(request)}
                      >
                        <TableCell className="font-mono text-sm">
                          {request.id.slice(0, 8)}...{request.id.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{request.new_threshold}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{request.new_participants.length} addresses</span>
                        </TableCell>
                        <TableCell className="text-sm text-light-grey">
                          {formatDate(request.created_at)}
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

// Create Component
interface ChangeSignersCreateProps {
  appId: string;
  onBack: () => void;
  onSuccess: () => void;
}

const ChangeSignersCreate = ({ appId, onBack, onSuccess }: ChangeSignersCreateProps) => {
  const { token } = useConfig();
  const { success, error: errorToast } = useAppToast();

  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState("");
  const [threshold, setThreshold] = useState("");

  const handleSubmit = async () => {
    if (!token) return;

    if (!participants || !threshold) {
      errorToast({ label: "Please fill all fields" });
      return;
    }

    const participantsList = participants
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p);

    if (participantsList.length === 0) {
      errorToast({ label: "Please enter at least one participant address" });
      return;
    }

    const thresholdNum = parseInt(threshold, 10);
    if (isNaN(thresholdNum) || thresholdNum <= 0 || thresholdNum > participantsList.length) {
      errorToast({ label: "Threshold must be between 1 and the number of participants" });
      return;
    }

    try {
      setLoading(true);
      await EnigmaService.createChangeSignersRequest({
        token,
        turbo_da_app_id: appId,
        new_participants: participantsList,
        new_threshold: thresholdNum,
      });

      success({
        label: "Change Signers Request Created",
        description: "Your request has been created successfully.",
      });

      setParticipants("");
      setThreshold("");
      onSuccess();
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to create change signers request" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="w-8 h-8 p-0"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </Button>
        <Text size="xl" weight="bold">Create Change Signers Request</Text>
      </div>

      <Text variant="light-grey" size="sm">
        Create a new request to change the signers and threshold for app <span className="font-mono">{appId}</span>.
      </Text>

      <PrimaryInput
        label="New Participants (Comma separated addresses)"
        placeholder="e.g. 0x123..., 0x456..."
        value={participants}
        onChange={setParticipants}
      />

      <PrimaryInput
        label="New Threshold"
        placeholder="e.g. 2"
        value={threshold}
        onChange={setThreshold}
      />

      <Button
        className="mt-2"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : "Create Request"}
      </Button>
    </div>
  );
};

// Detail + Sign Component
interface ChangeSignersDetailProps {
  request: ChangeSignersRequest;
  onBack: () => void;
}

const ChangeSignersDetail = ({ request, onBack }: ChangeSignersDetailProps) => {
  const { token } = useConfig();
  const { success, error: errorToast } = useAppToast();

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();
  const { signMessageAsync } = useSignMessage();

  const [submitLoading, setSubmitLoading] = useState(false);

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

  const handleSign = async () => {
    console.log("handleSign called with request:", request);
    if (!token) return;
    if (!isConnected || !address) {
      openConnectModal(true);
      return;
    }

    try {
      setSubmitLoading(true);

      // Hash the participants array
      let participantsString: string;
      const participantsData = request.new_participants as unknown;
      if (typeof participantsData === 'string') {
        participantsString = participantsData;
      } else {
        participantsString = JSON.stringify(request.new_participants);
      }

      const hash = keccak256(toBytes(participantsString));
      // Remove 0x prefix to match Rust's hex::encode
      const hashWithout0x = hash.slice(2);

      console.log("Individual signing values:", {
        requestId: request.id,
        appId: request.turbo_da_app_id,
        participantsHash: hashWithout0x,
        newThreshold: request.new_threshold
      });

      // Message format: {request_id}:{turbo_da_app_id}:{keccak256_hash}:{new_threshold}
      const message = `${request.id}:${request.turbo_da_app_id}:${hashWithout0x}:${request.new_threshold}`;
      console.log("Signing message:", message);

      const signature = await signMessageAsync({ message });

      const response = await EnigmaService.submitChangeSignersSignature({
        token,
        request_id: request.id,
        participant_address: address,
        signature: signature,
      });

      console.log("Submit signature response:", response);

      success({
        label: "Signature Submitted",
        description: `Status: ${response.status}. Signatures: ${response.signatures_submitted}/${response.threshold}. Ready: ${response.ready_to_execute}`,
      });
    } catch (err: any) {
      console.error("Error in handleSign:", err);
      // User rejected signature or other error
      if (err.name === "UserRejectedRequestError" || err.message?.includes("rejected")) {
        errorToast({ label: "Signature rejected by user" });
      } else {
        errorToast({ label: err.message || "Failed to submit signature" });
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="w-8 h-8 p-0"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </Button>
        <Text size="xl" weight="bold">Change Signers Request Details</Text>
      </div>

      {/* Request Details */}
      <div className="flex flex-col gap-3 p-4 bg-black/20 rounded-lg border border-border-blue/50">
        <div className="flex justify-between">
          <Text variant="light-grey" size="sm">Request ID:</Text>
          <Text size="sm" className="font-mono">{request.id}</Text>
        </div>

        <div className="flex justify-between">
          <Text variant="light-grey" size="sm">App ID:</Text>
          <Text size="sm" className="font-mono">{request.turbo_da_app_id}</Text>
        </div>

        <div className="flex justify-between">
          <Text variant="light-grey" size="sm">Status:</Text>
          <Text weight="bold" className={getStatusColor(request.status)}>
            {request.status}
          </Text>
        </div>

        <div className="flex justify-between">
          <Text variant="light-grey" size="sm">New Threshold:</Text>
          <Text size="sm">{request.new_threshold}</Text>
        </div>

        <div className="flex flex-col gap-1 mt-2">
          <Text variant="light-grey" size="sm">New Participants:</Text>
          <div className="flex flex-col gap-1">
            {request.new_participants.map((participant, idx) => (
              <Text key={idx} size="xs" className="font-mono text-blue/80">
                {participant}
              </Text>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-2">
          <Text variant="light-grey" size="sm">Created At:</Text>
          <Text size="sm" className="text-light-grey">
            {formatDate(request.created_at)}
          </Text>
        </div>

        {request.completed_at && (
          <div className="flex justify-between">
            <Text variant="light-grey" size="sm">Completed At:</Text>
            <Text size="sm" className="text-light-grey">
              {formatDate(request.completed_at)}
            </Text>
          </div>
        )}
      </div>

      {/* Sign Section */}
      {request.status.toLowerCase() !== "completed" && (
        <div className="flex flex-col gap-3 mt-2">
          <Text size="lg" weight="semibold">Sign Request</Text>

          {isConnected && address ? (
            <div className="flex items-center gap-2 p-3 bg-green/10 border border-green/30 rounded-lg">
              <Wallet size={16} className="text-green" />
              <Text size="sm" className="text-green font-mono">
                {address.slice(0, 6)}...{address.slice(-4)}
              </Text>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-yellow/10 border border-yellow/30 rounded-lg">
              <Wallet size={16} className="text-yellow" />
              <Text size="sm" className="text-yellow">
                Connect your wallet to sign
              </Text>
            </div>
          )}

          <Button
            onClick={handleSign}
            disabled={submitLoading}
          >
            {submitLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : isConnected ? (
              "Sign & Submit"
            ) : (
              "Connect Wallet"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChangeSignersManager;
