"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/tabs";
import { Card, CardContent } from "@/components/ui/card";
import ChangeSignersManager from "./components/manage-participants";
import DecryptRequest from "./components/decrypt-request";
import ListDecryptRequests from "./components/list-decrypt-requests";

const EnigmaWrapper = () => {
  return (
    <div className="relative w-full">
      <div className="rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px overflow-hidden">
        <Card className="shadow-primary border-none bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary rounded-2xl to-[100%] pt-0 gap-0 pb-0 block relative overflow-hidden">
          <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute inset-0 opacity-80 pointer-events-none" />
          <CardContent className="p-6 relative z-10">
            <Tabs defaultValue="change-signers" className="w-full gap-y-6">
              <TabsList className="bg-transparent p-0 h-auto border-b border-border-blue w-full justify-start rounded-none">
                <TabsTrigger value="change-signers" variant="primary">
                  Change Signers
                </TabsTrigger>
                <TabsTrigger value="decrypt" variant="primary">
                  Decrypt Requests
                </TabsTrigger>
                <TabsTrigger value="list" variant="primary">
                  Request History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="change-signers" className="mt-6">
                <ChangeSignersManager />
              </TabsContent>
              <TabsContent value="decrypt" className="mt-6">
                <DecryptRequest />
              </TabsContent>
              <TabsContent value="list" className="mt-6">
                <ListDecryptRequests />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnigmaWrapper;
