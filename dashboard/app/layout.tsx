import type { Metadata } from "next";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from "./providers";
import Header from "@/components/header";
import { Toaster } from "@/components/ui/toaster";
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export const metadata: Metadata = {
  title: "TurboDA | Dashboard",
  description: "Dashboard to manage your TurboDA account",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
    appearance={{
      baseTheme: dark,
    }}>
    <html lang="en">
      <body>
        <Providers>
          <Toaster/>
          <Header/>
          {children}</Providers>
      </body>
    </html>
    </ClerkProvider>
  );
}
