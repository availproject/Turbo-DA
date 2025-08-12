import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkWrapper } from "@/components/clerk-wrapper";
import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import { ClientProviders } from "./client-providers";

export const metadata: Metadata = {
  title: "TurboDA | Dashboard",
  description: "Dashboard to manage your TurboDA account",
  icons: {
    icon: "/avail-icon.ico",
    shortcut: "/avail-icon.ico",
    apple: "/avail-icon.ico",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <html lang="en" className={`antialiased av-scroll`}>
        <body className="bg-linear-[89deg] from-darker-blue from-[22.12%] to-dark-blue to-[99.08%]">
          <ClerkWrapper>
            <ClientProviders>{children}</ClientProviders>
          </ClerkWrapper>
        </body>
      </html>
    </TooltipProvider>
  );
}
