"use client";
import { Filter, useOverview } from "@/providers/OverviewProvider";
import CreditService from "@/services/credit";
import { Plus } from "lucide-react";
import { useEffect } from "react";
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
  const { setAPIKeys, setFilter, filter, appsList, setAppsList } =
    useOverview();

  useEffect(() => {
    if (!token) return;
    CreditService.getAPIKeys({ token })
      .then((response) => {
        const apiKeysList = response.data?.reduce(
          (
            acc: Record<string, string[]>,
            current: { app_id: string; api_key: string }
          ) => {
            return { ...acc, [current.app_id]: [current.api_key] };
          },
          {}
        );
        setAPIKeys(apiKeysList);
      })
      .catch((error) => {
        console.log(error);
      });
    CreditService.getApps({ token })
      .then((response) => {
        console.log(response);
        setAppsList(response?.data ?? []);
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  return (
    <>
      <Card className="bg-[#192a3d] border-none shadow-[0px_4.37px_96.13px_-17.48px_#13151d] rounded-lg pt-0 gap-0 flex-1">
        <CardHeader className="p-4 border-b border-[#565656] gap-0">
          <div className="flex items-center justify-between">
            <CardTitle>
              <Text size={"xl"} weight={"bold"} variant={"light-grey"}>
                Your Apps ({appsList.length})
              </Text>
            </CardTitle>
            <div className="flex items-center gap-6">
              <SecondarySelect
                label="Show"
                options={["All", "Allocated"]}
                onChange={(value) => setFilter(value as Filter)}
                value={filter}
              />
              <Button
                variant="link"
                className="flex items-center gap-1.5 p-1.5 hover:bg-transparent cursor-pointer underline-offset-[2.5px]"
                onClick={() => setOpen("create-app")}
              >
                <div className="w-6 h-6 rounded border border-dashed border-[#dadada] flex items-center justify-center">
                  <Plus size={14} color="#dadada" />
                </div>
                <Text size={"sm"} weight={"bold"} variant={"light-grey"}>
                  Create New App
                </Text>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <Text
            size={"sm"}
            weight={"medium"}
            variant={"light-grey"}
            className="mb-4"
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
