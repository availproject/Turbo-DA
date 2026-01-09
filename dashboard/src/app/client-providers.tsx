"use client";
import Footer from "@/components/footer";
import Header from "@/module/header";
import { OverviewProvider } from "@/providers/OverviewProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { UserProvider } from "@/providers/UserProvider";
import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";
import { Providers } from "./providers";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <AuthProvider>
      <UserProvider>
        <Providers>
          <Header />
          <OverviewProvider>
            {children}
            <ToastContainer
              className={"backdrop-blur-lg"}
              containerId={"toast-container"}
              style={{ top: "80px" }}
            />
            <ToastContainer
              containerId={"stacked-toast-container"}
              style={{ top: "80px", width: "100%", maxWidth: "530px" }}
              newestOnTop={true}
              stacked={true}
            />
          </OverviewProvider>
          <Footer />
        </Providers>
      </UserProvider>
    </AuthProvider>
  );
}
