"use client";
import React, { createContext, useContext, useState } from "react";

interface DialogContextType {
  open: string;
  setOpen: React.Dispatch<React.SetStateAction<string>>;
}

export const DialogContext = createContext<DialogContextType | undefined>(
  undefined
);

interface DialogProviderProps {
  children?: React.ReactNode;
}

export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
  const [open, setOpen] = useState<string>("");

  return (
    <DialogContext.Provider
      value={{
        open,
        setOpen,
      }}
    >
      {children}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);

  if (context === undefined) {
    throw new Error("useDialog must be used within a DialogProvider");
  }

  return context;
};
