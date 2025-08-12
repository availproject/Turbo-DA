export const TRANSACTION_CONSTANTS = {
  // Transaction status flow
  STATUS_FLOW: ["broadcast", "inblock", "finality", "completed"] as const,
  INITIAL_STATUS: "initialised" as const,

  // Timeouts
  FINALITY_TIMEOUT: 2000, // 2 seconds

  // Transaction hash lengths
  AVAIL_TXN_HASH_LENGTH: 66,

  // Progress bar steps
  PROGRESS_STEPS: 3,

  // UI dimensions
  PROGRESS_BAR_WIDTH: 84,
  PROGRESS_BAR_HEIGHT: 8,

  // Dialog dimensions
  DIALOG_MIN_WIDTH: 600,
  DIALOG_HEIGHT: 400,
  CONTENT_WIDTH: 444,
} as const;

export const TRANSACTION_MESSAGES = {
  STATUS: {
    BROADCAST: "Credit Buying Initiated",
    INBLOCK: "Processing Transaction",
    FINALITY: "Almost Done",
    COMPLETED: "Credited Successfully",
  },

  DESCRIPTIONS: {
    BROADCAST: "Processing transaction on Avail chain",
    INBLOCK: "Transaction confirmed on Avail chain",
    FINALITY: "Finalizing transaction on Avail chain",
    COMPLETED:
      "You can use these credits directly from the main balance or assign it to individual apps.",
  },

  ERRORS: {
    NO_TOKEN: "No authentication token available",
    TRANSACTION_FAILED: "Transaction failed",
    API_FAILED: "API call failed",
  },
} as const;

export const TRANSACTION_ACTIONS = {
  VIEW_EXPLORER: "View On Explorer",
  VIEW_HISTORY: "View Credit History",
} as const;
