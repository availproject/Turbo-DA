import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AuthenticationService from "@/services/authentication";
import { useCallback, useState } from "react";

const useBalance = () => {
  const [loading, setLoading] = useState(false);
  const { setCreditBalance, creditBalance } = useOverview();
  const { token } = useConfig();

  const updateCreditBalance = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    AuthenticationService.fetchUser({ token })
      .then((response) => {
        setCreditBalance(
          response?.data?.credit_balance ? +response?.data?.credit_balance : 0
        );
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  return { loading, updateCreditBalance, creditBalance: +creditBalance };
};

export default useBalance;
