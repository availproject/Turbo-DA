import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStore {
  country: string | null;
  countrySelected: boolean;
  setCountry: (country: string) => void;
  markCountrySelected: () => void;
}
export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      country: null,
      countrySelected: false,
      setCountry: (country) => set({ country }),
      markCountrySelected: () => set({ countrySelected: true }),
    }),
    {
      name: "user-storage",
    },
  ),
);
