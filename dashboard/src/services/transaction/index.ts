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

      const responseData = await response.json();

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
    onSuccess,
  }: {
    txnHash: `0x${string}`;
    orderId: number;
    token: string;
    chainType: "avail" | "ethereum" | "base";
    onSuccess?: () => void;
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



        // Call inclusion API regardless of receipt status - let backend handle it
        const result = await this.postInclusionDetails({ orderId, txnHash, token });
        
        
        if (result.success) {
          onSuccess?.(); // Trigger the 2-second UI timer
          return result;
        } else {
          return result;
        }
      }
    } catch (error) {
      const message = ErrorHandlingUtils.getErrorMessage(error);
      return { success: false, error: message };
    }
  }
}
