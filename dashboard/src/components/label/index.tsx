import React from "react";
import Image from "next/image";

type LabelStatus = "pending" | "complete" | "cancelled";

interface LabelProps {
  status: LabelStatus;
}

const labelStyles: Record<LabelStatus, string> = {
  pending:
    "border-[--Stroke-2xs] border-[1px] border-[color:var(--Color-stroke-warning-primary,#E4A354)] bg-[color:var(--Color-bg-warning-surface-base-alpha,rgba(228,163,84,0.16))]",
  complete:
    "border-[--Stroke-2xs] border-[1px] border-[color:var(--Color-stroke-success-primary,#78C47B)] bg-[color:var(--Color-bg-success-surface-base-alpha,rgba(120,196,123,0.16))]",
  cancelled:
    "border-[--Stroke-2xs] border-[1px] border-[color:var(--Color-stroke-error-primary,#CF6679)] bg-[color:var(--Color-bg-error-surface-base-alpha,rgba(207,102,121,0.16))]",
};

const labelIcons: Record<LabelStatus, string | null> = {
  pending: "/danger.svg",
  complete: "/tick-circle.svg",
  cancelled: "/close-circle.svg",
};

const Label: React.FC<LabelProps> = ({ status }) => {
  return (
    <div
      className={`flex items-center text-white gap-[4px] px-2 py-1 rounded-[24px] text-xs font-medium uppercase ${labelStyles[status]}`}
    >
      {labelIcons[status] && (
        <Image src={labelIcons[status]!} alt={status} width={16} height={16} />
      )}
      <span>{status}</span>
    </div>
  );
};

export default Label;
