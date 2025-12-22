"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { type BaseDepositProps } from "../deposit";
import { Button } from "../../ui/button";
import SimpleDeposit from "./simple-deposit";

interface DepositModalProps extends BaseDepositProps {
  heading?: string;
  destinationLabel?: string;
}

const DepositModal = ({
  address,
  token,
  chain,
  chainOptions,
  heading,
  destinationLabel,
  depositExecute,
}: DepositModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Deposit</Button>
      </DialogTrigger>
      <DialogContent className="py-4 px-1 sm:p-6">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <SimpleDeposit
          address={address}
          token={token}
          chain={chain}
          chainOptions={chainOptions}
          destinationLabel={destinationLabel}
          depositExecute={depositExecute}
        />
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
