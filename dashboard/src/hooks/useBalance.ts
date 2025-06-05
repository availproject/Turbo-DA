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
        const mainCreditBalance = +response?.data?.credit_balance || 0;
        setCreditBalance(mainCreditBalance);
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
