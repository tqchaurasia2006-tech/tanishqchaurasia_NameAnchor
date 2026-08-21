"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";

export default function Header() {
  const { address, connecting, installed, error, connect, disconnect } =
    useWallet();
  const [copied, setCopied] = useState(false);

  const truncate = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="btn-gradient flex h-8 w-8 items-center justify-center rounded-lg">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.667.675-3.2 1.757-4.392"
              />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Name<span className="text-gradient">Anchor</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "#register", label: "Register" },
            { href: "#lookup", label: "Lookup" },
            { href: "#manage", label: "Manage" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {!installed && (
            <a
              href="https://www.freighter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning sm:block"
            >
              Install Freighter
            </a>
          )}
          {error && (
            <span
              className="hidden max-w-[220px] truncate text-xs text-danger lg:block"
              title={error}
            >
              {error}
            </span>
          )}
          {address ? (
            <>
              <button
                onClick={copyAddress}
                title="Copy address"
                className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 transition-colors hover:bg-success/20"
              >
                <span className="dot-success h-1.5 w-1.5 animate-pulse-dot rounded-full" />
                <span className="font-mono text-xs font-medium text-success">
                  {copied ? "Copied!" : truncate(address)}
                </span>
              </button>
              <button
                onClick={disconnect}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="btn-gradient rounded-lg px-4 py-2 text-sm font-medium text-white"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
