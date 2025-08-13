import { useOverview } from "@/providers/OverviewProvider";
import AppItem from "./app-item";

const AppList = () => {
  const { appsList } = useOverview();
  return (
    <div className="max-h-[660px] overflow-y-auto w-full px-4 pb-6 av-scroll">
      <div className="flex flex-col gap-y-4 w-full pb-4">
        {appsList.map((app: any, index) => (
          <AppItem key={index} app={app} />
        ))}
      </div>
    </div>
  );
};

export default AppList;
