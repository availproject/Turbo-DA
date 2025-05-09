// import { ApiKey, deleteApiKey, getAllApiKeys } from "@/lib/services";
// import { cn } from "@/lib/utils";
// import { Trash2 } from "lucide-react";
// import { useEffect, useState } from "react";
// import Loader from "./loader";
// import { Table, TableBody, TableCell, TableRow } from "./ui/table";
// // import { useToast } from "./ui/use-toast";

// export default function ApiKeysTable({ token }: { token: string | null }) {
//   const [deletingKey, setDeletingKey] = useState<string | null>(null);
//   const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);
//   const [deletedKey, setDeletedKey] = useState<string | null>(null);
//   // const { toast } = useToast();

//   const fetchApiKeys = async () => {
//     if (!token) return;
//     const keys = await getAllApiKeys(token);
//     setApiKeys(keys);
//   };

//   useEffect(() => {
//     fetchApiKeys();
//   }, [token]);

//   const handleDelete = async (identifier: string) => {
//     try {
//       if (!token) return;
//       setDeletingKey(identifier);
//       await deleteApiKey(token, identifier);
//       await fetchApiKeys();
//       // toast({
//       //   title: "API Key Deleted",
//       //   description: "The API key has been successfully removed.",
//       //   variant: "default",
//       // });
//       setDeletedKey(identifier);
//     } catch (error) {
//       console.error("Error deleting API key:", error);
//       // toast({
//       //   title: "Error",
//       //   description: "Failed to delete the API key. Please try again.",
//       //   variant: "destructive",
//       // });
//     } finally {
//       setDeletingKey(null);
//     }
//   };

//   if (apiKeys === null)
//     return (
//       <div className="flex justify-center p-4">
//         <Loader />
//       </div>
//     );

//   return (
//     <>
//       {" "}
//       <h1 className="text-left text-lg font-mono text-white mt-8 mb-4">
//         Previous Keys{" "}
//         <span
//           className="text-blue-500 text-sm cursor-pointer"
//           onClick={fetchApiKeys}
//         >
//           (Refresh?)
//         </span>
//       </h1>
//       <div className="overflow-hidden md:w-1/2 rounded-lg border !border-opacity-20 border-white bg-background">
//         <Table className="">
//           <TableBody>
//             {apiKeys?.length > 0 ? (
//               apiKeys.map((key) => (
//                 <TableRow
//                   key={key.identifier}
//                   className={cn(
//                     "transition-colors duration-200",
//                     deletedKey === key.identifier && " dark:bg-red-900",
//                     "",
//                     "border-r border-white !border-opacity-20"
//                   )}
//                 >
//                   <TableCell className="py-2 font-mono text-sm">
//                     xxxxxxxxx{key.identifier}
//                   </TableCell>
//                   <TableCell className="py-2 flex items-center justify-end">
//                     <button
//                       onClick={() => handleDelete(key.identifier)}
//                       className={cn(
//                         "p-2 rounded-md transition-colors",
//                         deletingKey === key.identifier ? " text-white" : "",
//                         "disabled:opacity-50"
//                       )}
//                       disabled={deletingKey === key.identifier}
//                     >
//                       {deletingKey === key.identifier ? (
//                         <Loader />
//                       ) : (
//                         <Trash2 className={cn("w-5 h-5 text-red-500")} />
//                       )}
//                     </button>
//                   </TableCell>
//                 </TableRow>
//               ))
//             ) : (
//               <TableRow>
//                 <TableCell
//                   colSpan={3}
//                   className="text-center py-8 text-gray-500"
//                 >
//                   No API keys available. Generate one to get started.
//                 </TableCell>
//               </TableRow>
//             )}
//           </TableBody>
//         </Table>
//       </div>
//     </>
//   );
// }
