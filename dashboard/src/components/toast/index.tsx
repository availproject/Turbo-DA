import { TransactionStatus } from "@/providers/ConfigProvider";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import Failure from "./failure";
import Success from "./success";
import TransactionProgress from "./transaction-progress";

type ToastProps = {
  label?: string;
  description?: string;
  className?: string;
  transaction?: TransactionStatus;
};

type TransactionToastProps = {
  className?: string;
  transaction: TransactionStatus;
};

export const useAppToast = () => {
  return {
    success: ({ label, description, className }: ToastProps) =>
      toast(
        <Success
          label={label}
          description={description}
          className={className}
        />,
        {
          containerId: "toast-container",
          theme: "colored",
          progressClassName: "bg-[#78C47B]",
          closeButton: () => (
            <X
              color="#FFF"
              size={20}
              className="cursor-pointer"
              onClick={() => toast.dismiss()}
            />
          ),
          style: {
            backgroundColor: "#78C47B29",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
            marginBottom: "0px",
            backdropFilter: "blur(48px)",
          },
        }
      ),
    error: ({ label, description, className }: ToastProps) =>
      toast(
        <Failure
          label={label}
          description={description}
          className={className}
        />,
        {
          theme: "colored",
          progressClassName: "bg-[#ff7360]",
          containerId: "toast-container",
          closeButton: () => (
            <X
              color="#FFF"
              size={20}
              className="cursor-pointer"
              onClick={() => toast.dismiss()}
            />
          ),
          style: {
            backgroundColor: "#DC262629",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
            marginBottom: "0px",
          },
          className: "backdrop-blur-xl",
        }
      ),
    transactionProgress: ({ transaction, className }: TransactionToastProps) =>
      toast(
        <TransactionProgress transaction={transaction} className={className} />,
        {
          theme: "colored",
          closeButton: false,
          containerId: "stacked-toast-container",
          hideProgressBar: true,
          style: {
            backgroundColor: "#2B47613D",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            borderRadius: "8px",
            marginBottom: "0px",
          },
          autoClose: false,
          className: "backdrop-blur-xl",
        }
      ),
  };
};
