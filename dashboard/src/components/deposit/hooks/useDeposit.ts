"use client";

import {
  type SUPPORTED_CHAINS_IDS,
  type SUPPORTED_TOKENS,
  type UserAsset,
  NexusSDK,
  type OnIntentHookData,
  type OnAllowanceHookData,
  type ExecuteParams,
  type BridgeAndExecuteParams,
  type BridgeAndExecuteResult,
  type BridgeAndExecuteSimulationResult,
  NEXUS_EVENTS,
  type BridgeStepType,
  CHAIN_METADATA,
} from "@avail-project/nexus-core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
  useCallback,
  type RefObject,
} from "react";
import { useNexus } from "../../nexus/NexusProvider";
import { type Address } from "viem";
import {
  useDebouncedValue,
  useNexusError,
  usePolling,
  useStopwatch,
  useTransactionSteps,
} from "../../common";

export type DepositStatus =
  | "idle"
  | "previewing"
  | "executing"
  | "success"
  | "error";

interface DepositInputs {
  chain: SUPPORTED_CHAINS_IDS;
  amount?: string;
  selectedSources: number[];
}

interface UseDepositProps {
  token: SUPPORTED_TOKENS;
  chain: SUPPORTED_CHAINS_IDS;
  nexusSDK: NexusSDK | null;
  intent: RefObject<OnIntentHookData | null>;
  allowance: RefObject<OnAllowanceHookData | null>;
  bridgableBalance: UserAsset[] | null;
  fetchBridgableBalance: () => Promise<void>;
  chainOptions?: { id: number; name: string; logo: string }[];
  address: Address;
  executeBuilder?: (
    token: SUPPORTED_TOKENS,
    amount: string,
    chainId: SUPPORTED_CHAINS_IDS,
    userAddress: `0x${string}`
  ) => Omit<ExecuteParams, "toChainId">;
  executeConfig?: Omit<ExecuteParams, "toChainId">;
}

type DepositState = {
  inputs: DepositInputs;
  status: DepositStatus;
  explorerUrls: {
    intentUrl: string | null;
    executeUrl: string | null;
  };
  error: string | null;
  lastResult: BridgeAndExecuteResult | null;
};

type Action =
  | { type: "setInputs"; payload: Partial<DepositInputs> }
  | { type: "resetInputs" }
  | { type: "setStatus"; payload: DepositStatus }
  | { type: "setExplorerUrls"; payload: Partial<DepositState["explorerUrls"]> }
  | { type: "setError"; payload: string | null }
  | { type: "setLastResult"; payload: BridgeAndExecuteResult | null }
  | { type: "reset" };

const useDeposit = ({
  token,
  chain,
  nexusSDK,
  intent,
  bridgableBalance,
  chainOptions,
  address,
  executeBuilder,
  executeConfig,
  allowance,
  fetchBridgableBalance,
}: UseDepositProps) => {
  const { getFiatValue } = useNexus();
  const handleNexusError = useNexusError();

  const allSourceIds = useMemo(
    () => chainOptions?.map((c) => c.id) ?? [],
    [chainOptions]
  );

  const createInitialState = useCallback(
    (): DepositState => ({
      inputs: {
        chain,
        amount: undefined,
        selectedSources: allSourceIds,
      },
      status: "idle",
      explorerUrls: {
        intentUrl: null,
        executeUrl: null,
      },
      error: null,
      lastResult: null,
    }),
    [chain, allSourceIds]
  );

  const initialState = createInitialState();

  function reducer(state: DepositState, action: Action): DepositState {
    switch (action.type) {
      case "setInputs": {
        const newInputs = { ...state.inputs, ...action.payload };
        let newStatus = state.status;
        if (
          state.status === "idle" &&
          newInputs.amount &&
          Number.parseFloat(newInputs.amount) > 0
        ) {
          newStatus = "previewing";
        }
        if (
          state.status === "previewing" &&
          (!newInputs.amount || Number.parseFloat(newInputs.amount) <= 0)
        ) {
          newStatus = "idle";
        }
        return { ...state, inputs: newInputs, status: newStatus };
      }
      case "resetInputs":
        return {
          ...state,
          inputs: { chain, amount: undefined, selectedSources: allSourceIds },
          status: "idle",
        };
      case "setStatus":
        return { ...state, status: action.payload };
      case "setExplorerUrls":
        return {
          ...state,
          explorerUrls: { ...state.explorerUrls, ...action.payload },
        };
      case "setError":
        return { ...state, error: action.payload };
      case "setLastResult":
        return { ...state, lastResult: action.payload };
      case "reset":
        return createInitialState();
      default:
        return state;
    }
  }

  const [state, dispatch] = useReducer(reducer, initialState);
  const { inputs, status, explorerUrls, error: txError, lastResult } = state;

  const setInputs = (next: Partial<DepositInputs>) => {
    dispatch({ type: "setInputs", payload: next });
  };

  const setTxError = (error: string | null) => {
    dispatch({ type: "setError", payload: error });
  };

  const loading = status === "executing";
  const isProcessing = status === "executing";
  const isSuccess = status === "success";
  const isError = status === "error";

  // Simulation state (useState)
  const [simulation, setSimulation] =
    useState<BridgeAndExecuteSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Derived: refreshing = simulating while we already have a simulation
  const refreshing = simulating && simulation !== null;

  // Refs for non-rendering state
  const autoAllowRef = useRef(false);
  const transactionStartedRef = useRef(false);
  const simulationRequestIdRef = useRef(0);
  const activeSimulationIdRef = useRef<number | null>(null);

  const {
    steps,
    onStepsList,
    onStepComplete,
    reset: resetSteps,
  } = useTransactionSteps<BridgeStepType>();

  const unfilteredBridgableBalance = useMemo(() => {
    const tokenBalance = bridgableBalance?.find((bal) => bal?.symbol === token);
    if (!tokenBalance) return undefined;

    const nonZeroBreakdown = tokenBalance.breakdown.filter(
      (chain) => Number.parseFloat(chain.balance) > 0
    );

    const totalBalance = nonZeroBreakdown.reduce(
      (sum, chain) => sum + Number.parseFloat(chain.balance),
      0
    );

    const totalBalanceInFiat = nonZeroBreakdown.reduce(
      (sum, chain) => sum + chain.balanceInFiat,
      0
    );

    return {
      ...tokenBalance,
      balance: totalBalance.toString(),
      balanceInFiat: totalBalanceInFiat,
      breakdown: nonZeroBreakdown,
    };
  }, [bridgableBalance, token]);

  const filteredBridgableBalance = useMemo(() => {
    const tokenBalance = bridgableBalance?.find((bal) => bal?.symbol === token);
    if (!tokenBalance) return undefined;

    const selectedSourcesSet = new Set(inputs.selectedSources);
    const filteredBreakdown = tokenBalance.breakdown.filter(
      (chain) =>
        selectedSourcesSet.has(chain.chain.id) &&
        Number.parseFloat(chain.balance) > 0
    );

    const totalBalance = filteredBreakdown.reduce(
      (sum, chain) => sum + Number.parseFloat(chain.balance),
      0
    );

    const totalBalanceInFiat = filteredBreakdown.reduce(
      (sum, chain) => sum + chain.balanceInFiat,
      0
    );

    return {
      ...tokenBalance,
      balance: totalBalance.toString(),
      balanceInFiat: totalBalanceInFiat,
      breakdown: filteredBreakdown,
    };
  }, [bridgableBalance, token, inputs.selectedSources]);

  const allCompleted = useMemo(
    () => (steps?.length ?? 0) > 0 && steps.every((s) => s.completed),
    [steps]
  );

  const stopwatch = useStopwatch({
    running: isProcessing && !allCompleted && transactionStartedRef.current,
    intervalMs: 100,
  });

  const debouncedAmount = useDebouncedValue(inputs?.amount ?? "", 1200);

  const feeBreakdown = useMemo(() => {
    if (!nexusSDK || !simulation || !token)
      return {
        totalGasFee: 0,
        bridgeUsd: 0,
        bridgeFormatted: "0",
        gasUsd: 0,
        gasFormatted: "0",
      };
    const native = CHAIN_METADATA[chain]?.nativeCurrency;
    const nativeSymbol = native.symbol;
    const nativeDecimals = native.decimals;

    const gasFormatted =
      nexusSDK?.utils?.formatTokenBalance(
        simulation?.executeSimulation?.gasFee,
        {
          symbol: nativeSymbol,
          decimals: nativeDecimals,
        }
      ) ?? "0";
    const gasUnits = Number.parseFloat(
      nexusSDK?.utils?.formatUnits(
        simulation?.executeSimulation?.gasFee,
        nativeDecimals
      )
    );

    const gasUsd = getFiatValue(gasUnits, nativeSymbol);
    if (simulation?.bridgeSimulation) {
      const tokenDecimals =
        simulation?.bridgeSimulation?.intent?.token?.decimals;
      const bridgeFormatted =
        nexusSDK?.utils?.formatTokenBalance(
          simulation?.bridgeSimulation?.intent?.fees?.total,
          {
            symbol: token,
            decimals: tokenDecimals,
          }
        ) ?? "0";
      const bridgeUsd = getFiatValue(
        Number.parseFloat(simulation?.bridgeSimulation?.intent?.fees?.total),
        token
      );

      const totalGasFee = bridgeUsd + gasUsd;

      return {
        totalGasFee: `$${totalGasFee.toFixed(4)} USD`,
        bridgeUsd,
        bridgeFormatted,
        gasUsd,
        gasFormatted,
      };
    }
    return {
      totalGasFee: gasFormatted,
      gasUsd,
      gasFormatted,
    };
  }, [nexusSDK, simulation, chain, token, getFiatValue]);

  const handleTransaction = async () => {
    if (!inputs?.amount || !inputs?.chain) return;
    dispatch({ type: "setStatus", payload: "executing" });
    dispatch({ type: "setError", payload: null });
    try {
      if (!nexusSDK) throw new Error("Nexus SDK not initialized");
      const amountBigInt = nexusSDK.convertTokenReadableAmountToBigInt(
        inputs.amount,
        token,
        inputs.chain
      );
      const executeParams: Omit<ExecuteParams, "toChainId"> | undefined =
        executeBuilder
          ? executeBuilder(token, inputs.amount, inputs.chain, address)
          : executeConfig;
      const params: BridgeAndExecuteParams = {
        token,
        amount: amountBigInt,
        toChainId: inputs.chain,
        sourceChains: inputs.selectedSources?.length
          ? inputs.selectedSources
          : allSourceIds,
        execute: executeParams as Omit<ExecuteParams, "toChainId">,
        waitForReceipt: true,
      };

      const result: BridgeAndExecuteResult = await nexusSDK.bridgeAndExecute(
        params,
        {
          onEvent: (event) => {
            if (event.name === NEXUS_EVENTS.STEPS_LIST) {
              const list = Array.isArray(event.args) ? event.args : [];
              onStepsList(list);
            }
            if (event.name === NEXUS_EVENTS.STEP_COMPLETE) {
              if (
                !transactionStartedRef.current &&
                event.args.type === "INTENT_HASH_SIGNED"
              ) {
                transactionStartedRef.current = true;
              }
              onStepComplete(event.args);
            }
          },
        }
      );

      if (!result) {
        dispatch({ type: "setError", payload: "Transaction rejected by user" });
        dispatch({ type: "setStatus", payload: "error" });
        return;
      }
      dispatch({ type: "setLastResult", payload: result });
      dispatch({
        type: "setExplorerUrls",
        payload: {
          intentUrl: result.bridgeExplorerUrl ?? null,
          executeUrl: result.executeExplorerUrl ?? null,
        },
      });
      await onSuccess();
    } catch (error) {
      const { message } = handleNexusError(error);
      intent.current?.deny();
      intent.current = null;
      allowance.current = null;
      dispatch({ type: "setError", payload: message });
      dispatch({ type: "setStatus", payload: "error" });
    }
  };

  const simulate = async (overrideAmount?: string) => {
    if (!nexusSDK || isProcessing || isSuccess) return;

    const amountToUse = overrideAmount ?? inputs?.amount;

    if (!amountToUse || !inputs?.chain) {
      activeSimulationIdRef.current = null;
      setSimulation(null);
      return;
    }
    if (
      Number.parseFloat(amountToUse) >
      Number.parseFloat(filteredBridgableBalance?.balance ?? "0")
    ) {
      activeSimulationIdRef.current = null;
      dispatch({ type: "setError", payload: "Insufficient balance" });
      setSimulation(null);
      return;
    }
    const requestId = ++simulationRequestIdRef.current;
    activeSimulationIdRef.current = requestId;
    setSimulating(true);
    try {
      const amountBigInt = nexusSDK.convertTokenReadableAmountToBigInt(
        amountToUse,
        token,
        inputs.chain
      );
      const executeParams: Omit<ExecuteParams, "toChainId"> | undefined =
        executeBuilder
          ? executeBuilder(token, amountToUse, inputs.chain, address)
          : executeConfig;
      const params: BridgeAndExecuteParams = {
        token,
        amount: amountBigInt,
        toChainId: inputs.chain,
        sourceChains: inputs.selectedSources?.length
          ? inputs.selectedSources
          : allSourceIds,
        execute: executeParams as Omit<ExecuteParams, "toChainId">,
        waitForReceipt: false,
      };
      const sim = await nexusSDK.simulateBridgeAndExecute(params);
      if (activeSimulationIdRef.current !== requestId) {
        return;
      }
      if (sim) {
        dispatch({ type: "setError", payload: null });
        setSimulation(sim);
      } else {
        setSimulation(null);
        dispatch({ type: "setError", payload: "Simulation failed" });
      }
    } catch (error) {
      if (activeSimulationIdRef.current !== requestId) {
        return;
      }
      setSimulation(null);
      const { message } = handleNexusError(error);
      dispatch({ type: "setError", payload: message });
    } finally {
      if (activeSimulationIdRef.current === requestId) {
        setSimulating(false);
      }
    }
  };

  const refreshSimulation = async () => {
    if (simulating) return;
    if (!simulation?.bridgeSimulation?.intent) return;
    if (!inputs?.amount) return;
    await simulate(inputs?.amount);
  };

  const onSuccess = async () => {
    stopwatch.stop();
    dispatch({ type: "setStatus", payload: "success" });
    await fetchBridgableBalance();
  };

  const resetState = useCallback(() => {
    allowance.current = null;
    intent.current = null;
    setSimulation(null);
    setSimulating(false);
    transactionStartedRef.current = false;
    autoAllowRef.current = false;
    activeSimulationIdRef.current = null;
    resetSteps();
    stopwatch.stop();
    stopwatch.reset();
    dispatch({ type: "reset" });
  }, [allowance, intent, resetSteps, stopwatch]);

  const reset = useCallback(() => {
    intent.current?.deny();
    resetState();
  }, [intent, resetState]);

  const startTransaction = useCallback(() => {
    // Prevent re-entrancy while a transaction is already executing
    if (isProcessing) return;
    activeSimulationIdRef.current = null;
    setSimulating(false);
    dispatch({ type: "setError", payload: null });
    autoAllowRef.current = true;
    void handleTransaction();
  }, [handleTransaction, isProcessing]);

  useEffect(() => {
    const hasRequiredInputs =
      Boolean(debouncedAmount) && Boolean(inputs?.chain) && Boolean(token);
    if (!hasRequiredInputs || isProcessing || isSuccess) return;
    void simulate(debouncedAmount);
  }, [debouncedAmount, inputs?.chain, token, isProcessing, isSuccess]);

  useEffect(() => {
    if (autoAllowRef.current && intent.current) {
      intent.current.allow();
      autoAllowRef.current = false;
    }
  }, [intent.current]);

  usePolling(
    Boolean(simulation?.bridgeSimulation?.intent) &&
      !isProcessing &&
      !isSuccess,
    async () => {
      await refreshSimulation();
    },
    15000
  );

  return {
    // State
    inputs,
    setInputs,
    status,
    explorerUrls,

    // Derived state
    loading,
    isProcessing,
    isSuccess,
    isError,
    simulating,
    refreshing,

    // Error handling
    txError,
    setTxError,

    // Timer
    timer: stopwatch.seconds,

    // Balance data
    filteredBridgableBalance,
    unfilteredBridgableBalance,

    // Simulation data
    simulation,
    lastResult,
    steps,
    feeBreakdown,

    // Actions
    handleTransaction,
    startTransaction,
    reset,
    simulate,
    cancelSimulation: () => {
      activeSimulationIdRef.current = null;
      setSimulating(false);
      setSimulation(null);
    },
  };
};

export default useDeposit;
