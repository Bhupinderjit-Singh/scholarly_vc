import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Inter is the single variable font of the design system (tech.md). It is
// exposed as `--font-inter`, which `--font-sans` in globals.css consumes.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Scholarly",
    template: "%s · Scholarly",
  },
  description:
    "Study together with friends over video and see how your study time adds up.",
};

// Single light theme: tell the browser so form controls and scrollbars never
// switch to dark rendering on OS-dark devices.
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#FBFAF7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
