import { useConfig } from "@/providers/ConfigProvider";
import { useOverview } from "@/providers/OverviewProvider";
import AuthenticationService from "@/services/authentication";
import { useCallback } from "react";

const useBalance = () => {
  const { setCreditBalance, creditBalance } = useOverview();
  const { token } = useConfig();

  const updateCreditBalance = useCallback(async () => {
    if (!token) return;
    AuthenticationService.fetchUser({ token })
      .then((response) => {
        setCreditBalance(
          response?.data?.credit_balance ? +response?.data?.credit_balance : 0
        );
      })
      .catch((error) => {
        console.log(error);
      });
  }, [token]);

  return { updateCreditBalance, creditBalance: +creditBalance };
};

export default useBalance;
