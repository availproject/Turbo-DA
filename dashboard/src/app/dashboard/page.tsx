"use client";

import DashboardTabs from "@/components/dashboardtabs";
import Loading from "@/components/loading";
import useUserInfo from "@/hooks/useUserInfo";
import { useCommonStore } from "@/store/common";
import { SignedIn } from "@clerk/nextjs";
import { useEffect } from "react";
export default function Page() {
  const { getUserInfo } = useUserInfo();
  const { sessionToken, userFetched } = useCommonStore();

  useEffect(() => {
    (async () => {
      await getUserInfo();
    })();
  }, [sessionToken]);

  return (
    <>
      <SignedIn>
        {userFetched ? (
          <div className="space-y-4 flex flex-col items-center justify-center py-[3vh] lg:w-[70vw] w-[90vw] mx-auto">
            <DashboardTabs />
          </div>
        ) : (
          <Loading />
        )}
      </SignedIn>
    </>
  );
}
