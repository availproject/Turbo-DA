import { config } from "@/config/walletConfig";
import { waitForTransactionReceipt } from "@wagmi/core";
import { ErrorHandlingUtils } from "@/utils/errorHandling";

export interface TransactionInclusionDetails {
  orderId: number;
  txnHash: string;
}

export interface TransactionResult {
  success: boolean;
  error?: string;
}

export class TransactionService {
  static async postInclusionDetails({
    orderId,
    txnHash,
    token,
  }: TransactionInclusionDetails & {
    token: string;
  }): Promise<TransactionResult> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/user/add_inclusion_details`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            order_id: orderId,
            tx_hash: txnHash,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} - ${errorText}`);
      }

      return { success: true };
    } catch (error) {
      const message = ErrorHandlingUtils.getErrorMessage(error);
      return { success: false, error: message };
    }
  }

  static async handleTransactionFinality({
    txnHash,
    orderId,
    token,
    chainType,
  }: {
    txnHash: `0x${string}`;
    orderId: number;
    token: string;
    chainType: "avail" | "ethereum" | "base";
  }): Promise<TransactionResult> {
    try {
      const isAvailTransaction = chainType === "avail";

      if (isAvailTransaction) {
        // For Avail transactions, directly post inclusion details
        return await this.postInclusionDetails({ orderId, txnHash, token });
      } else {
        // For EVM transactions, wait for receipt first
        const receipt = await waitForTransactionReceipt(config, {
          hash: txnHash,
        });

        if (receipt.status === "success") {
          return await this.postInclusionDetails({ orderId, txnHash, token });
        } else {
          return { success: false, error: "Transaction failed" };
        }
      }
    } catch (error) {
      const message = ErrorHandlingUtils.getErrorMessage(error);
      return { success: false, error: message };
    }
  }
}
