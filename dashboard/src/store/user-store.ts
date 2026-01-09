import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStore {
  country: string | null;
  countrySelected: boolean;
  userId: string | null;
  setCountry: (country: string) => void;
  markCountrySelected: () => void;
  setUserId: (userId: string) => void;
  resetCountrySelection: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      country: null,
      countrySelected: false,
      userId: null,
      setCountry: (country: string) => set({ country }),
      markCountrySelected: () => set(() => ({ countrySelected: true })),
      setUserId: (userId: string) => set({ userId }),
      resetCountrySelection: () =>
        set(() => ({ country: null, countrySelected: false })),
    }),
    {
      name: "user-storage",
    },
  ),
);
