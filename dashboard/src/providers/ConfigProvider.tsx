"use client";
import { template } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import React, { createContext, useContext, useEffect, useState } from "react";

interface ConfigContextType {
  token?: string;
  fetchToken: () => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(
  undefined
);

interface ConfigProviderProps {
  children?: React.ReactNode;
  accessToken?: string;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  accessToken,
}) => {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string>(accessToken ?? "");

  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    await getToken({ template: template })
      .then((res) => {
        if (res) setToken(res);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return (
    <ConfigContext.Provider
      value={{
        token,
        fetchToken,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);

  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }

  return context;
};
