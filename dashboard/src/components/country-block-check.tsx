"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useUserStore } from "@/store/user-store";
import { isDeniedCountryByName } from "@/utils/countries";

export function CountryBlockCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, user } = useUser();
  const { country, countrySelected, userId } = useUserStore();

  useEffect(() => {
    if (pathname === "/block") {
      return;
    }
    if (!isLoaded || !countrySelected || !country) {
      return;
    }

    if (user && userId && userId === user.id) {
      if (isDeniedCountryByName(country)) {
        router.push("/block");
      }
    }
  }, [isLoaded, user, country, countrySelected, userId, pathname, router]);

  return null;
}
