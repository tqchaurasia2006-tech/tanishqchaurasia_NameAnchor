"use client";

import { useState, type FormEvent } from "react";
import {
  getDomain,
  isAvailable,
  isConfigured,
  resolveDomain,
  type DomainRecord,
} from "@/hooks/contract";

type LookupState =
  | { kind: "idle" }
  | { kind: "available" }
  | { kind: "resolved"; target: string; record: DomainRecord | null }
  | { kind: "error"; message: string };

export default function LookupSection() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    const name = domain.trim();
    if (!name) return;
    setLoading(true);
    setCopied(false);
    setState({ kind: "idle" });

    try {
      if (!isConfigured) {
        // Demo mode — simulate a resolution so the UI stays explorable.
        await new Promise((r) => setTimeout(r, 400));
        setState({
          kind: "resolved",
          target: "GCTY7EXAMPLE...ADDRESS (demo)",
          record: null,
        });
        return;
      }

      const available = await isAvailable(name);
      if (available) {
        setState({ kind: "available" });
        return;
      }

      let record: DomainRecord | null = null;
      try {
        record = await getDomain(name);
      } catch {
        // registered but expired — resolve() will throw below
      }
      try {
        const target = await resolveDomain(name);
        setState({ kind: "resolved", target, record });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Resolve failed";
        setState({ kind: "error", message: /expired/i.test(msg) ? `"${name}" has expired` : msg });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resolve domain";
      setState({ kind: "error", message: /not found/i.test(msg) ? `"${name}" is not registered` : msg });
    } finally {
      setLoading(false);
    }
  };

  const copyTarget = async () => {
    if (state.kind !== "resolved") return;
    try {
      await navigator.clipboard.writeText(state.target);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Resolve Domain</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Look up the address a domain name points to
      </p>

      <form onSubmit={handleLookup} className="mt-4 flex gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. alice"
            className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-16 text-sm font-mono placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary/70">
            .stellar
          </span>
        </div>
        <button
          type="submit"
          disabled={loading || !domain.trim()}
          className="btn-gradient shrink-0 rounded-lg px-5 py-2.5 text-sm font-medium text-white"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            "Resolve"
          )}
        </button>
      </form>

      {/* Available */}
      {state.kind === "available" && (
        <div className="mt-4 rounded-lg border border-warning/25 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Available for registration
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Nobody owns <span className="font-mono">{domain.trim()}</span> yet — claim it above.
          </p>
        </div>
      )}

      {/* Resolved */}
      {state.kind === "resolved" && (
        <div className="mt-4 rounded-lg border border-success/20 bg-success/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-success">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Resolved
            </div>
            <button
              onClick={copyTarget}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 break-all font-mono text-sm text-foreground/80">
            {state.target}
          </p>
          {state.record && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs">
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="truncate text-right font-mono" title={state.record.owner}>
                {state.record.owner.slice(0, 8)}…{state.record.owner.slice(-6)}
              </dd>
              <dt className="text-muted-foreground">Expires at ledger</dt>
              <dd className="text-right font-mono">{state.record.expiry.toLocaleString()}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-right">
                {state.record.is_subdomain
                  ? `Subdomain of ${state.record.parent}`
                  : "Top-level domain"}
              </dd>
            </dl>
          )}
        </div>
      )}

      {/* Error */}
      {state.kind === "error" && (
        <div className="mt-4 rounded-lg border border-danger/20 bg-danger/5 p-4">
          <p className="text-sm text-danger">{state.message}</p>
        </div>
      )}
    </div>
  );
}
