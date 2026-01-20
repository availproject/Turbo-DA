"use client";

import PublicKeysCard from "@/module/public-keys";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";

const SettingsPage = () => {
  return (
    <div className="min-h-screen bg-bg-primary relative pt-6">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-blue/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-border-blue/5 blur-3xl" />
        <div className="bg-[url('/apps-background-noise.png')] bg-repeat absolute w-full h-full opacity-20" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-light-grey hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back to Dashboard</span>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue/30 to-blue/10 flex items-center justify-center border border-blue/20">
              <Settings size={24} className="text-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-light-grey opacity-70">
                Manage your account settings and preferences
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <PublicKeysCard />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
