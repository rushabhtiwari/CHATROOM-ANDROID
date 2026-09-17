import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Every page depends on the signed-in person, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central",
  description: "Your company apps in one place",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
