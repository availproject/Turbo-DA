import { useOverview } from "@/providers/OverviewProvider";
import AppItem from "./app-item";

const AppList = () => {
  const { appsList } = useOverview();
  return (
    <div className="h-[660px] overflow-auto w-full px-4">
      <div className="flex flex-col gap-y-4 w-full pb-4">
        {appsList.map((app: any, index) => (
          <AppItem key={index} app={app} />
        ))}
      </div>
    </div>
  );
};

export default AppList;
