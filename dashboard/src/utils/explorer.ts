import { TransactionStatus } from "@/providers/ConfigProvider";
import { appConfig } from "@/config/default";

/**
 * Determines the Avail network based on the RPC URL
 */
export const getAvailNetwork = (): "mainnet" | "turing" | "hex" => {
  const rpcUrl = appConfig.rpcUrl.toLowerCase();

  if (rpcUrl.includes("mainnet") || rpcUrl.includes("mainnet-rpc")) {
    return "mainnet";
  } else if (rpcUrl.includes("turing") || rpcUrl.includes("turing-rpc")) {
    return "turing";
  } else if (rpcUrl.includes("hex") || rpcUrl.includes("rpc-hex")) {
    return "hex";
  }

  // Default to turing
  return "turing";
};

/**
 * Generates the correct block explorer URL based on chain type and network
 */
export const getExplorerUrl = (
  transaction: TransactionStatus | undefined,
  evmChainUrl?: string
): string => {
  if (!transaction || !transaction.txnHash) {
    return "#";
  }

  if (transaction.chainType === "avail") {
    const availNetwork = getAvailNetwork();

    switch (availNetwork) {
      case "mainnet":
        return `https://avail.subscan.io/extrinsic/${transaction.txnHash}`;
      case "turing":
        return `https://avail-turing.subscan.io/extrinsic/${transaction.txnHash}`;
      case "hex":
        const blockhash = transaction.blockhash;
        return `https://explorer.avail.so/?rpc=wss://rpc-hex-devnet.avail.tools/ws#/explorer/query/${blockhash}`;
      default:
        return `https://avail-turing.subscan.io/extrinsic/${transaction.txnHash}`;
    }
  } else {
    // EVM chains (ethereum, base) use standard format
    return `${evmChainUrl}/tx/${transaction.txnHash}`;
  }
};
