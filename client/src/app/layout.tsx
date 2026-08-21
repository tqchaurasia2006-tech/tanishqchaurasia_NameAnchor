import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProvider } from "@/hooks/useWallet";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NameAnchor - Stellar Domain Names",
  description:
    "Register, manage, and resolve domain names on the Stellar network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
