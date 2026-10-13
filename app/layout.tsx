import type { Metadata } from "next";
import { Mukta, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const heading = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "700", "800", "900"],
  variable: "--font-heading",
  display: "swap",
});
const body = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "News Pages Maker",
  description: "AI-assisted newspaper page layout for Hindi dailies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={`${heading.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
