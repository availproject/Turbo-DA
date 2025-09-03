import { useUser } from "@/providers/UserProvider";
import { useCallback, useState } from "react";

const useBalance = () => {
  const [loading, setLoading] = useState(false);
  const { creditBalance, refetchUser } = useUser();

  const updateCreditBalance = useCallback(async () => {
    setLoading(true);
    try {
      await refetchUser();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, [refetchUser]);

  return { loading, updateCreditBalance, creditBalance: +creditBalance };
};

export default useBalance;
