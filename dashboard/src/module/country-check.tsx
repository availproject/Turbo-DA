"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Button from "@/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryList } from "@/utils/countries";
import { useUserStore } from "@/store/user-store";
import { updateUserCountry } from "@/actions/country-update";

export function CountrySelectionModal() {
  const { user, isLoaded } = useUser();
  const { countrySelected, setCountry, markCountrySelected } = useUserStore();
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countries] = useState(() => getCountryList());

  useEffect(() => {
    if (isLoaded && user && !countrySelected) {
      const existingCountry = user.publicMetadata?.country as
        | string
        | undefined;

      if (existingCountry) {
        setCountry(existingCountry);
        markCountrySelected();
      } else {
        setOpen(true);
      }
    }
  }, [isLoaded, user, countrySelected, setCountry, markCountrySelected]);

  const handleSubmit = async () => {
    if (!selectedCountry || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const result = await updateUserCountry(selectedCountry);

      if (result.error) {
        throw new Error(result.error);
      }

      setCountry(selectedCountry);
      markCountrySelected();
      setOpen(false);
    } catch (error) {
      console.error("Error saving country:", error);
      alert("Failed to save country. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !countrySelected) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={true}>
      <DialogContent
        className="!fixed !left-[50%] !top-[50%] !-translate-x-1/2 !-translate-y-1/2 sm:max-w-[500px] w-[90vw] !border-none !p-0 !bg-transparent"
        onPointerDownOutside={(e) => {
          if (!countrySelected) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!countrySelected) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          if (!countrySelected) {
            e.preventDefault();
          }
        }}
      >
        <div className="w-full h-full rounded-2xl bg-linear-[139.26deg] from-border-grey from-[-0.73%] to-border-secondary to-[100.78%] p-px">
          <div className="shadow-primary bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] rounded-2xl overflow-hidden flex flex-col w-full relative p-6">
            <div className="bg-[url('/common-dialog-noise.png')] bg-repeat absolute inset-0 flex w-full h-full opacity-80 pointer-events-none" />
            <div className="relative z-10">
              <DialogHeader>
                <DialogTitle className="text-xl text-white">
                  Please Select Your Nationality
                </DialogTitle>
                <p className="text-sm text-gray-400 mt-1">
                  This will help us personalize your experience for the app,
                  this is just for the first time.
                </p>
              </DialogHeader>
              <div className="mt-4">
                <Command className="border-none shadow-primary rounded-xl pt-0 gap-0 flex-1 flex justify-center items-center flex-col gap-y-2.5 bg-linear-[90deg] from-bg-primary from-[0%] to-bg-secondary to-[100%] relative h-full pb-0 overflow-hidden">
                  <CommandInput
                    placeholder="Select Your Nationality..."
                    className="bg-transparent py-4 text-white placeholder:text-gray-500"
                  />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty className="text-gray-400 py-6">
                      No country found.
                    </CommandEmpty>
                    <CommandGroup>
                      {countries.map((country) => {
                        const isDenied = country.isDenied;

                        if (isDenied) {
                          return (
                            <Tooltip key={country.code}>
                              <TooltipTrigger asChild>
                                <div>
                                  <CommandItem
                                    value={country.name}
                                    disabled={true}
                                    className="opacity-50 cursor-not-allowed hover:bg-transparent data-[selected=true]:bg-transparent text-white"
                                  >
                                    <Check className="mr-2 h-4 w-4 opacity-0" />
                                    <span className="mr-2">{country.flag}</span>
                                    {country.name}
                                  </CommandItem>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="bg-black border border-white/10 text-white z-[9999]"
                              >
                                <p className="text-sm max-w-[200px]">
                                  We don't allow these nationals to use Turbo DA
                                  due to legal reasons
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return (
                          <CommandItem
                            key={country.code}
                            value={country.name}
                            onSelect={() => setSelectedCountry(country.name)}
                            className="cursor-pointer hover:bg-white/10 data-[selected=true]:bg-white/10 text-white"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedCountry === country.name
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="mr-2">{country.flag}</span>
                            {country.name}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  variant={"primary"}
                  disabled={!selectedCountry || isSubmitting}
                  className=""
                >
                  {isSubmitting ? "Saving..." : "Continue"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
