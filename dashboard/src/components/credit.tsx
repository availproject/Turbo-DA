import { formatBytes } from "@/lib/utils";
import { useCommonStore } from "@/store/common";
import { Badge } from "./ui/badge";

export default function Credit() {
  const { user, userFetched } = useCommonStore();

  if (userFetched) {
    return (
      <div className="flex flex-col pl-2">
        <h1 className="text-left text-2xl text-white text-opacity-80 pb-4">
          <Badge className="mr-2 text-md">
            {formatBytes(user?.credit_balance)}{" "}
            <span className="font-thin ml-2">Data Balance remaining</span>
          </Badge>{" "}
        </h1>
        <h1 className="text-left text-2xl text-white text-opacity-80 pb-8">
          <Badge className="ml-r text-md ">
            {formatBytes(user?.credit_used)}{" "}
            <span className="font-thin ml-2">Data Balance used</span>
          </Badge>
        </h1>
      </div>
    );
  }
  return <>No user</>;
}
