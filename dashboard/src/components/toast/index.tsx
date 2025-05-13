import { X } from "lucide-react";
import { toast } from "react-toastify";
import Failure from "./failure";
import Success from "./success";

type ToastProps = {
  label?: string;
  description?: string;
  className?: string;
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
          theme: "colored",
          className: "backdrop-blur-lg",
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
          className: "backdrop-blur-lg",
        }
      ),
  };
};
