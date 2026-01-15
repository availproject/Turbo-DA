"use client";
import Button from "@/components/button";
import { DialogTitle } from "@/components/dialog";
import { useDialog } from "@/components/dialog/provider";
import PrimaryInput from "@/components/input/primary";
import AvatarWrapper from "@/components/lottie-comp/avatar-container";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { avatarList } from "@/lib/constant";
import { baseImageUrl, cn } from "@/lib/utils";
import { useConfig } from "@/providers/ConfigProvider";
import EnigmaService from "@/services/enigma";
import {
  DecryptionRequestListItem,
  GetDecryptRequestResponse,
} from "@/services/enigma/response";
import { AppDetails } from "@/services/app/response";
import { Close } from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Key,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useModal } from "connectkit";

const PAGE_SIZE = 10;

// Helper to parse submitted_signatures JSON string and get count
const getSignatureCount = (signaturesJson: string): number => {
  try {
    const parsed = JSON.parse(signaturesJson || "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
};

// Helper to convert byte array to hex string
const bytesToHex = (bytes: number[] | null | undefined): string => {
  if (!bytes || bytes.length === 0) return "";
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Helper to try decoding bytes as UTF-8 string
const bytesToString = (bytes: number[] | null | undefined): string => {
  if (!bytes || bytes.length === 0) return "";
  try {
    return new TextDecoder().decode(new Uint8Array(bytes));
  } catch {
    return bytesToHex(bytes);
  }
};

type EnigmaModalProps = {
  id: string;
  appData: AppDetails;
};

export default function EnigmaModal({ id, appData }: EnigmaModalProps) {
  const { open, setOpen } = useDialog();
  const { token } = useConfig();
  const { success, error: errorToast } = useAppToast();

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();
  const { signMessageAsync } = useSignMessage();

  // Tab state
  const [activeTab, setActiveTab] = useState<
    "history" | "create" | "participants"
  >("history");

  // Request History State
  const [historyLoading, setHistoryLoading] = useState(false);
  const [requests, setRequests] = useState<DecryptionRequestListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  // Selected Request State (for viewing details/submitting signature)
  const [selectedRequest, setSelectedRequest] =
    useState<DecryptionRequestListItem | null>(null);
  const [requestDetails, setRequestDetails] =
    useState<GetDecryptRequestResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Create Request State
  const [createLoading, setCreateLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState("");

  // Manage Participants State
  const [addLoading, setAddLoading] = useState(false);
  const [addParticipants, setAddParticipants] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteParticipants, setDeleteParticipants] = useState("");

  const turboAppId = appData.id;
  const hasFetchedRef = useRef(false);

  // Fetch request history
  const fetchHistory = useCallback(
    async (newOffset = 0) => {
      if (!token) return;

      try {
        setHistoryLoading(true);
        const response = await EnigmaService.listDecryptRequests({
          token,
          turbo_da_app_id: turboAppId,
          offset: newOffset,
          limit: PAGE_SIZE,
        });

        setRequests(response.items);
        setTotal(response.total);
        setOffset(response.offset);
      } catch (err: any) {
        errorToast({
          label: err.message || "Failed to fetch decrypt requests",
        });
        setRequests([]);
        setTotal(0);
      } finally {
        setHistoryLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, turboAppId]
  );

  // Load history when modal opens
  useEffect(() => {
    if (open === id && token && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchHistory(0);
    }
    // Reset ref when modal closes
    if (open !== id) {
      hasFetchedRef.current = false;
    }
  }, [open, id, token, fetchHistory]);

  // Fetch request details
  const fetchRequestDetails = async (requestId: string) => {
    if (!token) return;

    try {
      setDetailsLoading(true);
      const response = await EnigmaService.getDecryptRequest({
        token,
        request_id: requestId,
      });
      setRequestDetails(response);
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to get request details" });
      setRequestDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle request row click
  const handleRequestClick = (request: DecryptionRequestListItem) => {
    setSelectedRequest(request);
    fetchRequestDetails(request.id);
  };

  // Handle sign and submit
  const handleSignAndSubmit = async () => {
    if (!token || !selectedRequest) return;
    if (!isConnected || !address) {
      openConnectModal(true);
      return;
    }

    try {
      setSubmitLoading(true);

      const message = `${selectedRequest.id}:${turboAppId}`;
      const signature = await signMessageAsync({ message });

      const response = await EnigmaService.submitSignature({
        token,
        request_id: selectedRequest.id,
        participant_address: address,
        signature: signature,
      });

      success({
        label: "Signature Submitted",
        description: `Signatures: ${response.signatures_submitted}/${response.threshold}. Ready: ${response.ready_to_decrypt}`,
      });

      // Refresh request details
      fetchRequestDetails(selectedRequest.id);
      // Refresh history to update status
      fetchHistory(offset);
    } catch (err: any) {
      if (
        err.name === "UserRejectedRequestError" ||
        err.message?.includes("rejected")
      ) {
        errorToast({ label: "Signature rejected by user" });
      } else {
        errorToast({ label: err.message || "Failed to submit signature" });
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle create request
  const handleCreate = async () => {
    if (!token) return;
    if (!submissionId) {
      errorToast({ label: "Please enter submission ID" });
      return;
    }

    try {
      setCreateLoading(true);

      const response = await EnigmaService.createDecryptRequest({
        token,
        turbo_da_app_id: turboAppId,
        submission_id: submissionId,
      });

      success({
        label: "Decrypt Request Created",
        description: `Request ID: ${response.id}`,
      });

      setSubmissionId("");
      fetchHistory(0);
      setActiveTab("history");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to create request" });
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle add participants
  const handleAddParticipants = async () => {
    if (!token) return;
    if (!addParticipants) {
      errorToast({ label: "Please enter participant addresses" });
      return;
    }

    try {
      setAddLoading(true);
      const participantsList = addParticipants
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);

      const response = await EnigmaService.addParticipant({
        token,
        turbo_da_app_id: turboAppId,
        participants: participantsList,
      });

      success({
        label: "Participants Added",
        description: `Added ${response.participants_added} participants`,
      });

      setAddParticipants("");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to add participants" });
    } finally {
      setAddLoading(false);
    }
  };

  // Handle delete participants
  const handleDeleteParticipants = async () => {
    if (!token) return;
    if (!deleteParticipants) {
      errorToast({ label: "Please enter participant addresses" });
      return;
    }

    try {
      setDeleteLoading(true);
      const participantsList = deleteParticipants
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p);

      const response = await EnigmaService.deleteParticipant({
        token,
        turbo_da_app_id: turboAppId,
        participants: participantsList,
      });

      success({
        label: "Participants Removed",
        description: `Removed ${response.participants_deleted} participants`,
      });

      setDeleteParticipants("");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to remove participants" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "completed") {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#1FC16B]/20 text-[#1FC16B] border border-[#1FC16B]/30">
          {status}
        </span>
      );
    } else if (statusLower === "pending") {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#E4A354]/20 text-[#E4A354] border border-[#E4A354]/30">
          {status}
        </span>
      );
    } else if (statusLower === "failed") {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#CF6679]/20 text-[#CF6679] border border-[#CF6679]/30">
          {status}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#3CA3FC]/20 text-[#3CA3FC] border border-[#3CA3FC]/30">
        {status}
      </span>
    );
  };

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
          setSelectedRequest(null);
          setRequestDetails(null);
        }
      }}
    >
      <DialogContent className="min-w-[700px] h-[650px] p-0 border-none rounded-3xl">
        <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col focus-within:outline-0 h-full w-full relative">
          <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
          <div className="relative h-full flex flex-col z-1">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#2B4761]">
              <DialogTitle>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2B4761]/40 flex items-center justify-center">
                    <Key size={20} className="text-[#3CA3FC]" />
                  </div>
                  <div className="flex flex-col">
                    <Text weight={"bold"} size={"xl"}>
                      Enigma
                    </Text>
                    <div className="flex items-center gap-2 mt-0.5">
                      {appData?.app_logo?.includes(".") ? (
                        <Image
                          className="w-4 h-4 rounded"
                          alt={appData.app_name}
                          src={baseImageUrl(appData.app_logo)}
                          width={16}
                          height={16}
                        />
                      ) : (
                        <div className="w-4 rounded overflow-hidden">
                          {avatarList?.[appData?.app_logo]?.path ? (
                            <AvatarWrapper
                              path={avatarList?.[appData?.app_logo]?.path}
                              width={16}
                              height={16}
                            />
                          ) : null}
                        </div>
                      )}
                      <Text size={"xs"} variant={"light-grey"}>
                        {appData.app_name} · ID: {appData.app_id}
                      </Text>
                    </div>
                  </div>
                </div>
              </DialogTitle>

              <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
                <X color="#FFF" size={24} strokeWidth={1} />
              </Close>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#2B4761]">
              <button
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors",
                  activeTab === "history"
                    ? "border-b-2 border-[#3CA3FC] text-white"
                    : "text-[#8B9DB6] hover:text-white"
                )}
                onClick={() => {
                  setActiveTab("history");
                  setSelectedRequest(null);
                  setRequestDetails(null);
                }}
              >
                Request History
              </button>
              <button
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors",
                  activeTab === "create"
                    ? "border-b-2 border-[#3CA3FC] text-white"
                    : "text-[#8B9DB6] hover:text-white"
                )}
                onClick={() => setActiveTab("create")}
              >
                Create Request
              </button>
              <button
                className={cn(
                  "px-6 py-3 text-sm font-medium transition-colors",
                  activeTab === "participants"
                    ? "border-b-2 border-[#3CA3FC] text-white"
                    : "text-[#8B9DB6] hover:text-white"
                )}
                onClick={() => setActiveTab("participants")}
              >
                Manage Participants
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Request History Tab */}
              {activeTab === "history" && (
                <>
                  {selectedRequest ? (
                    // Request Details View
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => {
                          setSelectedRequest(null);
                          setRequestDetails(null);
                        }}
                        className="flex items-center gap-2 text-[#8B9DB6] hover:text-white transition-colors w-fit"
                      >
                        <ArrowLeft size={16} />
                        <Text size="sm">Back to list</Text>
                      </button>

                      {detailsLoading ? (
                        <div className="flex justify-center items-center min-h-[200px]">
                          <LoaderCircle
                            className="animate-spin text-[#3CA3FC]"
                            size={32}
                          />
                        </div>
                      ) : requestDetails ? (
                        <div className="flex flex-col gap-4">
                          {/* Status Card */}
                          <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                            <div className="flex items-center justify-between mb-4">
                              <Text weight="semibold" size="lg">
                                Request Details
                              </Text>
                              {getStatusBadge(requestDetails.status)}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="mb-1"
                                >
                                  Request ID
                                </Text>
                                <Text
                                  size="sm"
                                  className="font-mono break-all"
                                >
                                  {requestDetails.id}
                                </Text>
                              </div>
                              <div>
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="mb-1"
                                >
                                  Created At
                                </Text>
                                <Text size="sm">
                                  {formatDate(requestDetails.created_at)}
                                </Text>
                              </div>
                              {requestDetails.completed_at && (
                                <div>
                                  <Text
                                    size="xs"
                                    variant="light-grey"
                                    className="mb-1"
                                  >
                                    Completed At
                                  </Text>
                                  <Text size="sm">
                                    {formatDate(requestDetails.completed_at)}
                                  </Text>
                                </div>
                              )}
                            </div>

                            {requestDetails.submitted_signatures &&
                              getSignatureCount(requestDetails.submitted_signatures) >
                                0 && (
                              <div className="mt-4 pt-4 border-t border-[#2B4761]">
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="mb-2"
                                >
                                  Submitted Signatures (
                                  {getSignatureCount(
                                    requestDetails.submitted_signatures
                                  )}
                                  )
                                </Text>
                                <div className="flex flex-col gap-2">
                                  {(() => {
                                    try {
                                      const sigs = JSON.parse(
                                        requestDetails.submitted_signatures ||
                                          "[]"
                                      );
                                      return sigs.map(
                                        (
                                          sig: {
                                            participant: string;
                                            submitted_at: number;
                                          },
                                          idx: number
                                        ) => (
                                          <div
                                            key={idx}
                                            className="p-2 rounded bg-black/20 flex items-center justify-between"
                                          >
                                            <Text
                                              size="xs"
                                              className="font-mono text-[#3CA3FC]"
                                            >
                                              {sig.participant.slice(0, 6)}...
                                              {sig.participant.slice(-4)}
                                            </Text>
                                            <Text
                                              size="xs"
                                              variant="light-grey"
                                            >
                                              {formatDate(sig.submitted_at)}
                                            </Text>
                                          </div>
                                        )
                                      );
                                    } catch {
                                      return null;
                                    }
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Decrypted Data - only show when completed */}
                          {requestDetails.status?.toLowerCase() === "completed" &&
                            requestDetails.decrypted_data &&
                            requestDetails.decrypted_data.length > 0 && (
                              <div className="p-4 rounded-lg border border-[#1FC16B]/30 bg-[#1FC16B]/10">
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="mb-2"
                                >
                                  Decrypted Data
                                </Text>
                                <div className="p-3 rounded bg-black/20 max-h-[120px] overflow-y-auto">
                                  <Text
                                    size="xs"
                                    className="font-mono break-all text-[#1FC16B]"
                                  >
                                    {bytesToString(requestDetails.decrypted_data)}
                                  </Text>
                                </div>
                              </div>
                            )}

                          {/* Ciphertext */}
                          {requestDetails.ciphertext &&
                            requestDetails.ciphertext.length > 0 && (
                              <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="mb-2"
                                >
                                  Ciphertext
                                </Text>
                                <div className="p-3 rounded bg-black/20 max-h-[120px] overflow-y-auto">
                                  <Text
                                    size="xs"
                                    className="font-mono break-all text-[#E4A354]"
                                  >
                                    {bytesToHex(requestDetails.ciphertext)}
                                  </Text>
                                </div>
                              </div>
                            )}

                          {/* Sign Section */}
                          {requestDetails.status?.toLowerCase() !== "completed" && (
                            <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                              <Text weight="semibold" className="mb-3">
                                Submit Your Signature
                              </Text>

                              {isConnected && address ? (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#1FC16B]/10 border border-[#1FC16B]/30 mb-4">
                                  <Wallet size={16} className="text-[#1FC16B]" />
                                  <Text
                                    size="sm"
                                    className="text-[#1FC16B] font-mono"
                                  >
                                    {address.slice(0, 6)}...{address.slice(-4)}
                                  </Text>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#E4A354]/10 border border-[#E4A354]/30 mb-4">
                                  <Wallet size={16} className="text-[#E4A354]" />
                                  <Text size="sm" className="text-[#E4A354]">
                                    Connect your wallet to sign
                                  </Text>
                                </div>
                              )}

                              <Button
                                onClick={handleSignAndSubmit}
                                disabled={submitLoading}
                                className="w-full"
                              >
                                {submitLoading ? (
                                  <LoaderCircle className="animate-spin" size={20} />
                                ) : isConnected ? (
                                  "Sign & Submit"
                                ) : (
                                  "Connect Wallet"
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center items-center min-h-[200px]">
                          <Text variant="light-grey">
                            Failed to load request details
                          </Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Request List View
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <Text weight="semibold">
                          Decryption Requests ({total})
                        </Text>
                        <button
                          onClick={() => fetchHistory(offset)}
                          disabled={historyLoading}
                          className="p-2 rounded-lg hover:bg-[#2B4761]/40 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            size={16}
                            className={cn(
                              "text-[#8B9DB6]",
                              historyLoading && "animate-spin"
                            )}
                          />
                        </button>
                      </div>

                      {historyLoading && requests.length === 0 ? (
                        <div className="flex justify-center items-center min-h-[300px]">
                          <LoaderCircle
                            className="animate-spin text-[#3CA3FC]"
                            size={32}
                          />
                        </div>
                      ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                          <div className="w-16 h-16 rounded-full bg-[#2B4761]/40 flex items-center justify-center">
                            <Key size={24} className="text-[#8B9DB6]" />
                          </div>
                          <Text variant="light-grey" size="lg">
                            No decrypt requests found
                          </Text>
                          <Text
                            variant="light-grey"
                            size="sm"
                            className="text-center"
                          >
                            Create a new request to get started
                          </Text>
                          <Button
                            variant="secondary"
                            className="mt-2"
                            onClick={() => setActiveTab("create")}
                          >
                            <Plus size={16} className="mr-2" />
                            Create Request
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Table Header */}
                          <div className="flex items-center px-3 py-2 border-b border-[#2B4761]">
                            <Text
                              size="xs"
                              variant="light-grey"
                              className="w-[140px]"
                            >
                              Request ID
                            </Text>
                            <Text
                              size="xs"
                              variant="light-grey"
                              className="w-[100px]"
                            >
                              Status
                            </Text>
                            <Text
                              size="xs"
                              variant="light-grey"
                              className="w-[90px] text-center"
                            >
                              Signatures
                            </Text>
                            <Text
                              size="xs"
                              variant="light-grey"
                              className="flex-1"
                            >
                              Created
                            </Text>
                          </div>

                          {/* Table Body */}
                          <div className="flex flex-col">
                            {requests.map((request) => (
                              <div
                                key={request.id}
                                onClick={() => handleRequestClick(request)}
                                className="flex items-center px-3 py-3 border-b border-[#2B4761]/50 cursor-pointer hover:bg-[#2B4761]/20 transition-colors"
                              >
                                <Text
                                  size="sm"
                                  className="w-[140px] font-mono"
                                >
                                  {request.id.slice(0, 8)}...
                                  {request.id.slice(-4)}
                                </Text>
                                <div className="w-[100px]">
                                  {getStatusBadge(request.status)}
                                </div>
                                <Text
                                  size="sm"
                                  className="w-[90px] text-center"
                                >
                                  {getSignatureCount(request.submitted_signatures)}/
                                  {request.threshold}
                                </Text>
                                <Text
                                  size="xs"
                                  variant="light-grey"
                                  className="flex-1"
                                >
                                  {formatDate(request.created_at)}
                                </Text>
                              </div>
                            ))}
                          </div>

                          {/* Pagination */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 mt-4">
                              <button
                                onClick={() =>
                                  fetchHistory(Math.max(0, offset - PAGE_SIZE))
                                }
                                disabled={offset === 0 || historyLoading}
                                className="p-2 rounded-lg hover:bg-[#2B4761]/40 transition-colors disabled:opacity-30"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <Text size="sm" variant="light-grey">
                                {currentPage} / {totalPages}
                              </Text>
                              <button
                                onClick={() => fetchHistory(offset + PAGE_SIZE)}
                                disabled={
                                  offset + PAGE_SIZE >= total || historyLoading
                                }
                                className="p-2 rounded-lg hover:bg-[#2B4761]/40 transition-colors disabled:opacity-30"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Create Request Tab */}
              {activeTab === "create" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                    <Text size="lg" weight="semibold" className="mb-2">
                      Create Decrypt Request
                    </Text>
                    <Text variant="light-grey" size="sm" className="mb-6">
                      Initiate a new decryption request for encrypted data
                      submission.
                    </Text>

                    <PrimaryInput
                      label="Submission ID (UUID)"
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      value={submissionId}
                      onChange={setSubmissionId}
                    />

                    <Button
                      className="mt-6 w-full"
                      onClick={handleCreate}
                      disabled={createLoading || !submissionId}
                      variant={!submissionId ? "disabled" : "primary"}
                    >
                      {createLoading ? (
                        <LoaderCircle className="animate-spin" size={20} />
                      ) : (
                        "Create Request"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Manage Participants Tab */}
              {activeTab === "participants" && (
                <div className="flex flex-col gap-4">
                  {/* Add Participants */}
                  <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                    <Text size="lg" weight="semibold" className="mb-2">
                      Add Participants
                    </Text>
                    <Text variant="light-grey" size="sm" className="mb-6">
                      Add new participants who can sign decryption requests.
                    </Text>

                    <PrimaryInput
                      label="Participants (Comma separated addresses)"
                      placeholder="e.g. 0x123..., 0x456..."
                      value={addParticipants}
                      onChange={setAddParticipants}
                    />

                    <Button
                      className="mt-6 w-full"
                      onClick={handleAddParticipants}
                      disabled={addLoading || !addParticipants}
                      variant={!addParticipants ? "disabled" : "primary"}
                    >
                      {addLoading ? (
                        <LoaderCircle className="animate-spin" size={20} />
                      ) : (
                        <>
                          <Plus size={16} className="mr-2" />
                          Add Participants
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Remove Participants */}
                  <div className="p-4 rounded-lg border border-[#2B4761] bg-[#2B4761]/24">
                    <Text size="lg" weight="semibold" className="mb-2">
                      Remove Participants
                    </Text>
                    <Text variant="light-grey" size="sm" className="mb-6">
                      Remove participants from this app&apos;s encryption
                      scheme.
                    </Text>

                    <PrimaryInput
                      label="Participants (Comma separated addresses)"
                      placeholder="e.g. 0x123..., 0x456..."
                      value={deleteParticipants}
                      onChange={setDeleteParticipants}
                    />

                    <Button
                      variant={!deleteParticipants ? "disabled" : "danger"}
                      className="mt-6 w-full"
                      onClick={handleDeleteParticipants}
                      disabled={deleteLoading || !deleteParticipants}
                    >
                      {deleteLoading ? (
                        <LoaderCircle className="animate-spin" size={20} />
                      ) : (
                        <>
                          <Trash2 size={16} className="mr-2" />
                          Remove Participants
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
