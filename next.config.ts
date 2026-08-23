import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Serwist injects a webpack plugin; Turbopack builds would ignore it.
  // Run production builds with `next build --webpack` (see package.json).
  // Hide the dev-only route/build indicator (bottom-left) — it re-renders
  // on every navigation and can flash a compiling state.
  devIndicators: false,
};

// The Serwist webpack plugin hangs Next 16's webpack dev server even when
// `disable` is set, so only wrap for production (where the SW is generated).
export default process.env.NODE_ENV === "production"
  ? withSerwist(nextConfig)
  : nextConfig;
