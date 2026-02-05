"use client";

import AvatarWrapper from "@/components/lottie-comp/avatar-container";
import { Text } from "@/components/text";
import { avatarList } from "@/lib/constant";
import { baseImageUrl } from "@/lib/utils";
import { AppDetails } from "@/services/app/response";
import { Key, Box } from "lucide-react";
import Image from "next/image";
import { memo } from "react";
import EnigmaModal from "@/module/user-apps/enigma-modal";
import { useDialog } from "@/components/dialog/provider";

const MpcAppItem = ({ app }: { app: AppDetails }) => {
  const { open, setOpen } = useDialog();
  const modalId = "enigma-" + app.id;
  const displayName = app.app_name || `App ${app.app_id}`;

  const renderLogo = () => {
    if (app?.app_logo?.includes(".")) {
      return (
        <Image
          className="w-14 h-14 rounded-lg object-cover"
          alt={displayName}
          src={baseImageUrl(app.app_logo)}
          width={56}
          height={56}
        />
      );
    }

    if (avatarList?.[app?.app_logo]?.path) {
      return (
        <AvatarWrapper
          path={avatarList[app.app_logo].path}
          width={56}
          height={56}
        />
      );
    }

    return <Box size={24} className="text-light-grey opacity-50" />;
  };

  return (
    <>
      <div
        className="w-full p-5 rounded-xl border border-solid border-border-blue/40 bg-gradient-to-br from-transparent to-border-blue/5 relative cursor-pointer hover:border-blue/50 hover:from-blue/5 hover:to-blue/10 hover:shadow-lg transition-all duration-300 group"
        onClick={() => setOpen(modalId)}
      >
        <div className="flex w-full gap-4 items-center">
          <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-border-blue/20 to-transparent border border-border-blue/30">
            {renderLogo()}
          </div>

          <div className="flex flex-col justify-center flex-1 min-w-0">
            <Text weight="semibold" size="lg" className="text-white group-hover:text-blue/90 transition-colors truncate">
              {displayName}
            </Text>
            <div className="flex items-center gap-2 mt-1">
              <Text variant="light-grey" weight="medium" size="sm" className="opacity-70">
                App ID:
              </Text>
              <Text size="sm" weight="bold" className="font-mono text-light-grey opacity-90 truncate">
                {app.app_id}
              </Text>
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-border-blue/40 to-border-grey/40 group-hover:from-blue/20 group-hover:to-blue/30 border border-border-blue/30 group-hover:border-blue/40 transition-all duration-300 shadow-sm">
            <Key className="text-light-grey group-hover:text-blue drop-shadow-sm" size={20} />
          </div>
        </div>
      </div>

      {open === modalId && (
        <EnigmaModal
          id={modalId}
          appData={app}
          skipAuth={true}
        />
      )}
    </>
  );
};

export default memo(MpcAppItem);
