import localFont from "next/font/local";

export const ppmori = localFont({
  src: [
    {
      path: "../../public/ppmori/PPMori-Extralight.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/ppmori/PPMori-ExtralightItalic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/ppmori/PPMori-Regular.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/ppmori/PPMori-RegularItalic.otf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/ppmori/PPMori-SemiBold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/ppmori/PPMori-SemiBoldItalic.otf",
      weight: "600",
      style: "italic",
    },
  ],
});
