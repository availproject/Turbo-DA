"use client";

import TransferCard from "@/components/transfercard";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import DashboardTabs from "@/components/dashboardtabs";
import UpdateAppId from "@/components/updateappid";
import { useCommonStore } from "@/store/common";
import Loading from "@/components/loading";
import { useEffect } from "react";
import useUserInfo from "@/hooks/useUserInfo";

export default function Page() {
  const { userFetched } = useCommonStore();
  const { getUserInfo } = useUserInfo();
  const { sessionToken } = useCommonStore();

  useEffect(() => {
    (async () => {
      await getUserInfo();
    })();
  }, [getUserInfo, sessionToken]);

  return (
    <>
      <SignedIn>
        {userFetched ? (
          <div className="space-y-4 flex flex-col items-center justify-center py-[3vh] lg:w-[70vw] w-[90vw] md:[80vw] mx-auto">
            <DashboardTabs />
          </div>
        ) : (
          <Loading />
        )}
      </SignedIn>
      <SignedOut>
        <div className="h-[70vh] w-screen flex flex-col items-center justify-center space-y-8">
          <h1 className="text-white text-opacity-70 text-md font-sans font-thin">
            Please sign in to access the dashboard.
          </h1>
        </div>
      </SignedOut>
    </>
  );
}
