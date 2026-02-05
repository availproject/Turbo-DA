"use client";

import { AppDetails } from "@/services/app/response";
import MpcAppItem from "./app-item";

const MpcAppList = ({ apps }: { apps: AppDetails[] }) => {
  if (!apps?.length) return null;

  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {apps.map((app) => (
        <MpcAppItem key={app.id} app={app} />
      ))}
    </div>
  );
};

export default MpcAppList;
