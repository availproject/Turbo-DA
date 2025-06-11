import { parseUnits } from "viem";

class CreditService {
  static async creditEstimates({
    token,
    data,
  }: {
    token: string;
    data: number;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/estimate_credits_against_size?size=${data}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async creditEstimatesBytes({
    token,
    data,
  }: {
    token: string;
    data: number;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/estimate_credits_for_bytes?data=${data}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async calculateEstimateCreditsAgainstToken({
    token,
    amount,
    tokenAddress,
    chainId,
  }: {
    token: string;
    amount: number;
    tokenAddress: string;
    chainId: number;
  }) {
    const atomicAmount: string = parseUnits(amount.toString(), 18).toString();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/estimate_credits_against_token?amount=${atomicAmount}&token_address=${tokenAddress}&chain_id=${chainId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }

  static async registerCreditRequest({
    token,
    chain,
  }: {
    token: string;
    chain: string;
  }) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_credit_request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chain,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  }
}

export default CreditService;
