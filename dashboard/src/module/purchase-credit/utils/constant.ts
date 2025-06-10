import { Abi } from "viem";

export const chainList = {
  ethereum: {
    name: "Ethereum",
    icon: "/currency/eth.png",
    id: 11155111, // Sepolia testnet
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
      },
      {
        name: "MTK",
        icon: "/currency/mtk.png",
      },
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
      },
    ],
  },
  base: {
    name: "Base",
    icon: "/currency/eth.png", // Using ETH icon as placeholder
    id: 84532, // Base Sepolia testnet
    tokens: [
      {
        name: "ETH",
        icon: "/currency/eth.png",
      },
    ],
  },
};

export const availChain = {
  avail: {
    name: "Avail",
    icon: "/avail-icon.svg",
    id: 0, // Special ID for Avail (non-EVM)
    tokens: [
      {
        name: "AVAIL",
        icon: "/avail-icon.svg",
      },
    ],
  },
};

export const abi: Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    outputs: [],
  },
];

export const depositAbi: Abi = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "orderId", type: "bytes32", internalType: "bytes32" }],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "depositERC20",
    inputs: [
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "tokenAddress", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "depositERC20WithPermit",
    inputs: [
      { name: "orderId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "deadline", type: "uint256", internalType: "uint256" },
      {
        name: "tokenAddress",
        type: "address",
        internalType: "address",
      },
      { name: "v", type: "uint8", internalType: "uint8" },
      { name: "r", type: "bytes32", internalType: "bytes32" },
      { name: "s", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];
