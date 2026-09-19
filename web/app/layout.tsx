import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Scholarly",
  description:
    "Study together with friends over video and see how your study time adds up.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
