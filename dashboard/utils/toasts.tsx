import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Copy } from "lucide-react";
import { useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { RxArrowTopRight, RxCrossCircled } from "react-icons/rx"

/**
 * @description failed toast message
 */
export const showFailedMessage = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const truncateDescription = (text: string, wordLimit: number) => {
    const words = text.split(' ')
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...'
    }
    return text
  }

  const fullDescription = description || "Your Transaction has failed due to some error. Please try again later."
  const truncatedDescription = truncateDescription(fullDescription, 10)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullDescription)
    const copyButton = document.getElementById('copyButton')
    if (copyButton) {
      copyButton.style.color = '#00FF00'
      setTimeout(() => {
        copyButton.style.color = '#000000'
      }, 2000)
    }
  }

  toast({
    description: (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          fontWeight: "bold",
          fontSize: "1rem",
        }}
      >
        <RxCrossCircled
          style={{
            marginRight: "1rem",
            height: "40px",
            width: "40px",
          }}
          color="FF0000"
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
          }}
        >
          <p style={{ marginRight: "0.5rem" }}>{title ? title : "Transaction Failed"}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <p
              style={{
                fontSize: "0.75rem",
                color: "000",
              }}
            >
              {truncatedDescription}
            </p>
            {fullDescription.split(' ').length > 10 && (
              <button
                id="copyButton"
                onClick={copyToClipboard}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
                title="Copy full message"
              >
                <Copy style={{ height: "16px", width: "16px" }} />
              </button>
            )}
          </div>
        </div>
      </div>
    ),
  });
};

/**
 * @description success toast message
 */
export const showSuccessMessage = ({
    title,
    description,
    hash
  }: {
    title?: string;
    description?: string;
    hash?: string;
  }) => {
    toast({
      description: (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            fontWeight: "bold",
            fontSize: "1rem",
          }}
        >
          <FaCheckCircle
            style={{
              marginRight: "1rem",
              height: "40px",
              width: "40px",
            }}
            color="0BDA51"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.2rem",
            }}
          >
            <p style={{ marginRight: "0.5rem" }}>{title ? title : "Transaction Submitted"}</p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "000",
              }}
            >
              {description
                ? description
                : "Your Transaction was submitted succesfully. Please wait for the confirmation."}
            </p>
           {hash && <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "0.5rem",
              paddingTop: "0.25rem",
              textDecoration: "underline",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.85rem",
              }}
            >
              View on Etherscan
            </span>
            <RxArrowTopRight />
          </a>} 
          </div>
        </div>
      ),
    });
  };
  
  