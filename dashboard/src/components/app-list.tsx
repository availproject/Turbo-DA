import { useOverview } from "@/providers/OverviewProvider";
import AppItem from "./app-item";

const AppList = () => {
  const { appsList } = useOverview();
  return (
    <div className="flex flex-col gap-y-4">
      {appsList.map((app: any, index) => (
        <AppItem key={index} app={app} />
      ))}
    </div>
  );
};

export default AppList;
