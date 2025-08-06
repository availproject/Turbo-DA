export interface TransactionError {
  code?: string;
  message: string;
  userAction?: string;
}

export class ErrorHandlingUtils {
  /**
   * Parses common wallet and transaction errors and returns user-friendly messages
   */
  static parseTransactionError(error: any): TransactionError {
    const errorMessage = error?.message || error?.toString() || "Unknown error";

    // Common wallet rejection errors
    if (
      errorMessage.includes("User rejected") ||
      errorMessage.includes("user rejected") ||
      errorMessage.includes("User denied") ||
      errorMessage.includes("user denied") ||
      errorMessage.includes("User cancelled") ||
      errorMessage.includes("user cancelled") ||
      errorMessage.includes("Cancelled by user") ||
      errorMessage.includes("cancelled by user") ||
      errorMessage.includes("Transaction cancelled") ||
      errorMessage.includes("transaction cancelled") ||
      errorMessage.includes("rejected by user") ||
      errorMessage.includes("denied by user") ||
      errorMessage.includes("Transaction timeout - no response from wallet")
    ) {
      return {
        code: "USER_REJECTED",
        message: "Transaction was rejected by user",
        userAction:
          "Please try again and approve the transaction in your wallet",
      };
    }

    // Insufficient funds errors
    if (
      errorMessage.includes("insufficient funds") ||
      errorMessage.includes("Insufficient funds")
    ) {
      return {
        code: "INSUFFICIENT_FUNDS",
        message: "Insufficient funds for transaction",
        userAction: "Please ensure you have enough tokens and gas fees",
      };
    }

    // Network/chain errors
    if (
      errorMessage.includes("wrong network") ||
      errorMessage.includes("network mismatch")
    ) {
      return {
        code: "WRONG_NETWORK",
        message: "Wrong network selected",
        userAction: "Please switch to the correct network in your wallet",
      };
    }

    // Gas estimation errors
    if (errorMessage.includes("gas") && errorMessage.includes("estimate")) {
      return {
        code: "GAS_ESTIMATION_FAILED",
        message: "Failed to estimate gas for transaction",
        userAction: "Please try again or check your wallet settings",
      };
    }

    // Contract interaction errors
    if (
      errorMessage.includes("execution reverted") ||
      errorMessage.includes("revert")
    ) {
      return {
        code: "CONTRACT_REVERT",
        message: "Transaction failed on contract",
        userAction: "Please check your input values and try again",
      };
    }

    // Approval errors
    if (
      errorMessage.includes("approve") ||
      errorMessage.includes("allowance")
    ) {
      return {
        code: "APPROVAL_FAILED",
        message: "Token approval failed",
        userAction: "Please approve the token spending in your wallet",
      };
    }

    // Network connectivity errors
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("connection")
    ) {
      return {
        code: "NETWORK_ERROR",
        message: "Network connection error",
        userAction: "Please check your internet connection and try again",
      };
    }

    // Default error
    return {
      code: "UNKNOWN_ERROR",
      message: "Transaction failed",
      userAction: "Please try again or contact support if the issue persists",
    };
  }

  /**
   * Gets a user-friendly error message for toast display
   */
  static getErrorMessage(error: any): string {
    const parsedError = this.parseTransactionError(error);
    return parsedError.message;
  }

  /**
   * Gets a detailed error message with user action
   */
  static getDetailedErrorMessage(error: any): string {
    const parsedError = this.parseTransactionError(error);
    return `${parsedError.message}. ${parsedError.userAction}`;
  }

  /**
   * Checks if error is user-initiated (like rejection)
   */
  static isUserError(error: any): boolean {
    const parsedError = this.parseTransactionError(error);
    return parsedError.code === "USER_REJECTED";
  }

  /**
   * Checks if error is recoverable (user can retry)
   */
  static isRecoverableError(error: any): boolean {
    const parsedError = this.parseTransactionError(error);
    return !["USER_REJECTED"].includes(parsedError.code || "");
  }
}
