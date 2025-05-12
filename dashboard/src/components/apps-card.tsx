"use client";
import useAPIKeys from "@/hooks/useApiKeys";
import { Filter, useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import { Plus } from "lucide-react";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { Text } from ".//text";
import AppList from "./app-list";
import Button from "./button";
import CreateApp from "./create-app";
import { useDialog } from "./dialog/provider";
import SecondarySelect from "./select/secondary-select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type AppsCardProps = {
  token?: string;
};

const AppsCard = ({ token }: AppsCardProps) => {
  const { setOpen } = useDialog();
  const { setFilter, filter, appsList, setAppsList } = useOverview();
  const { updateAPIKeys } = useAPIKeys();

  useEffect(() => {
    if (!token) return;
    updateAPIKeys();
    AppService.getApps({ token })
      .then((response) => {
        setAppsList(response?.data ?? []);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  return (
    <>
      <Card className="shadow-primary border-border-grey bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-lg pt-0 gap-0 flex-1 pb-0 block relative">
        <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute flex w-full h-full opacity-80" />
        <CardHeader className="p-4 border-b border-border-blue gap-0 z-1 relative">
          <div className="flex items-center justify-between">
            <CardTitle>
              <Text size={"xl"} weight={"bold"} variant={"light-grey"}>
                Your Apps {appsList.length ? `(${appsList.length})` : null}
              </Text>
            </CardTitle>
            <div className="flex items-center gap-6">
              <ToastContainer />
              <SecondarySelect
                options={["All", "Unallocated", "Allocated"]}
                onChange={(value) => setFilter(value as Filter)}
                value={filter}
                className="w-36"
              />
              <Button
                variant="link"
                className="flex items-center gap-1.5 p-1.5 hover:bg-transparent cursor-pointer underline-offset-[2.5px]"
                onClick={() => {
                  setOpen("create-app");
                }}
              >
                <div className="w-6 h-6 rounded border border-dashed border-light-grey flex items-center justify-center">
                  <Plus size={14} color="#dadada" />
                </div>
                <Text size={"sm"} weight={"semibold"} variant={"grey-500"}>
                  Create New
                </Text>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Text
            size={"sm"}
            weight={"medium"}
            variant={"light-grey"}
            className="mb-4 px-4 pt-4"
          >
            Generate a key. Use this key to submit data. You can have multiple
            keys for the same app.
          </Text>
          <AppList />
        </CardContent>
      </Card>
      <CreateApp />
    </>
  );
};

export default AppsCard;
