import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation } from "@vercel/functions";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const isBlockRoute = createRouteMatcher(["/block(.*)"]);

export const deniedCountries = [
  "CU", // Cuba
  "KP", // North Korea
  "IR", // Iran
  "SY", // Syria
  "SD", // Sudan
  "SS", // South Sudan
  // Regions
  "UA-43", // Crimea (using ISO 3166-2 code)
  "UA-14", // Donetsk (using ISO 3166-2 code)
  "UA-09", // Luhansk (using ISO 3166-2 code)
];

export default clerkMiddleware(async (auth, req) => {
  if (isBlockRoute(req)) {
    return;
  }

  const { country } = geolocation(req);

  if (country && deniedCountries.includes(country)) {
    return NextResponse.redirect(new URL("/block", req.url));
  }

  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
