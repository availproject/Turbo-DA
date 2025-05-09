import Footer from "@/components/footer";
import Header from "@/components/header";
import { ToastProvider } from "@/components/toast/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { template } from "@/lib/utils";
import { OverviewProvider } from "@/providers/OverviewProvider";
import AuthenticationService from "@/services/authentication";
import { ClerkProvider } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TurboDA | Dashboard",
  description: "Dashboard to manage your TurboDA account",
  icons: {
    icon: "/avail-icon.svg",
    shortcut: "/avail-icon.svg",
    apple: "/avail-icon.svg",
  },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const authDetails = await auth()
    .then((res) => ({ token: res.getToken({ template }) }))
    .catch((error) => ({ token: undefined }));

  const user = await currentUser()
    .then((res) => ({ fullName: res?.fullName }))
    .catch((error) => ({ fullName: undefined }));

  const token = await authDetails.token;

  let getUserDetails = await AuthenticationService.fetchUser({
    token: token!,
  })
    .then((response) => {
      return response;
    })
    .catch((error) => {
      console.log("error", error);
      return {};
    });

  if (!!getUserDetails) {
    const registerUser = await AuthenticationService.registerUser({
      token: token!,
      name: user?.fullName!,
    })
      .then((response) => response)
      .catch((error) => {});

    if (!registerUser) {
      getUserDetails = await AuthenticationService.fetchUser({
        token: token!,
      })
        .then((response) => response)
        .catch((error) => {});
    }
  }

  return (
    <ClerkProvider>
      <ToastProvider>
        <TooltipProvider>
          <html lang="en" className={inter.className}>
            <body>
              <Providers token={token!}>
                <Header />
                <OverviewProvider
                  creditBalance={+getUserDetails?.data?.credit_balance}
                >
                  {children}
                </OverviewProvider>
                <Footer />
              </Providers>
            </body>
          </html>
        </TooltipProvider>
      </ToastProvider>
    </ClerkProvider>
  );
}
