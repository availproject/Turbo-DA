import { TransactionStatus } from "@/providers/ConfigProvider";

/**
 * Generates the correct block explorer URL based on chain type
 */
export const getExplorerUrl = (
  transaction: TransactionStatus | undefined,
  evmChainUrl?: string
): string => {
  if (!transaction || !transaction.txnHash) {
    return "#";
  }

  if (transaction.chainType === "avail") {
    // Avail explorer URL format
    return `https://explorer.avail.so/?rpc=wss://rpc-hex-devnet.avail.tools/ws#/explorer/query/${transaction.txnHash}`;
  } else {
    // EVM chains (ethereum, base) use standard format
    return `${evmChainUrl}/tx/${transaction.txnHash}`;
  }
};