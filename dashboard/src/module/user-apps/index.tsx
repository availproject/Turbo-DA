"use client";
import Button from "@/components/button";
import { useDialog } from "@/components/dialog/provider";
import SecondarySelect from "@/components/select/secondary-select";
import { Text } from "@/components/text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import useAPIKeys from "@/hooks/useApiKeys";
import { cn } from "@/lib/utils";
import { Filter, useOverview } from "@/providers/OverviewProvider";
import { useAuthState } from "@/providers/AuthProvider";
import AppService from "@/services/app";
import { CirclePlus } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../transactions-history/components/empty-state";
import AppList from "./app-list";
import CreateApp from "./create-app";

const AppsCard = () => {
  const { setOpen } = useDialog();
  const [loading, setLoading] = useState(true);
  const { setFilter, filter, appsList, setAppsList } = useOverview();
  const { updateAPIKeys } = useAPIKeys();
  const { isAuthenticated, isLoading, isLoggedOut, token } = useAuthState();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    updateAPIKeys();
    AppService.getApps({ token })
      .then((response) => {
        setAppsList(response?.data ?? []);
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isAuthenticated, token]);

  // Don't render anything if user is logged out
  if (isLoggedOut) {
    return null;
  }

  // Show loading state while authentication is loading
  if (isLoading) {
    return (
      <div className={cn("relative w-full h-[780px]")}>
        <div className="absolute w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px overflow-hidden">
          <Card className="shadow-primary border-none bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary rounded-2xl to-[100%] pt-0 gap-0 flex-1 pb-0 block relative h-full">
            <CardContent className="p-4 flex items-center justify-center">
              <Text size={"sm"} variant={"secondary-grey"}>
                Loading apps...
              </Text>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Only render if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className={cn("relative w-full h-[780px]")}>
        <div className="absolute w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px overflow-hidden">
          <Card className="shadow-primary border-none bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary rounded-2xl to-[100%] pt-0 gap-0 flex-1 pb-0 block relative h-full">
            <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
            <CardHeader className="p-4 border-b border-border-blue gap-0 z-1 relative">
              <div className="flex items-center justify-between">
                <CardTitle>
                  <Text size={"xl"} weight={"bold"} variant={"light-grey"}>
                    Your Apps {appsList.length ? `(${appsList.length})` : null}
                  </Text>
                </CardTitle>
                <div className="flex items-center gap-6">
                  <SecondarySelect
                    options={[
                      "All",
                      "Using Main Credits",
                      "Using Assigned Credits",
                    ]}
                    onChange={(value) => setFilter(value as Filter)}
                    value={filter}
                  />
                  <Button
                    variant="link"
                    className="flex gap-x-1 items-center cursor-pointer underline underline-offset-[2.5px]"
                    onClick={() => {
                      setOpen("create-app");
                    }}
                  >
                    <CirclePlus size={24} color="#B3B3B3" strokeWidth={1} />
                    <Text
                      size={"sm"}
                      weight={"semibold"}
                      variant={"secondary-grey"}
                    >
                      Create New
                    </Text>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {!loading && !appsList?.length ? (
                <EmptyState message="No App Found" />
              ) : null}
              {!loading && appsList?.length ? (
                <Text
                  size={"sm"}
                  weight={"medium"}
                  variant={"light-grey"}
                  className="mb-4 px-4 pt-4"
                >
                  Generate a key. Use this key to submit data. You can have
                  multiple keys for the same app.
                </Text>
              ) : null}
              {loading ? (
                <div className="flex flex-col gap-y-4 mt-4 px-4">
                  <Skeleton className="h-52" sheen={false} />
                  <Skeleton className="h-52" sheen={false} />
                </div>
              ) : (
                <AppList />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <CreateApp />
    </>
  );
};

export default AppsCard;
