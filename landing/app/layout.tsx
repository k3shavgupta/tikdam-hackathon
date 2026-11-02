import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tikdam.xyz"),
  title: "Tikdam | Check before you buy",
  description:
    "A source-linked preview for checking possible tax treatment before a work purchase. See assumptions, evidence to keep, and where the demo stops.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Tikdam | Check before you buy",
    description: "Can you claim it? Check first.",
    url: "https://tikdam.xyz",
    siteName: "Tikdam",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tikdam | Check before you buy",
    description: "Can you claim it? Check first.",
  },
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FFFBEB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
