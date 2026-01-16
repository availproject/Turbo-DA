"use client";

import Button from "@/components/button";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/components/toast";
import EnigmaService from "@/services/enigma";
import { AppDetails } from "@/services/app/response";
import { LoaderCircle, Wallet, Search, Key } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";
import MpcAppList from "@/module/mpc-participant/app-list";
import { useAuth } from "@/providers/AuthProvider";

const MpcStandalonePage = () => {
  const [addressInput, setAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AppDetails[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { error: errorToast } = useAppToast();
  const { token } = useAuth();
  const { address, isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();
  const prevAddressRef = useRef<string | undefined>(undefined);

  const handleFetchApps = async (participantAddress: string, authToken: string) => {
    if (!participantAddress || !authToken) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const response = await EnigmaService.getParticipantApps({
        token: authToken,
        address: participantAddress,
      });
      setApps(response);
    } catch (err: any) {
      console.error(err);
      errorToast({ label: err.message || "Failed to fetch apps" });
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when wallet connects and token is ready
  useEffect(() => {
    if (isConnected && address && token && address !== prevAddressRef.current && !hasSearched) {
      setAddressInput(address);
      handleFetchApps(address, token);
    }
    prevAddressRef.current = address;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, hasSearched, token]);

  const handleConnectWallet = () => {
    if (isConnected && address && token) {
      setAddressInput(address);
      handleFetchApps(address, token);
    } else {
      openConnectModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-blue/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-border-blue/5 blur-3xl" />
        <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute w-full h-full opacity-20" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue/30 to-blue/10 mb-6 shadow-lg border border-blue/20">
            <Key size={32} className="text-blue" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            MPC Participant Portal
          </h1>
          <p className="text-lg text-light-grey max-w-2xl mx-auto leading-relaxed opacity-80">
            View your Enigma-enabled apps and sign decryption requests without logging in.
            Simply connect your wallet to get started.
          </p>
        </div>

        <Card className="border border-border-blue/30 bg-gradient-to-r from-bg-secondary/50 to-bg-secondary backdrop-blur-sm shadow-xl">
          {!hasSearched ? (
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-white text-xl font-semibold mb-2">Connect Your Wallet</h2>
                <p className="text-light-grey opacity-70">
                  Connect your wallet to view all apps where you&apos;re a participant
                </p>
              </div>

              <Button
                variant="primary"
                className="h-12 w-full flex items-center justify-center gap-3"
                onClick={handleConnectWallet}
              >
                <Wallet size={20} />
                Connect Wallet
              </Button>

              <div className="flex items-center gap-4">
                <div className="flex-1 border-t border-border-blue/30" />
                <span className="text-sm text-light-grey opacity-60">OR</span>
                <div className="flex-1 border-t border-border-blue/30" />
              </div>

              <div className="space-y-3">
                <label className="text-sm text-light-grey font-medium">
                  Enter Wallet Address
                </label>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-bg-primary/60 border border-border-blue/50 text-white placeholder:text-light-grey/50 focus:outline-none focus:border-blue transition-all text-sm font-mono"
                  />
                  <button
                    className="h-11 px-4 rounded-xl bg-border-blue/40 hover:bg-border-blue/60 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                    onClick={() => token && handleFetchApps(addressInput, token)}
                    disabled={loading || !addressInput || !token}
                  >
                    {loading ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Search size={16} />
                    )}
                    Find
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {/* Wallet Info */}
              <div className="mb-6 p-3 rounded-xl bg-bg-primary/40 border border-border-blue/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs text-light-grey mb-0.5">Viewing apps for</p>
                    <p className="font-mono text-white text-sm truncate">
                      {address || addressInput}
                    </p>
                  </div>
                  <button
                    className="text-xs text-light-grey hover:text-white transition-colors"
                    onClick={() => {
                      setHasSearched(false);
                      setApps([]);
                      setAddressInput("");
                    }}
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <LoaderCircle className="animate-spin text-blue" size={32} />
                  <p className="animate-pulse text-white">Loading your apps...</p>
                </div>
              ) : apps.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <div className="w-16 h-16 rounded-full border border-border-blue/20 flex items-center justify-center bg-bg-primary/30">
                    <Search size={32} className="text-light-grey opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-lg mb-2">No apps found</p>
                    <p className="text-white/70">
                      You&apos;re not a participant in any Enigma-enabled apps
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <p className="text-white font-semibold text-lg">
                      {apps.length} App{apps.length !== 1 ? "s" : ""} Found
                    </p>
                    <p className="text-light-grey text-sm opacity-70">
                      Apps where you&apos;re a participant
                    </p>
                  </div>
                  <MpcAppList apps={apps} />
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Wallet size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">No Login Required</h3>
            <p className="text-light-grey text-sm opacity-70">
              Access your apps directly with wallet connection, no account creation needed
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Key size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">Sign Requests</h3>
            <p className="text-light-grey text-sm opacity-70">
              Sign decryption requests for Enigma-enabled apps you&apos;re participating in
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Search size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">View Apps</h3>
            <p className="text-light-grey text-sm opacity-70">
              See all Enigma-enabled apps where your wallet is a participant
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-light-grey text-sm opacity-50">
            TurboDA · MPC Participant Portal
          </p>
        </div>
      </div>
    </div>
  );
};

export default MpcStandalonePage;
