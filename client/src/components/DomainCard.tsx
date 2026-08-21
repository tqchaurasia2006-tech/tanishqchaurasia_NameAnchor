"use client";

import { useState } from "react";
import { LEDGER_SECONDS } from "@/hooks/contract";

export interface DomainCardData {
  name: string;
  owner: string;
  target: string;
  /** Ledger sequence at which the registration expires (from contract). */
  expiryLedger: number | null;
  /** Unix seconds when the domain was registered (from contract). */
  createdAt: number | null;
  isSubdomain: boolean;
  parent: string;
}

interface DomainCardProps {
  domain: DomainCardData;
  /** Latest observed ledger sequence on the network, for expiry estimation. */
  currentLedger?: number | null;
  /** Unix seconds when that ledger closed, so estimates stay render-pure. */
  latestCloseTime?: number | null;
}

export default function DomainCard({
  domain,
  currentLedger,
  latestCloseTime,
}: DomainCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const expired =
    domain.expiryLedger !== null &&
    currentLedger !== undefined &&
    currentLedger !== null &&
    domain.expiryLedger <= currentLedger;

  const expiryLabel = (() => {
    if (domain.expiryLedger === null) return "—";
    if (currentLedger && latestCloseTime && !expired) {
      const secondsLeft = (domain.expiryLedger - currentLedger) * LEDGER_SECONDS;
      const days = Math.floor(secondsLeft / 86400);
      const date = new Date((latestCloseTime + secondsLeft) * 1000);
      const month = date.toLocaleString("en-US", { month: "short" });
      return `${month} ${date.getFullYear()} · ~${days}d left`;
    }
    return `Ledger #${domain.expiryLedger.toLocaleString()}`;
  })();

  const createdLabel =
    domain.createdAt !== null
      ? new Date(domain.createdAt * 1000).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      : "—";

  const copy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-mono text-base font-semibold">
              {domain.name}
            </h4>
            {domain.isSubdomain && (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-secondary-foreground">
                subdomain
              </span>
            )}
          </div>
          {domain.parent && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Parent: <span className="font-mono">{domain.parent}</span>
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            expired
              ? "bg-danger/10 text-danger"
              : "bg-success/10 text-success"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <InfoRow
          label="Owner"
          value={domain.owner}
          copied={copiedField === "owner"}
          onCopy={() => copy("owner", domain.owner)}
        />
        <InfoRow
          label="Target"
          value={domain.target}
          copied={copiedField === "target"}
          onCopy={() => copy("target", domain.target)}
        />
        <InfoRow label="Expires" value={expiryLabel} />
        <InfoRow label="Registered" value={createdLabel} />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {onCopy ? (
        <button
          onClick={onCopy}
          title={value}
          className="group max-w-[200px] truncate font-mono text-foreground/80 transition-colors hover:text-primary"
        >
          {copied ? "Copied!" : value}
        </button>
      ) : (
        <span className="max-w-[200px] truncate font-mono text-foreground/80" title={value}>
          {value}
        </span>
      )}
    </div>
  );
}
