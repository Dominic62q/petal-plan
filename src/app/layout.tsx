import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppTabBar } from "@/components/app-tab-bar";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Petal & Plan",
    template: "%s · Petal & Plan",
  },
  description:
    "Event planning for professional planners and hosts — events, schedules, tasks and goals in one place.",
  applicationName: "Petal & Plan",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Petal & Plan",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d6336c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background outline-none transition-transform focus:translate-y-0 focus-visible:ring-4 focus-visible:ring-ring/40"
        >
          Skip to content
        </a>
        <Providers>
          {/* Each screen's sheet pads for the docked tab bar itself, so it can run edge to edge. */}
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none md:pl-72">
            {children}
          </main>
          <AppTabBar />
        </Providers>
      </body>
    </html>
  );
}
