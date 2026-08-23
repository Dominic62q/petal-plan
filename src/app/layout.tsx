import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppTabBar } from "@/components/app-tab-bar";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
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
  themeColor: "#b7004f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {/* pb accounts for the tab bar + iOS home-indicator safe area */}
          <main
            id="main-content"
            className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-64"
          >
            {children}
          </main>
          <AppTabBar />
        </Providers>
      </body>
    </html>
  );
}
