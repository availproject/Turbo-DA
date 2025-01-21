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
export async function fetchTransactions(auth: string): Promise<{requests: Transaction[]}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/user/request_fund_status`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/token_map`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/user/get_all_tokens`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/user/request_funds`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/user/register_new_token`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/user/get_user`,
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

export async function registerUser(auth: string, email:string, name:string): Promise<String> {
  try {
    const body = {
      name: name,
      email: email,
      address: "",
      app_id: 0,
      ethereum_address: "0xDEf1F7C203c3E9Dda5E733C61d9Cc57dcf4e9b24",
      password: "password",
    };

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/user/register_new_user`,
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
      `${process.env.NEXT_PUBLIC_API_URL}/user/update_app_id`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth}`,
        },
        body: JSON.stringify({ app_id: Number(app_id) })
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
