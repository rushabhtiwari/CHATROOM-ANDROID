import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Geist, self-hosted: the same files every Kiran app loads (docs/design-language.md).
const sans = localFont({
  src: [
    { path: "./fonts/geist-latin.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: [{ path: "./fonts/geist-mono-latin.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-mono",
  display: "swap",
});

// Every page depends on the signed-in person, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Central",
  description: "Your company apps in one place",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
