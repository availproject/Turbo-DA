"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCommonStore } from "@/store/common"
import TransactionTable from "@/components/transactiontable"
import BalanceTable from "@/components/balancetable"

export default function DashboardTabs() {
  const { tab, setTab } = useCommonStore()

  return (
    <Tabs
      defaultValue="balances"
      value={tab}
      onValueChange={(value) => setTab(value)}
      className="bg-[#1D1D1D] rounded-2xl p-6 mx-auto text-white lg:w-[70vw] w-[90vw] md:[80vw]"
    >
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