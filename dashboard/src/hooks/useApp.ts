import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AppService from "@/services/app";

const useApp = () => {
  const { token } = useConfig();
  const { setAppsList } = useOverview();

  const updateAppList = () => {
    if (!token) return;
    AppService.getApps({ token })
      .then((response) => {
        setAppsList(response?.data ?? []);
      })
      .catch((error) => {
        console.log(error);
      });
  };
  return {
    updateAppList,
  };
};

export default useApp;
