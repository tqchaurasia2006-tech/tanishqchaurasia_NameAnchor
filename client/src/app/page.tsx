"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import DomainForm from "@/components/DomainForm";
import DomainCard, { type DomainCardData } from "@/components/DomainCard";
import LookupSection from "@/components/LookupSection";
import { useWallet } from "@/hooks/useWallet";
import {
  getDomain,
  getLatestLedger,
  isConfigured,
  listDomains,
  registerDomain,
  renewDomain,
  subdomainRegister,
  transferDomain,
  type DomainRecord,
  type LedgerInfo,
} from "@/hooks/contract";

interface OwnedEntry {
  name: string;
  record: DomainRecord;
}

type OwnedState =
  | { kind: "idle" } // not fetched yet — renders as skeleton
  | { kind: "loaded"; entries: OwnedEntry[] }
  | { kind: "error"; message: string };

const DEMO_DOMAINS: DomainCardData[] = [
  {
    name: "alice.stellar",
    owner: "GCTY7X...EXAMPLE",
    target: "GABC3D...RESOLVE",
    expiryLedger: null,
    createdAt: null,
    isSubdomain: false,
    parent: "",
  },
  {
    name: "pay.alice.stellar",
    owner: "GCTY7X...EXAMPLE",
    target: "GABC3D...RESOLVE",
    expiryLedger: null,
    createdAt: null,
    isSubdomain: true,
    parent: "alice.stellar",
  },
];

export default function Home() {
  const wallet = useWallet();
  const caller = wallet.address;

  const [currentLedger, setCurrentLedger] = useState<LedgerInfo | null>(null);
  const [ownedState, setOwnedState] = useState<OwnedState>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Track latest ledger so expiry dates can be estimated.
  useEffect(() => {
    if (!isConfigured) return;
    let cancelled = false;
    getLatestLedger()
      .then((info) => {
        if (!cancelled) setCurrentLedger(info);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load domains owned by the connected wallet. All state updates happen
  // after awaits; render branches on `liveMode` before touching this state.
  useEffect(() => {
    if (!caller || !isConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const names = await listDomains(caller);
        const entries = await Promise.all(
          names.map(async (name) => ({ name, record: await getDomain(name) })),
        );
        if (!cancelled) setOwnedState({ kind: "loaded", entries });
      } catch (e) {
        if (!cancelled) {
          setOwnedState({
            kind: "error",
            message:
              e instanceof Error ? e.message : "Failed to load your domains",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caller, refreshKey]);

  // ── Validation helpers ────────────────────────────────────────────────

  const requireWallet = () => {
    if (!caller) throw new Error("Connect your Freighter wallet first");
    return caller;
  };

  const validAddress = (value: string, label: string) => {
    const v = value.trim();
    if (!/^[GC][A-Z2-7]{55}$/.test(v)) {
      throw new Error(`${label} must be a valid Stellar address (G… or C…, 56 characters)`);
    }
    return v;
  };

  // ── Write handlers ────────────────────────────────────────────────────

  const handleRegister = async (v: Record<string, string>) => {
    const who = requireWallet();
    await registerDomain(who, v.name.trim(), validAddress(v.target, "Target address"));
    bumpRefresh();
  };

  const handleSubdomain = async (v: Record<string, string>) => {
    const who = requireWallet();
    const parent = v.parent.trim();
    const sub = v.subdomain.trim();
    if (!parent || !sub) throw new Error("Parent domain and subdomain name are required");
    await subdomainRegister(
      who,
      parent,
      `${sub}.${parent}`,
      validAddress(v.target, "Target address"),
    );
    bumpRefresh();
  };

  const handleTransfer = async (v: Record<string, string>) => {
    const who = requireWallet();
    await transferDomain(who, v.domain.trim(), validAddress(v.newOwner, "New owner address"));
    bumpRefresh();
  };

  const handleRenew = async (v: Record<string, string>) => {
    const who = requireWallet();
    await renewDomain(who, v.domain.trim());
    bumpRefresh();
  };

  const liveMode = isConfigured && Boolean(caller);
  const cardDataFromRecord = (entry: OwnedEntry): DomainCardData => ({
    name: entry.name,
    owner: entry.record.owner,
    target: entry.record.target,
    expiryLedger: entry.record.expiry,
    createdAt: entry.record.created_at,
    isSubdomain: entry.record.is_subdomain,
    parent: entry.record.parent,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="aurora" />
        <div className="grid-texture absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
          <div className="btn-gradient mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.667.675-3.2 1.757-4.392"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Own your name on{" "}
            <span className="text-gradient">Stellar</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Register human-readable domain names that resolve to Stellar
            addresses. Secure, decentralized, and yours to keep.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#register"
              className="btn-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Register a Domain
            </a>
            <a
              href="#lookup"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              Look Up a Name
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-6 py-6 sm:justify-between">
          <StatItem dot="primary" label="Network" value="Stellar Testnet" />
          <StatItem
            dot={isConfigured ? "success" : "warning"}
            label="Contract"
            value={isConfigured ? "Live" : "Demo mode"}
          />
          <StatItem
            dot={caller ? "success" : "muted"}
            label="Wallet"
            value={caller ? "Connected" : "Not connected"}
          />
          <StatItem dot="primary" label="Built with" value="Soroban" />
        </div>
      </section>

      {/* Main content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
        {/* Register Section */}
        <section id="register" className="mb-16 scroll-mt-20">
          <SectionHeader
            title="Register a Domain"
            description="Claim a unique name on the Stellar network. Your domain resolves to your chosen address for one year."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <DomainForm
              title="Register New Domain"
              description="Reserve a new top-level domain name"
              fields={[
                { name: "name", label: "Domain Name", placeholder: "myname" },
                {
                  name: "target",
                  label: "Target Address",
                  placeholder: "G… (Stellar public key)",
                  type: "address",
                },
              ]}
              buttonText="Register Domain"
              buttonColor="primary"
              availabilityField="name"
              suffixField="name"
              onSubmit={handleRegister}
            />
            <DomainForm
              title="Create Subdomain"
              description="Create a subdomain under a domain you own"
              fields={[
                { name: "parent", label: "Parent Domain", placeholder: "myname" },
                { name: "subdomain", label: "Subdomain Name", placeholder: "pay" },
                {
                  name: "target",
                  label: "Target Address",
                  placeholder: "G… (Stellar public key)",
                  type: "address",
                },
              ]}
              buttonText="Create Subdomain"
              buttonColor="success"
              onSubmit={handleSubdomain}
            />
          </div>
        </section>

        {/* Lookup Section */}
        <section id="lookup" className="mb-16 scroll-mt-20">
          <SectionHeader
            title="Resolve a Domain"
            description="Find the Stellar address a domain name points to."
          />
          <div className="mt-6">
            <LookupSection />
          </div>
        </section>

        {/* Manage Section */}
        <section id="manage" className="mb-16 scroll-mt-20">
          <SectionHeader
            title="Manage Your Domains"
            description="Transfer, renew, or view details for domains you own."
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <DomainForm
              title="Transfer Domain"
              description="Transfer ownership to another Stellar address"
              fields={[
                { name: "domain", label: "Domain Name", placeholder: "myname" },
                {
                  name: "newOwner",
                  label: "New Owner Address",
                  placeholder: "G… (Stellar public key)",
                  type: "address",
                },
              ]}
              buttonText="Transfer Domain"
              buttonColor="warning"
              onSubmit={handleTransfer}
            />
            <DomainForm
              title="Renew Domain"
              description="Extend your domain registration for another year"
              fields={[
                { name: "domain", label: "Domain Name", placeholder: "myname" },
              ]}
              buttonText="Renew Domain"
              buttonColor="primary"
              onSubmit={handleRenew}
            />
          </div>

          {/* Your domains */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                {liveMode ? "Your Domains" : "Your Domains (Demo)"}
              </h4>
              {liveMode && (
                <button
                  onClick={bumpRefresh}
                  className="rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  ↻ Refresh
                </button>
              )}
            </div>

            {!isConfigured ? (
              <>
                <NoticeBanner tone="warning">
                  Demo mode — deploy the contract and paste its ID into{" "}
                  <code className="font-mono">hooks/contract.ts</code> to go live.
                </NoticeBanner>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {DEMO_DOMAINS.map((d) => (
                    <DomainCard key={d.name} domain={d} currentLedger={null} />
                  ))}
                </div>
              </>
            ) : !caller ? (
              <NoticeBanner tone="info">
                Connect your wallet to see the domains you own.
              </NoticeBanner>
            ) : ownedState.kind === "error" ? (
              <NoticeBanner tone="danger">{ownedState.message}</NoticeBanner>
            ) : ownedState.kind === "loaded" && ownedState.entries.length === 0 ? (
              <NoticeBanner tone="info">
                You don&apos;t own any domains yet — register one above.
              </NoticeBanner>
            ) : ownedState.kind === "loaded" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {ownedState.entries.map((entry) => (
                  <DomainCard
                    key={entry.name}
                    domain={cardDataFromRecord(entry)}
                    currentLedger={currentLedger?.sequence ?? null}
                    latestCloseTime={currentLedger?.closeTime ?? null}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse rounded-2xl border border-border bg-card"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>NameAnchor &mdash; Decentralized Domain Names on Stellar</p>
          <div className="flex gap-4">
            <a
              href="https://soroban.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Soroban Docs
            </a>
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Stellar
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)]" />
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

function StatItem({
  label,
  value,
  dot = "muted",
}: {
  label: string;
  value: string;
  dot?: "primary" | "success" | "warning" | "muted";
}) {
  const dotClass = {
    primary: "bg-primary",
    success: "dot-success",
    warning: "dot-warning",
    muted: "bg-muted-foreground/40",
  }[dot];
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function NoticeBanner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "info" | "warning" | "danger";
}) {
  const styles = {
    info: "border-primary/20 bg-primary/5 text-foreground/80",
    warning: "border-warning/25 bg-warning/5 text-warning",
    danger: "border-danger/20 bg-danger/5 text-danger",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
