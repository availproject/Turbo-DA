import Footer from "@/components/footer";
import Header from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { template } from "@/lib/utils";
import { OverviewProvider } from "@/providers/OverviewProvider";
import AppService from "@/services/app";
import AuthenticationService from "@/services/authentication";
import { ClerkProvider } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { dark } from "@clerk/themes";
import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { ToastContainer } from "react-toastify";
import { ppmori } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "TurboDA | Dashboard",
  description: "Dashboard to manage your TurboDA account",
  icons: {
    icon: "/avail-icon.ico",
    shortcut: "/avail-icon.ico",
    apple: "/avail-icon.ico",
  },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const authDetails = await auth()
    .then((res) => ({ token: res.getToken({ template }) }))
    .catch((error) => ({ token: undefined }));

  const user = await currentUser()
    .then((res) => ({ fullName: res?.fullName }))
    .catch((error) => ({ fullName: undefined }));

  const token = await authDetails?.token;

  let getUserDetails = await AuthenticationService.fetchUser({
    token: token!,
  })
    .then((response) => response)
    .catch((error) => undefined);

  if (!getUserDetails) {
    const registerUser = await AuthenticationService.registerUser({
      token: token!,
      name: user?.fullName!,
    })
      .then((response) => response)
      .catch((error) => undefined);

    if (registerUser) {
      await AppService.createApp({
        token: token!,
        appId: 1,
        appName: `${user?.fullName ?? "Your First"}'s App`,
        avatar: "avatar_1",
      })
        .then((response) => response)
        .catch((error) => {});

      getUserDetails = await AuthenticationService.fetchUser({
        token: token!,
      })
        .then((response) => response)
        .catch((error) => undefined);
    }
  }

  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
      }}
    >
      <TooltipProvider>
        <html lang="en" className={`${ppmori.className} antialiased av-scroll`}>
          <body className="bg-linear-[89deg] from-darker-blue from-[22.12%] to-dark-blue to-[99.08%]">
            <Providers token={token!}>
              <Header />
              <OverviewProvider
                creditBalance={getUserDetails?.data?.credit_balance ?? 0}
              >
                {children}
              </OverviewProvider>
              <Footer />
              <ToastContainer
                className={"backdrop-blur-lg"}
                style={{ top: "80px" }}
              />
            </Providers>
          </body>
        </html>
      </TooltipProvider>
    </ClerkProvider>
  );
}
