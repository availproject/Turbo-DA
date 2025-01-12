import { IconBookOpen } from "degen";
import React from "react";

export default function NoData({content, icon}: {content: string, icon: React.ReactNode}) {

    return <div className=" flex flex-col items-center justify-center space-y-2 p-4 py-8">
    {icon}
  <span className="text-[#ffffff8b] text-center">{content}</span>
  </div>
}