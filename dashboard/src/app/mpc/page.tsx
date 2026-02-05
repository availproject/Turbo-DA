"use client";

import Button from "@/components/button";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/components/toast";
import EnigmaService from "@/services/enigma";
import PublicKeyService from "@/services/public-keys";
import { AppDetails } from "@/services/app/response";
import { LoaderCircle, Key, RefreshCw, Lock, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import MpcAppList from "@/module/mpc-participant/app-list";
import { useAuth } from "@/providers/AuthProvider";
import { useAuthState } from "@/providers/AuthProvider";

const MpcStandalonePage = () => {
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AppDetails[]>([]);
  const [publicKeys, setPublicKeys] = useState<string[]>([]);
  const { error: errorToast } = useAppToast();
  const { token } = useAuth();
  const { isAuthenticated } = useAuthState();

  const handleFetchApps = async (authToken: string) => {
    if (!authToken) return;

    setLoading(true);
    try {
      // 1. Fetch user's public keys
      const publicKeysResponse = await PublicKeyService.getPublicKeys({ token: authToken });

      if (publicKeysResponse.state !== "SUCCESS" || !Array.isArray(publicKeysResponse.data)) {
        errorToast({ label: "No public keys found" });
        setApps([]);
        setPublicKeys([]);
        return;
      }

      const keys = publicKeysResponse.data.map((key) => key.public_address);
      setPublicKeys(keys);

      // 2. Fetch apps for each public key
      const allAppsPromises = keys.map((address) =>
        EnigmaService.getParticipantApps({
          token: authToken,
          address,
        }).catch((err) => {
          console.error(`Failed to fetch apps for ${address}:`, err);
          return [];
        })
      );

      const allAppsArrays = await Promise.all(allAppsPromises);

      // 3. Flatten and deduplicate apps by ID
      const uniqueApps = new Map<string, AppDetails>();
      allAppsArrays.flat().forEach((app) => {
        if (app && app.id) {
          uniqueApps.set(app.id, app);
        }
      });

      setApps(Array.from(uniqueApps.values()));
    } catch (err: any) {
      console.error(err);
      errorToast({ label: err.message || "Failed to fetch apps" });
      setApps([]);
      setPublicKeys([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      handleFetchApps(token);
    }
  }, [isAuthenticated, token]);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-blue/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-border-blue/5 blur-3xl" />
        <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute w-full h-full opacity-20" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue/30 to-blue/10 mb-4 shadow-lg border border-blue/20">
            <Key size={32} className="text-blue" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            MPC Participant Portal
          </h1>
          <p className="text-base md:text-lg text-light-grey max-w-2xl mx-auto leading-relaxed opacity-80 px-4">
            View your Enigma-enabled apps and sign decryption requests.
            {!isAuthenticated && " Please sign in to get started."}
          </p>
        </div>

        {!isAuthenticated ? (
          <Card className="border border-border-blue/30 bg-gradient-to-r from-bg-secondary/50 to-bg-secondary backdrop-blur-sm shadow-xl">
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full border border-border-blue/20 flex items-center justify-center bg-bg-primary/30 mx-auto mb-4">
                <Key size={32} className="text-light-grey opacity-50" />
              </div>
              <p className="text-white font-semibold text-lg mb-2">Authentication Required</p>
              <p className="text-light-grey opacity-70">
                Please sign in to view your MPC participant apps
              </p>
            </div>
          </Card>
        ) : (
          <Card className="border border-border-blue/30 bg-gradient-to-r from-bg-secondary/50 to-bg-secondary backdrop-blur-sm shadow-xl">
            <div className="p-6">
              {/* User Info */}
              <div className="mb-6 p-4 rounded-xl bg-bg-primary/40 border border-border-blue/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="overflow-hidden flex-1">
                    <p className="text-xs text-light-grey mb-1.5">Viewing apps for your account</p>
                    <p className="text-white text-sm font-medium">
                      {publicKeys.length} public key{publicKeys.length !== 1 ? "s" : ""} registered
                    </p>
                  </div>
                  <button
                    className="text-xs text-light-grey hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 px-2 py-1 rounded hover:bg-border-blue/20"
                    onClick={() => token && handleFetchApps(token)}
                    disabled={loading}
                  >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <LoaderCircle className="animate-spin text-blue" size={32} />
                  <p className="animate-pulse text-white">Loading your apps...</p>
                </div>
              ) : publicKeys.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <div className="w-16 h-16 rounded-full border border-border-blue/20 flex items-center justify-center bg-bg-primary/30">
                    <Key size={32} className="text-light-grey opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-lg mb-2">No public keys found</p>
                    <p className="text-light-grey opacity-70 mb-4">
                      Add your public keys in Settings to view participant apps
                    </p>
                    <Button
                      variant="primary"
                      className="h-10"
                      onClick={() => window.location.href = "/settings"}
                    >
                      Go to Settings
                    </Button>
                  </div>
                </div>
              ) : apps.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-6">
                  <div className="w-16 h-16 rounded-full border border-border-blue/20 flex items-center justify-center bg-bg-primary/30">
                    <Key size={32} className="text-light-grey opacity-50" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-lg mb-2">No apps found</p>
                    <p className="text-light-grey opacity-70">
                      None of your public keys are participants in any Enigma-enabled apps
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-6 pb-4 border-b border-border-blue/30">
                    <p className="text-white font-semibold text-lg mb-1">
                      {apps.length} App{apps.length !== 1 ? "s" : ""} Found
                    </p>
                    <p className="text-light-grey text-sm opacity-70">
                      Apps where your public keys are participants
                    </p>
                  </div>
                  <MpcAppList apps={apps} />
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Lock size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">Secure Authentication</h3>
            <p className="text-light-grey text-sm opacity-70">
              Sign in securely to access your MPC participant apps
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Key size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">Multiple Keys</h3>
            <p className="text-light-grey text-sm opacity-70">
              Manage multiple public keys and view all associated participant apps
            </p>
          </div>

          <div className="p-6 rounded-xl border border-border-blue bg-bg-secondary/30">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue/20 to-blue/40 flex items-center justify-center mb-4">
              <Shield size={20} className="text-blue" />
            </div>
            <h3 className="text-white font-semibold mb-2">Sign Requests</h3>
            <p className="text-light-grey text-sm opacity-70">
              Sign decryption requests for Enigma-enabled apps you&apos;re participating in
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
