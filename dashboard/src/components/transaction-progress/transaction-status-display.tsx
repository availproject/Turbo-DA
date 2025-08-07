import { TRANSACTION_MESSAGES } from "@/constants/transaction";
import { TransactionStatus } from "@/providers/ConfigProvider";
import { Text } from "../text";

interface TransactionStatusDisplayProps {
  status: TransactionStatus["status"];
  tokenAmount?: number;
  className?: string;
}

export const TransactionStatusDisplay = ({
  status,
  tokenAmount,
  className,
}: TransactionStatusDisplayProps) => {
  const getStatusMessage = () => {
    switch (status) {
      case "initialised":
      case "broadcast":
        return TRANSACTION_MESSAGES.STATUS.BROADCAST;
      case "inblock":
        return TRANSACTION_MESSAGES.STATUS.INBLOCK;
      case "finality":
        return TRANSACTION_MESSAGES.STATUS.FINALITY;
      case "completed":
        return TRANSACTION_MESSAGES.STATUS.COMPLETED;
      default:
        return "";
    }
  };

  return (
    <div className={className}>
      <Text weight="semibold" size="2xl" className="text-center">
        {getStatusMessage()}
      </Text>
    </div>
  );
};

export const TransactionDescription = ({
  status,
}: {
  status: TransactionStatus["status"];
}) => {
  const getDescriptionMessage = () => {
    switch (status) {
      case "initialised":
      case "broadcast":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.BROADCAST;
      case "inblock":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.INBLOCK;
      case "finality":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.FINALITY;
      case "completed":
        return TRANSACTION_MESSAGES.DESCRIPTIONS.COMPLETED;
      default:
        return "";
    }
  };

  return (
    <Text
      weight="medium"
      size="base"
      variant="secondary-grey"
      className="text-center"
    >
      {getDescriptionMessage()}
    </Text>
  );
};
