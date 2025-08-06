import { appConfig } from "@/config/default";
import { LegacySignerOptions } from "@/utils/web3-services";
import {
  getWalletBySource,
  WalletAccount,
  getWallets,
} from "@talismn/connect-wallets";
import { ApiPromise, isValidAddress, SubmittableResult } from "avail-js-sdk";
import { Result, err, ok } from "neverthrow";
import { Chain } from "./types";
import { erc20Abi, isAddress } from "viem";
import { parseAmount, parseAvailAmount } from "./parsers";
import { readContract } from "@wagmi/core";
import { config } from "@/config/walletConfig";
import BigNumber from "bignumber.js";

export const postOrder = async ({
  token,
  chainId,
}: {
  token: string;
  chainId: number;
}) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_credit_request`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain: chainId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return await response.json();
};

export async function batchTransferAndRemark(
  api: ApiPromise,
  account: WalletAccount,
  atomicAmount: string,
  remarkMessage: string,
  onInBlock?: (txHash: string, blockHash: string) => void,
  onFinalized?: (txHash: string) => void,
  onBroadcast?: (txHash: string) => void,
): Promise<Result<any, Error>> {
  try {
    const wallets = getWallets();
    const matchedWallet = wallets.find((wallet) => {
      return wallet.title === wallet?.title;
    });

    await matchedWallet!.enable("turbo-da");
    const injector = getWalletBySource(account.source);

    const options: Partial<LegacySignerOptions> = {
      signer: injector?.signer as {},
      app_id: 0,
    };

    const transfer = api.tx.balances.transferKeepAlive(
      process.env.NEXT_PUBLIC_AVAIL_ADDRESS,
      atomicAmount,
    );
    const remark = api.tx.system.remark(remarkMessage);
    const batchCall = api.tx.utility.batchAll([transfer, remark]);

    const txResult = await new Promise<SubmittableResult>((resolve, reject) => {
      // Add timeout to prevent infinite waiting
      const timeout = setTimeout(() => {
        reject(new Error("Transaction timeout - no response from wallet"));
      }, 60000); // 60 seconds timeout

      batchCall.signAndSend(
        account.address,
        options as any,
        (result: SubmittableResult) => {
          console.log(`Tx status: ${result.status}`);

          // Emit broadcast event when transaction is broadcast
          if (result.status.isBroadcast) {
            const txHash = result.txHash.toString();
            console.log(`Transaction broadcast: ${txHash}`);
            onBroadcast?.(txHash);
          }

          // Emit inblock event when transaction is in block
          if (result.status.isInBlock) {
            const blockHash = result.status.asInBlock?.toString();
            console.log(`Transaction in block detected: ${blockHash}`);
            onInBlock?.(result.txHash.toString(), blockHash || "");
          }

          if (result.isFinalized || result.isError) {
            clearTimeout(timeout);
            // Emit finalized event when transaction is finalized
            if (result.isFinalized) {
              const txHash = result.txHash.toString();
              console.log(`Transaction finalized: ${txHash}`);
              onFinalized?.(txHash);
            }
            resolve(result);
          }
        },
      ).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    const error = txResult.dispatchError;

    if (txResult.isError) {
      return err(new Error(`Transaction failed with error: ${error}`));
    } else if (error !== undefined) {
      if (error.isModule) {
        const decoded = api.registry.findMetaError(error.asModule);
        const { docs, name, section } = decoded;
        return err(new Error(`${section}.${name}: ${docs.join(" ")}`));
      } else {
        return err(new Error(error.toString()));
      }
    }

    return ok({
      status: "success",
      blockhash:
        txResult.status.asFinalized?.toString() ||
        txResult.status.asInBlock?.toString() ||
        "",
      txHash: txResult.txHash.toString(),
      txIndex: txResult.txIndex,
    });
  } catch (error) {
    console.error("Error during batch transfer and remark:", error);
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to batch transfer and remark"),
    );
  }
}

export function validAddress(address: string, chain: Chain) {
  if (chain === Chain.AVAIL) {
    return isValidAddress(address);
  }
  return isAddress(address);
}

export async function getTokenBalance(
  chain: Chain,
  address: `0x${string}`,
  api?: ApiPromise,
  tokenAddress?: string,
  chainId?: number,
) {
  if (!validAddress(address, chain))
    throw new Error("Invalid Recipient on base");

  if (chain === Chain.AVAIL) {
    if (api) {
      const balance: any = await api.query.system.account(address);
      const { free, frozen } = balance.data;

      const freeBalance = new BigNumber(free.toString());
      const frozenBalance = new BigNumber(frozen.toString());
      const spendableBalance = freeBalance.minus(frozenBalance);
      return parseAvailAmount(spendableBalance.toString(), 18);
    }
    throw new Error("API not connected");
  }

  return readContract(config, {
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
    chainId: chainId || 11155111, // Use provided chainId or fallback to Sepolia
  }).then((balance) => parseAmount(balance.toString(), 18));
}
