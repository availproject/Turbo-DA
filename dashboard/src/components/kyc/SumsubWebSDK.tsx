"use client";

import React, { useEffect, useMemo, useRef } from "react";

interface SumsubWebSDKProps {
  accessToken: string;
  onTokenExpiration: () => Promise<string>;
  onCompleted: () => void;
  onError: (error: any) => void;
  className?: string;
}

export default function SumsubWebSDK({
  accessToken,
  onTokenExpiration,
  onCompleted,
  onError,
  className,
}: SumsubWebSDKProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const containerId = useMemo(
    () => `sumsub-websdk-container-${Math.random().toString(36).slice(2)}`,
    []
  );

  const onCompletedRef = useRef(onCompleted);
  const onErrorRef = useRef(onError);
  const onTokenExpirationRef = useRef(onTokenExpiration);
  const firedCompletedRef = useRef(false);

  function extractDecisionAnswer(payload: any): string | undefined {
    try {
      const rr = payload?.reviewResult ?? {};
      return (
        rr?.reviewAnswer ||
        rr?.answer ||
        payload?.reviewAnswer ||
        payload?.answer ||
        undefined
      );
    } catch {
      return undefined;
    }
  }

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onTokenExpirationRef.current = onTokenExpiration;
  }, [onTokenExpiration]);

  useEffect(() => {
    let disposed = false;
    let sdkInstance: any | null = null;

    async function init() {
      if (!accessToken) return;

      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        const mod: any = await import("@sumsub/websdk");
        const snsWebSdk = mod?.default ?? mod;
        if (!snsWebSdk) throw new Error("Sumsub WebSDK module not available");

        const tokenCb = async () => {
          console.log(
            "[Sumsub SDK] Token expired, requesting new access token..."
          );
          const newToken = await onTokenExpirationRef.current();
          console.log(
            "[Sumsub SDK] Received new access token (len)",
            newToken?.length || 0
          );
          return newToken;
        };

        sdkInstance = snsWebSdk
          .init(accessToken, tokenCb)
          .withConf({ lang: "en", theme: "dark" })
          .withOptions({ addViewportTag: false, adaptIframeHeight: true })
          .on("idCheck.onError", (e: any) => {
            if (disposed) return;
            console.log("[Sumsub SDK] idCheck.onError", e);
            try {
              onErrorRef.current(e);
            } catch {}
          })
          .on("idCheck.onReady", () => {
            if (disposed) return;
            console.log("[Sumsub SDK] onReady");
          })
          .on("idCheck.onInitialized", () => {
            if (disposed) return;
            console.log("[Sumsub SDK] onInitialized");
          })
          .on("idCheck.onStepInitiated", (payload: any) => {
            if (disposed) return;
            console.log("[Sumsub SDK] onStepInitiated", payload);
          })
          .on("idCheck.onApplicantStatusChanged", (payload: any) => {
            if (disposed) return;
            console.log("[Sumsub SDK] onApplicantStatusChanged", payload);
            try {
              const answerRaw = extractDecisionAnswer(payload);
              const answer = answerRaw?.toString?.().toUpperCase?.();
              const reviewStatus = payload?.reviewStatus
                ?.toString?.()
                .toLowerCase?.();
              console.log(
                "[Sumsub SDK] statusChanged: reviewStatus=",
                reviewStatus,
                "answer=",
                answerRaw
              );
              if (
                !firedCompletedRef.current &&
                reviewStatus === "completed" &&
                answer === "GREEN"
              ) {
                firedCompletedRef.current = true;
                onCompletedRef.current();
              }
            } catch {}
          })
          .on("idCheck.moduleResultPresented", (payload: any) => {
            if (disposed) return;
            console.log("[Sumsub SDK] moduleResultPresented", payload);
            try {
              const answerRaw = extractDecisionAnswer(payload);
              const answer = answerRaw?.toString?.().toUpperCase?.();
              if (!firedCompletedRef.current && answer === "GREEN") {
                firedCompletedRef.current = true;
                onCompletedRef.current();
              }
            } catch {}
          })
          .on("idCheck.onStepCompleted", (payload: any) => {
            if (disposed) return;
            console.log("[Sumsub SDK] onStepCompleted", payload);
          })
          .on("idCheck.onApplicantSubmitted", () => {
            if (disposed) return;
            console.log("[Sumsub SDK] onApplicantSubmitted");
          })
          .build();

        sdkInstance.launch(`#${containerId}`);
        console.log("[Sumsub SDK] Launched into", `#${containerId}`);
      } catch (err) {
        if (!disposed) {
          try {
            onErrorRef.current(err);
          } catch {}
        }
      }
    }

    init();

    return () => {
      disposed = true;
      try {
        if (sdkInstance && typeof sdkInstance.destroy === "function") {
          sdkInstance.destroy();
        }
      } catch {}
    };
  }, [accessToken, containerId]);

  return <div id={containerId} ref={containerRef} className={className} />;
}
