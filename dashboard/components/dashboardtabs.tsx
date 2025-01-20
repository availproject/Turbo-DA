"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCommonStore } from "@/store/common"
import TransactionTable from "@/components/transactiontable"
import BalanceTable from "@/components/balancetable"
import UpdateAppId from "./updateappid"
import { InfoIcon } from "lucide-react"
import { useEffect } from "react"
import useTransfers from "@/hooks/useTransfers"

export default function DashboardTabs() {
  const { tab, setTab } = useCommonStore()
  const {getTokens} = useTransfers()

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        await getTokens();
      } catch (error) {
        console.error("Error fetching tokens:", error);
      }
    };
  
    fetchTokens();
  }, []);

  return (

    <Tabs
      defaultValue="balances"
      value={tab}
      onValueChange={(value) => setTab(value)}
      className="bg-[#1D1D1D] rounded-2xl p-6 mx-auto text-white lg:w-[70vw] w-[90vw] md:[80vw]"
    >
      <div className="text-mono text-white text-opacity-90 pt-2 pb-6 flex flex-row items-center justify-start space-x-2"><InfoIcon className="w-4 h-4"/><p>This is where you&apos;ll manage your TurboDa Account, you can set up AppIds, see balances and more</p></div>
          <UpdateAppId/>
      <TabsList className="grid md:w-[40%] grid-cols-2 mb-4">
        <TabsTrigger value="balances" className={`py-3`}>
          Balances
        </TabsTrigger>
        <TabsTrigger value="transactions" className={`py-3`}>
          Transactions
        </TabsTrigger>
      </TabsList>
      <TabsContent value="transactions">
        <TransactionTable />
      </TabsContent>
      <TabsContent value="balances">
        <BalanceTable />
      </TabsContent>
    </Tabs>
  )

}