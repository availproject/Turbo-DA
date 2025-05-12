import { useOverview } from "@/providers/OverviewProvider";
import { Close } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useMemo } from "react";
import { Text } from ".//text";
import Button from "./button";
import { DialogTitle } from "./dialog";
import { useDialog } from "./dialog/provider";
import { Dialog, DialogContent } from "./ui/dialog";

type ViewKeysProps = {
  id: string;
  appId: string;
  openDeleteAlert: (apiKey: string) => void;
};

export default function ViewKeys({
  id,
  appId,
  openDeleteAlert,
}: ViewKeysProps) {
  const { open, setOpen } = useDialog();
  const { apiKeys } = useOverview();

  const currentAppAPIKeys = useMemo(() => {
    return apiKeys?.[appId];
  }, [apiKeys]);

  return (
    <Dialog
      open={open === id}
      onOpenChange={(value) => {
        if (!value) {
          setOpen("");
        }
      }}
    >
      <DialogContent className="w-full sm:max-w-[600px] h-[600px] rounded-2xl overflow-hidden border bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] shadow-primary border-border-grey flex flex-col focus-within:outline-0 p-0">
        <div className="flex justify-between items-center mb-0 p-4">
          <DialogTitle>
            <Text weight={"semibold"} size={"2xl"}>
              All Active Keys
            </Text>
          </DialogTitle>

          <Close className="p-0 bg-transparent focus-visible:outline-none w-fit cursor-pointer">
            <X color="#FFF" size={24} strokeWidth={1} />
          </Close>
        </div>

        <div>
          <div className="flex items-center gap-2 border-b border-[#2B4761] pb-2 justify-between px-4">
            <div className="flex gap-x-24">
              <Text weight={"medium"} size={"xs"} variant={"light-grey"}>
                Sno.
              </Text>
              <Text weight={"medium"} size={"xs"} variant={"light-grey"}>
                Key
              </Text>
            </div>
            <Text
              weight={"medium"}
              size={"xs"}
              variant={"light-grey"}
              className="w-[100px] text-center"
            >
              Action
            </Text>
          </div>
          <div className="flex flex-col gap-y-4 pt-4">
            {currentAppAPIKeys?.map((apiKey, i) => (
              <div
                className="flex items-center gap-2 justify-between px-4 h-8"
                key={apiKey}
              >
                <div className="flex gap-x-24">
                  <Text weight={"bold"} className="w-4">
                    {i + 1}
                  </Text>
                  <Text weight={"bold"} className="w-20">
                    ....{apiKey}
                  </Text>
                </div>

                <Button
                  variant={"danger"}
                  className="h-8 w-[98px] flex justify-center items-center"
                  onClick={() => openDeleteAlert(apiKey)}
                >
                  <Text
                    weight={"medium"}
                    size={"sm"}
                    className="w-[100px] text-[#CB6262]"
                  >
                    Delete
                  </Text>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
