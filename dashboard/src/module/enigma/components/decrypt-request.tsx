"use client";
import Button from "@/components/button";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { useConfig } from "@/providers/ConfigProvider";
import EnigmaService from "@/services/enigma";
import { GetDecryptRequestResponse } from "@/services/enigma/response";
import { LoaderCircle, Search, Wallet } from "lucide-react";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useModal } from "connectkit";

const DecryptRequest = () => {
  const { token } = useConfig();
  const { success, error: errorToast } = useAppToast();

  // Wallet connection
  const { address, isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();
  const { signMessageAsync } = useSignMessage();

  // Create Request State
  const [createLoading, setCreateLoading] = useState(false);
  const [createAppId, setCreateAppId] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const [createdRequestId, setCreatedRequestId] = useState("");
  const [savedAppId, setSavedAppId] = useState(""); // Store app ID for signing

  // Get Request State
  const [getLoading, setGetLoading] = useState(false);
  const [getRequestId, setGetRequestId] = useState("");
  const [requestStatus, setRequestStatus] = useState<GetDecryptRequestResponse | null>(null);

  // Submit Signature State
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitRequestId, setSubmitRequestId] = useState("");

  const handleCreate = async () => {
    if (!token) return;
    if (!createAppId || !submissionId) {
      errorToast({ label: "Please fill all fields" });
      return;
    }

    try {
      setCreateLoading(true);

      const response = await EnigmaService.createDecryptRequest({
        token,
        turbo_da_app_id: createAppId,
        submission_id: submissionId,
      });

      success({
        label: "Decrypt Request Created",
        description: `Request ID: ${response.id}`,
      });

      setCreatedRequestId(response.id);
      // Auto-fill other fields for convenience
      setGetRequestId(response.id);
      setSubmitRequestId(response.id);
      setSavedAppId(createAppId); // Save app ID for signing

      setCreateAppId("");
      setSubmissionId("");
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to create request" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGet = async () => {
    if (!token) return;
    if (!getRequestId) {
      errorToast({ label: "Please enter Request ID" });
      return;
    }

    try {
      setGetLoading(true);
      const response = await EnigmaService.getDecryptRequest({
        token,
        request_id: getRequestId,
      });

      setRequestStatus(response);
      // Save app ID for signing if not already saved
      if (response.turbo_da_app_id && !savedAppId) {
        setSavedAppId(response.turbo_da_app_id);
      }
    } catch (err: any) {
      errorToast({ label: err.message || "Failed to get request" });
      setRequestStatus(null);
    } finally {
      setGetLoading(false);
    }
  };

  const handleSignAndSubmit = async () => {
    if (!token) return;
    if (!submitRequestId) {
      errorToast({ label: "Please enter Request ID" });
      return;
    }
    if (!isConnected || !address) {
      openConnectModal(true);
      return;
    }

    try {
      setSubmitLoading(true);

      // Get the app ID from saved state or request status
      const appId = savedAppId || requestStatus?.turbo_da_app_id;
      if (!appId) {
        errorToast({ label: "Please check request status first to get the App ID" });
        setSubmitLoading(false);
        return;
      }

      // Message format: {request_id}:{turbo_da_app_id}:{participant_address}
      const message = `${submitRequestId}:${appId}`;

      const signature = await signMessageAsync({ message });

      const response = await EnigmaService.submitSignature({
        token,
        request_id: submitRequestId,
        participant_address: address,
        signature: signature,
      });

      success({
        label: "Signature Submitted",
        description: `Status: ${response.status}. Signatures: ${response.signatures_submitted}/${response.threshold}. Ready: ${response.ready_to_decrypt}`,
      });

      if (response.ready_to_decrypt) {
        // Refresh the status when threshold is met
        setRequestStatus((prev: GetDecryptRequestResponse | null) =>
          prev ? { ...prev, status: response.status } : null
        );
      }
    } catch (err: any) {
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
    <div className="flex flex-col gap-8 max-w-xl pb-10">
      
      {/* Create Request Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">Create Decrypt Request</Text>
          <Text variant="light-grey" size="sm">
            Initiate a new decryption request with ciphertext.
          </Text>
        </div>

        <PrimaryInput
          label="Turbo DA App ID"
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          value={createAppId}
          onChange={setCreateAppId}
        />

        <PrimaryInput
          label="Submission ID (UUID)"
          placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
          value={submissionId}
          onChange={setSubmissionId}
        />

        <Button
          className="mt-2"
          onClick={handleCreate}
          disabled={createLoading}
        >
          {createLoading ? <LoaderCircle className="animate-spin" /> : "Create Request"}
        </Button>

        {createdRequestId && (
          <div className="p-3 bg-green/10 border border-green/30 rounded-lg mt-2">
            <Text size="sm" weight="semibold" className="text-green">
              Created Request ID: {createdRequestId}
            </Text>
          </div>
        )}
      </div>

      {/* Get Request Status Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">Check Request Status</Text>
          <Text variant="light-grey" size="sm">
            Check the status of a decryption request.
          </Text>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <PrimaryInput
              label="Request ID"
              placeholder="UUID"
              value={getRequestId}
              onChange={setGetRequestId}
            />
          </div>
          <Button
            className="w-12 h-12 rounded-lg p-0 mb-[2px]" // Adjust alignment
            onClick={handleGet}
            disabled={getLoading}
          >
            {getLoading ? <LoaderCircle className="animate-spin" /> : <Search size={20} />}
          </Button>
        </div>

        {requestStatus && (
          <div className="flex flex-col gap-2 p-4 bg-black/20 rounded-lg border border-border-blue/50">
            <div className="flex justify-between">
              <Text variant="light-grey" size="sm">Status:</Text>
              <Text weight="bold" className={requestStatus.status === 'Completed' ? 'text-green' : 'text-yellow'}>
                {requestStatus.status}
              </Text>
            </div>

            <div className="flex justify-between">
              <Text variant="light-grey" size="sm">App ID:</Text>
              <Text size="sm" className="font-mono">{requestStatus.turbo_da_app_id}</Text>
            </div>

            {requestStatus.submitted_signatures && (
              <div className="flex flex-col gap-1 mt-2">
                <Text variant="light-grey" size="sm">Submitted Signatures:</Text>
                <div className="flex flex-wrap gap-1">
                  <Text size="xs" className="break-all font-mono text-blue/80">
                     {requestStatus.submitted_signatures}
                  </Text>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Signature Section */}
      <div className="flex flex-col gap-4 p-4 border border-border-blue rounded-xl bg-[#2b47611a]">
        <div className="flex flex-col gap-1">
          <Text size="xl" weight="bold">Submit Signature</Text>
          <Text variant="light-grey" size="sm">
            Sign with your wallet to approve a decryption request.
          </Text>
        </div>

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

        <PrimaryInput
          label="Request ID"
          placeholder="UUID"
          value={submitRequestId}
          onChange={setSubmitRequestId}
        />

        <Button
          className="mt-2"
          onClick={handleSignAndSubmit}
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

    </div>
  );
};

export default DecryptRequest;
