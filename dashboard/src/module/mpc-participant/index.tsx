"use client";

import Button from "@/components/button";
import PrimaryInput from "@/components/input/primary";
import { Text } from "@/components/text";
import { useAppToast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EnigmaService from "@/services/enigma";
import { AppDetails } from "@/services/app/response";
import { LoaderCircle, Search, Wallet } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useModal } from "connectkit";
import MpcAppList from "./app-list";
import { useAuth } from "@/providers/AuthProvider";

const MpcParticipantView = () => {
  const [addressInput, setAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<AppDetails[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const { error: errorToast } = useAppToast();
  const { token } = useAuth();

  const { address, isConnected } = useAccount();
  const { setOpen: openConnectModal } = useModal();

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

  const handleUseConnectedWallet = () => {
    if (isConnected && address && token) {
      setAddressInput(address);
      handleFetchApps(address, token);
    } else {
      openConnectModal(true);
    }
  };

  return (
    <div className="relative w-full min-h-[780px] max-w-4xl mx-auto">
      <div className="absolute w-full h-full rounded-3xl bg-linear-[139.26deg] from-border-grey/80 from-[-0.73%] via-border-blue/60 via-[50%] to-border-secondary to-[100.78%] p-0.5 overflow-hidden shadow-2xl">
        <Card className="shadow-primary border-none bg-linear-[135deg] from-bg-primary/95 from-[0%] via-bg-secondary/90 via-[50%] to-bg-primary/95 to-[100%] rounded-3xl pt-0 gap-0 flex-1 pb-0 block relative h-full backdrop-blur-sm">
          <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute flex w-full h-full opacity-30" />
          <div className="absolute inset-0 bg-linear-[135deg] from-transparent via-blue/5 to-transparent opacity-50" />

          <CardHeader className="p-8 border-b border-border-blue/50 gap-6 z-10 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-linear-[135deg] from-blue/20 to-blue/40 flex items-center justify-center shadow-lg border border-blue/30">
                   <Wallet size={24} className="text-blue drop-shadow-sm flex-shrink-0" />
                 </div>
                <div className="space-y-1">
                  <CardTitle>
                    <Text size={"2xl"} weight={"bold"} className="bg-linear-[90deg] from-white to-light-grey bg-clip-text text-transparent">
                      MPC Participant Portal
                    </Text>
                  </CardTitle>
                  <Text size={"base"} variant={"light-grey"} className="opacity-90">
                    View apps and sign decryption requests without logging in
                  </Text>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 w-full sm:w-auto">
                <PrimaryInput
                  label="Participant Address"
                  placeholder="Enter your wallet address (0x...)"
                  value={addressInput}
                  onChange={setAddressInput}
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  className="flex-1 sm:flex-none mb-[2px] h-[52px] shadow-lg hover:shadow-primary-button/50 transition-all duration-300 flex items-center justify-center"
                  onClick={() => token && handleFetchApps(addressInput, token)}
                  disabled={loading || !addressInput || !token}
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin flex-shrink-0" size={20} />
                  ) : (
                    <>
                      <Search size={18} className="mr-2 flex-shrink-0" />
                      Find Apps
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 sm:flex-none mb-[2px] h-[52px] border-border-blue/60 hover:border-blue/50 hover:bg-blue/10 transition-all duration-300 shadow-lg flex items-center justify-center"
                  onClick={handleUseConnectedWallet}
                >
                  <Wallet size={18} className="mr-2 flex-shrink-0" />
                  {isConnected ? "Use Connected Wallet" : "Connect Wallet"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 z-10 relative h-[calc(100%-180px)] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <LoaderCircle className="animate-spin text-blue flex-shrink-0" size={32} />
                <Text variant="light-grey" className="animate-pulse">
                  Loading your apps...
                </Text>
              </div>
            ) : hasSearched && apps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
                <div className="w-20 h-20 rounded-2xl bg-linear-[135deg] from-border-blue/30 to-border-grey/30 flex items-center justify-center shadow-xl border border-border-blue/20">
                  <Search size={32} className="text-light-grey opacity-70 flex-shrink-0" />
                </div>
                <div className="text-center space-y-3 max-w-md">
                  <Text variant="light-grey" size="xl" weight="semibold">
                    No apps found for this address
                  </Text>
                  <Text variant="light-grey" size="sm" className="leading-relaxed opacity-80">
                    Make sure you are added as a participant to an Enigma-enabled app using this address.
                  </Text>
                </div>
              </div>
            ) : !hasSearched ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
                <div className="w-24 h-24 rounded-2xl bg-linear-[135deg] from-blue/10 to-border-blue/20 flex items-center justify-center shadow-2xl border border-blue/20">
                  <Wallet size={48} className="text-blue opacity-60 flex-shrink-0" />
                </div>
                <div className="text-center space-y-2">
                  <Text variant="light-grey" size="xl" weight="medium" className="opacity-90">
                    Enter an address to view associated apps
                  </Text>
                  <Text variant="light-grey" size="sm" className="opacity-70">
                    Start by entering your participant wallet address above
                  </Text>
                </div>
              </div>
            ) : (
              <>
                <div className="px-8 pt-6 pb-2">
                  <Text weight="semibold" variant="light-grey" size="lg" className="opacity-90">
                    Found {apps.length} App{apps.length !== 1 ? "s" : ""}
                  </Text>
                </div>
                <MpcAppList apps={apps} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MpcParticipantView;
