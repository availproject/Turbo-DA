/**
 * @module Services
 *
 * @description This module contains all the services that are used in the application, essntially the api calls from the gas relayer backend.
 *
 * @exports {fetchTransactions} - fetches all the transactions for the user
 * @exports {fetchSupportedTokens} - fetches the list of supported tokens
 * @exports {fetchTotalDepositedBalance} - fetches the total deposited balance for the user
 */

import { Logger } from "./logger";
import { BalanceResult, TokenMap, Tokens, Transaction, User } from "./types";

export type T = {
  success: boolean;
  response?: any;
  error?: any;
  statusCode?: number;
};

/**
 * @function fetchTransactions
 *
 * @description This function fetches all the transactions for the user from the backend
 * @param {string} auth - the user's session token
 * @returns {Promise} - a promise that resolves to the transactions for the user
 *
 */
export async function fetchTransactions(
  auth: string
): Promise<{ requests: Transaction[] }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/request_fund_status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    Logger.error(`${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while fetching transactions from backend"
    );
  }
}

/**
 * @function fetchSupportedTokens
 *
 * @description This function fetches the list of supported tokens from the backend
 * @param {string} auth - the user's session token
 * @returns {Promise} - a promise that resolves to the list of supported tokens
 *
 */
export async function fetchSupportedTokens(): Promise<TokenMap> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/token_map`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    Logger.error(`GET_SUPPORTED_TOKEN_API ${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while fetching supported tokens from backend",
      error
    );
  }
}

export async function fetchTokenBalances(auth: string): Promise<BalanceResult> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_all_tokens`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    Logger.error(`${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while fetching token balances from backend",
      error
    );
  }
}

export async function requestFunds(
  auth: string,
  amount: string,
  token: string,
  chainId: number
): Promise<T> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/request_funds`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({
          token_address: token,
          amount_deposited: amount,
          chain_id: chainId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return { success: true, response: response };
  } catch (error: any) {
    Logger.error(`REQUEST_FUNDS_API ${error.message}`);
    throw new Error(
      "An error occurred while requesting funds from backend",
      error
    );
  }
}

export async function enrollToken(
  auth: string,
  token: Tokens["address"]
): Promise<T> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ token_address: token }),
      }
    );

    const data = await response.text();

    return {
      success: response.ok,
      response: response.ok ? data : undefined,
      error: response.ok ? undefined : data || "Failed to enroll token",
      statusCode: response.status,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
      statusCode: error.status || 500,
    };
  }
}

export async function fetchUser(auth: string): Promise<User | undefined> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_user`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    Logger.error(`${error.message} - ${error.status}`);
  }
}

export interface ApiKey {
  api_key: string;
  created_at: string;
  identifier: string;
  user_id: string;
}

export async function generateApikey(
  auth: string
): Promise<{ api_key: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/generate_api_key`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    Logger.error(`GENERATE_API_KEY ${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while generating api key from backend",
      error
    );
  }
}

export async function getAllApiKeys(auth: string): Promise<ApiKey[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/get_api_key`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const keys = await response.json();
    console.log(keys, "response");
    return keys;
  } catch (error: any) {
    Logger.error(`GET_ALL_API_KEYS ${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while fetching all api keys from backend",
      error
    );
  }
}

interface DeleteApiKeyResponse {
  message: string;
  success: boolean;
}

export async function deleteApiKey(auth: string, identifier: string): Promise<DeleteApiKeyResponse> {
  const response = await fetch( `${process.env.NEXT_PUBLIC_API_URL}/v1/user/delete_api_key`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth}`
    },
    body: JSON.stringify({ identifier })
  });

  if (!response.ok) {
    throw new Error(`Failed to delete API key: ${response.statusText}`);
  }

  return response.json();
}

export async function registerUser(
  auth: string,
  email: string,
  name: string
): Promise<String> {
  try {
    const body = {
      name: name,
      email: email,
      app_id: 0,
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/register_new_user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.text();
  } catch (error: any) {
    Logger.error(`REGISTER_NEW_USER ${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while registering user from backend",
      error
    );
  }
}

export async function updateAppID(auth: string, app_id: number): Promise<T> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/user/update_app_id`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ app_id: Number(app_id) }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return { success: true, response: response };
  } catch (error: any) {
    Logger.error(`UPDATE_APP_ID ${error.message} - ${error.status}`);
    throw new Error(
      "An error occurred while updating app id from backend",
      error
    );
  }
}
