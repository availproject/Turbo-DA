// import { erc20Abi } from "viem";
// import { useSimulateContract, useWriteContract } from "wagmi";

// const tokenAddress = "0x...";
// const spenderAddress = "0x...";
// const walletAddress = "0x784E77B8F1FFcc6BC42072DBa4af8722f60413c3";
// const amount = 1000;

// const result = useSimulateContract({
//   address: tokenAddress,
//   abi: erc20Abi,
//   functionName: "approve",
//   args: [spenderAddress, BigInt(123)],
//   //   args: [spenderAddress, amount],
// });

// const { write: approve } = useWriteContract(result.data?.result);

// if (allowance && allowance < amount) {
//   // Approval needed
//   approve();
// } else {
//   // Already approved
// }
