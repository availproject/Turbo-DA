// /* eslint-disable @next/next/no-img-element */
// "use client";

// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import useTransfers from "@/hooks/useTransfers";
// import { useCommonStore } from "@/store/common";
// import { Button as DegenButton, Input as DegenInput } from "degen";
// import { ChevronRight } from "lucide-react";
// import { useEffect, useState } from "react";
// import Button from "./button";
// import { Spinner } from "./ui/spinner";

// export function TokenSelector() {
//   const { supportedTokens, selectedToken, setSelectedToken } = useCommonStore();
//   const [isOpen, setIsOpen] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const { getTokens } = useTransfers();

//   const filteredTokens = supportedTokens.filter(
//     (token) =>
//       token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   useEffect(() => {
//     (async () => {
//       await getTokens();
//     })();
//   }, []); //empty array to run only once

//   return (
//     <Dialog open={isOpen} onOpenChange={setIsOpen}>
//       <DialogTrigger asChild>
//         <div className="flex flex-col group">
//           <DegenButton variant="tertiary" size="small">
//             <div className="flex items-center">
//               <img
//                 src={selectedToken.logo}
//                 alt={`${selectedToken.name} logo`}
//                 className="w-4 h-4 mr-2 rounded-full group-hover:hidden transition-opacity duration-1000 delay-1000"
//               />
//               <span className="group-hover:hidden">{selectedToken.symbol}</span>
//               <span className="hidden group-hover:inline transition-opacity duration-1000 delay-1000">
//                 Switch Token
//               </span>
//               <ChevronRight className="h-4 " />
//             </div>
//           </DegenButton>
//         </div>
//       </DialogTrigger>
//       <DialogContent className="sm:max-w-[425px] bg-[#1F1F1F] !border-0 text-white !rounded-[1.5rem]">
//         <DialogHeader>
//           <DialogTitle className="flex justify-between items-center">
//             <span>Select Token</span>
//           </DialogTitle>
//         </DialogHeader>
//         <div className="relative">
//           <DegenInput
//             placeholder="Search tokens"
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//             label=""
//           />
//         </div>
//         <ScrollArea className="max-h-[300px] pr-4 !space-y-2">
//           {filteredTokens.length !== 0 ? (
//             filteredTokens.map((token, index) => (
//               <Button
//                 key={index}
//                 variant="ghost"
//                 className="w-full justify-between hover:bg-[#2D2D2D] mb-2 hover:rounded-[.8rem] py-6 hover:text-white"
//                 onClick={() => {
//                   setSelectedToken(token);
//                   setIsOpen(false);
//                 }}
//               >
//                 <div className="flex items-center">
//                   <img
//                     src={token.logo}
//                     alt={`${token.name} logo`}
//                     className="w-8 h-8 mr-2 rounded-full"
//                   />
//                   <div className="text-left">
//                     <div>{token.name}</div>
//                     <div className="text-sm text-gray-400">{token.symbol}</div>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   <div className="text-sm text-gray-400">{token.symbol}</div>
//                 </div>
//               </Button>
//             ))
//           ) : (
//             <Spinner />
//           )}
//         </ScrollArea>
//       </DialogContent>
//     </Dialog>
//   );
// }
