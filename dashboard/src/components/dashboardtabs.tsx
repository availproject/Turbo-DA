// "use client";

// import { Tabs } from "@/components/tabs";
// import { useCommonStore } from "@/store/common";
// // import TransactionTable from "@/components/transactiontable"
// // import BalanceTable from "@/components/balancetable"
// // import UpdateAppId from "./updateappid"
// import useTransfers from "@/hooks/useTransfers";
// import { InfoIcon } from "lucide-react";
// import { useEffect } from "react";
// import Credit from "./credit";

// export default function DashboardTabs() {
//   const { tab, setTab } = useCommonStore();
//   const { getTokens } = useTransfers();

//   useEffect(() => {
//     const fetchTokens = async () => {
//       try {
//         await getTokens();
//       } catch (error) {
//         console.error("Error fetching tokens:", error);
//       }
//     };

//     fetchTokens();
//   }, []);

//   return (
//     <Tabs
//       defaultValue="balances"
//       value={tab}
//       onValueChange={(value) => setTab(value)}
//       className="bg-[#1D1D1D] rounded-2xl p-6 mx-auto text-white lg:w-[70vw] w-[90vw] md:[80vw]"
//     >
//       <div className="text-mono text-white text-opacity-90 pt-2 pb-6 flex flex-row items-start justify-start space-x-2">
//         <InfoIcon className="w-4 h-4 mt-1" />
//         <p>
//           This is the dashboard for your TurboDA Account, you can set up your
//           AppId, copy your api-key and see credits here. (In Bytes)
//         </p>
//       </div>
//       <Credit />
//       {/* <UpdateAppId/> */}
//       {/* <TabsList className="grid md:w-[40%] grid-cols-2 mb-4">
//         <TabsTrigger value="balances" className={`py-3`}>
//           Balances
//         </TabsTrigger>
//         <TabsTrigger value="transactions" className={`py-3`}>
//           Transactions
//         </TabsTrigger>
//       </TabsList>
//       <TabsContent value="transactions">
//         <TransactionTable />
//       </TabsContent>
//       <TabsContent value="balances">
//         <BalanceTable />
//       </TabsContent> */}
//     </Tabs>
//   );
// }
