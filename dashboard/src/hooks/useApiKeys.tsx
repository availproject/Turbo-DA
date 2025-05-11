import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import CreditService from "@/services/credit";

const useAPIKeys = () => {
  const { setAPIKeys } = useOverview();
  const { token } = useConfig();

  const updateAPIKeys = async () => {
    if (!token) return;

    CreditService.getAPIKeys({ token })
      .then((response) => {
        const apiKeysList = response.data?.reduce(
          (
            acc: Record<string, string[]>,
            current: { app_id: string; identifier: string }
          ) => {
            if (acc[current.app_id]) {
              return {
                ...acc,
                [current.app_id]: [...acc[current.app_id], current.identifier],
              };
            } else {
              return { ...acc, [current.app_id]: [current.identifier] };
            }
          },
          {}
        );
        setAPIKeys(apiKeysList);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  return { updateAPIKeys };
};

export default useAPIKeys;
