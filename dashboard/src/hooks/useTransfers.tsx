// import { config } from "@/app/providers";
// import { Logger } from "@/lib/logger";
// import {
//   enrollToken,
//   fetchSupportedTokens,
//   requestFunds,
//   T,
// } from "@/lib/services";
// import { SupportedChains, TOKEN_MAP, Tokens } from "@/lib/types";
// import { template } from "@/lib/utils";
// import { useCommonStore } from "@/store/common";
// import { useAuth } from "@clerk/nextjs";
// import { getToken as getEthToken } from "@wagmi/core";
// import { erc20Abi, parseUnits } from "viem";
// import { writeContract } from "wagmi/actions";
// import useTransactions from "./useTransactions";
// import useWallet from "./useWallet";

// export default function useTransfers() {
//   const { switchNetwork, activeUserAddress, activeNetworkId, showBalance } =
//     useWallet();
//   const { tokenBalances, setSupportedTokens, supportedTokens, setTab } =
//     useCommonStore();
//   const { getTransactions } = useTransactions();
//   const { getTokenBalances } = useTransactions();
//   const { getToken } = useAuth();
//   const { user } = useCommonStore();

//   /**
//    * @description - this function will fetch all tokens and their balances for the user
//    *
//    * @returns {Promise} - a promise that resolves to the tokens and their balances
//    */
//   const getTokens = async (): Promise<Tokens[]> => {
//     /**
//      * STEPS
//      *
//      * 1. fetch all tokens from the api
//      * 2. sort the tokens + add token images + metadata (https://0.3.x.wagmi.sh/core/actions/fetchToken)
//      * 3. fetch balances for supported tokens
//      * 4. add to token store(zustand)
//      *
//      */
//     try {
//       const response = await fetchSupportedTokens();
//       if (!response) throw new Error("Error fetching tokens");

//       const tokenMap = response.token_map;

//       const _supportedTokens: Tokens[] = [];

//       for (const [tokenName, tokenInfo] of Object.entries(TOKEN_MAP)) {
//         try {
//           // TOFIX: replace with using multicall to get all token details
//           const tokenDetails = await getEthToken(config, {
//             address: tokenInfo.token_address as `0x${string}`,
//             chainId: activeNetworkId,
//           });

//           if (
//             !tokenDetails ||
//             !tokenDetails.name ||
//             !tokenDetails.symbol ||
//             !tokenDetails.decimals
//           ) {
//             console.warn(`Skipping token ${tokenName} due to missing details.`);
//             continue;
//           }

//           _supportedTokens.push({
//             name: tokenDetails.name,
//             symbol: tokenDetails.symbol,
//             address: tokenInfo.token_address,
//             decimals: tokenInfo.token_decimals,
//             logo: `/tokens/${tokenInfo.token_address}.png`,
//           });
//         } catch (error) {
//           console.error(`Error fetching details for ${tokenName}:`, error);
//           continue;
//         }
//       }

//       setSupportedTokens(_supportedTokens);
//       Logger.debug(`GET_SUPPORTED_TOKENS_SUCCESS ${response}`);

//       return _supportedTokens;
//     } catch (error: any) {
//       Logger.error(`GET_TOKENS_ERROR ${error}`);
//       // throw new Error("An error occurred while fetching tokens", error);
//     }
//   };

//   /**
//    *
//    * @description - this function will initiate a transfer of a token to a generated address
//    *
//    * @param amount - the amount to transfer
//    * @param tokenAddress - the address of the token to transfer
//    * @param chainId - the chainId the user is connected to
//    *
//    * @returns { success: boolean, hash: string }
//    *
//    */
//   const initTransfer = async ({
//     amount,
//     tokenAddress,
//   }: {
//     amount: string;
//     tokenAddress: string;
//   }) => {
//     /**
//      * STEPS
//      *
//      * 1. sanity checks {isConnected, isSufficientBalance}
//      * 3. transfer [token] to generated address
//      * 4. api call to request funds
//      */

//     try {
//       if (!activeUserAddress)
//         throw new Error("User not connected, Did you forget to connect?");

//       if (Number(amount) <= 0 || !amount)
//         throw new Error("Beep Boop, that amount looks wrong");

//       if (!supportedTokens) throw new Error("Supported tokens not found");
//       if (!supportedTokens.find((token) => token.address === tokenAddress))
//         throw new Error("Token not supported");

//       //TOFIX: hardcoded to sepolia right now
//       if (!Object.values(SupportedChains).includes(activeNetworkId)) {
//         await switchNetwork(SupportedChains.Sepolia);
//       }

//       if (
//         (await showBalance({ token: tokenAddress as `0x${string}` }))! <= amount
//       )
//         throw new Error("Oopsie, you don't have enough balance to deposit");

//       const txHash = await writeContract(config, {
//         address: tokenAddress as `0x${string}`,
//         abi: erc20Abi,
//         functionName: "transfer",
//         // args: [receipiant, amount]
//         args: [user.assigned_wallet as `0x${string}`, parseUnits(amount, 18)],
//         chainId: activeNetworkId,
//       });

//       if (!txHash) throw new Error("Error initiating transfer");
//       Logger.debug(`INITIATE_TRANSFER_HASH_GENERATED ${txHash}`);

//       if (txHash) {
//         /**
//          * Checks:
//          *
//          * 1. if the token is enrolled(token should be in token balances)
//          * 2. if not enrolled, enroll the token (enrollToken())
//          * 3. if enrolled, requestfunds() once that is success, exit with sucess
//          * 2.
//          */

//         Logger.info(`INITIATE_TRANSFER_HASH_GENERATED ${txHash}`);
//         Logger.info(`this is tokenBalances, ${JSON.stringify(tokenBalances)}`);

//         if (
//           !tokenBalances.find((token) => token.token_address === tokenAddress)
//         ) {
//           Logger.debug("Token not enrolled, enrolling token");

//           const enroll: T = await enrollToken(
//             (await getToken({ template }))!,
//             tokenAddress
//           );

//           if (enroll.success === false)
//             throw new Error(enroll.error || "Error enrolling token");

//           Logger.debug("Token enrolled successfully");
//           await getTokenBalances();

//           /**
//            * ENHANCE: should ideally check again for token enrollment, but this fails, since the store takes time to update, need to fix that, not P0 though.
//            *
//            *  if (
//             !tokenBalances ||
//             !tokenBalances.find((token) => token.token_address === tokenAddress)
//           )
//             throw new Error("Error enrolling tokenjkn");
//            */
//         }
//         const request = await requestFunds(
//           (await getToken({ template }))!,
//           amount.toString(),
//           tokenAddress,
//           activeNetworkId
//         );
//         if (!request.success)
//           throw new Error(request.error || "Error requesting funds");

//         Logger.debug(`INITIATE_TRANSFER_SUCCESS ${txHash}`);
//         await getTransactions();
//         setTab("transactions");
//         return { success: true, hash: txHash };
//       }
//     } catch (error: any) {
//       Logger.error(`INITIATE_TRANSFER_ERROR ${error}`);
//       throw new Error(`ERROR: ${error.message}`, error);
//     }
//   };

//   return {
//     initTransfer,
//     getTokens,
//   };
// }
