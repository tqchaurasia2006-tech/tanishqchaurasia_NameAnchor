"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isAvailable, isConfigured } from "@/hooks/contract";

interface DomainFormProps {
  title: string;
  description: string;
  fields: {
    name: string;
    label: string;
    placeholder: string;
    type?: "text" | "address";
  }[];
  buttonText: string;
  buttonColor?: "primary" | "success" | "warning" | "danger";
  /** Field whose value should be live-checked against is_available(). */
  availabilityField?: string;
  /** Suffix shown inside text inputs (e.g. ".stellar"). */
  suffixField?: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

export default function DomainForm({
  title,
  description,
  fields,
  buttonText,
  buttonColor = "primary",
  availabilityField,
  suffixField,
  onSubmit,
}: DomainFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, ""])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  /** Last completed availability check, tagged with the name it was for. */
  const [availability, setAvailability] = useState<{
    for: string;
    free: boolean;
  } | null>(null);

  const rawAvailabilityValue =
    availabilityField ? (values[availabilityField] ?? "").trim() : "";
  const isValidName =
    rawAvailabilityValue.length > 0 && !/\s/.test(rawAvailabilityValue);
  const isChecking =
    isConfigured &&
    Boolean(availabilityField) &&
    isValidName &&
    availability?.for !== rawAvailabilityValue;
  /** Fresh check says the name is already registered — block submission. */
  const nameTaken =
    availability !== null &&
    !availability.free &&
    availability.for === rawAvailabilityValue;

  // Debounced availability check — state updates happen inside the async
  // callback, never synchronously in the effect body.
  useEffect(() => {
    if (!availabilityField || !isConfigured || !isValidName) return;
    const value = rawAvailabilityValue;
    const timer = setTimeout(async () => {
      try {
        const free = await isAvailable(value);
        setAvailability({ for: value, free });
      } catch {
        // RPC hiccup — leave stale result; derived UI falls back to "…"
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAvailabilityValue]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await onSubmit(values);
      setSuccess(true);
      setValues(Object.fromEntries(fields.map((f) => [f.name, ""])));
      setAvailability(null);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const colorClasses = {
    primary: "btn-gradient text-white",
    success:
      "bg-success text-white hover:brightness-110 active:scale-[0.98] shadow-[0_4px_14px_color-mix(in_srgb,var(--success)_30%,transparent)]",
    warning:
      "bg-warning text-black hover:brightness-105 active:scale-[0.98] shadow-[0_4px_14px_color-mix(in_srgb,var(--warning)_30%,transparent)]",
    danger:
      "bg-danger text-white hover:brightness-110 active:scale-[0.98] shadow-[0_4px_14px_color-mix(in_srgb,var(--danger)_30%,transparent)]",
  };

  return (
    <div className="card-glow rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => {
          const hasSuffix = suffixField === field.name;
          const isAvailField = field.name === availabilityField;
          const freshResult =
            isAvailField && !isChecking && availability?.for === rawAvailabilityValue
              ? availability.free
                ? ("free" as const)
                : ("taken" as const)
              : null;
          const showIndicator = isAvailField && isValidName;
          return (
          <div key={field.name}>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              {field.label}
            </label>
            <div className="relative">
              <input
                type="text"
                value={values[field.name] || ""}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
                placeholder={field.placeholder}
                className={`w-full rounded-lg border bg-background px-3.5 py-2.5 text-sm font-mono placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring ${
                  freshResult === "taken"
                    ? "border-danger/50"
                    : freshResult === "free"
                      ? "border-success/50"
                      : "border-border"
                } ${hasSuffix ? "pr-16" : ""} ${
                  showIndicator ? (hasSuffix ? "pr-28" : "pr-24") : ""
                }`}
                required
              />
              {hasSuffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-primary/70">
                  .stellar
                </span>
              )}
              {showIndicator && (
                <span
                  className={`absolute top-1/2 -translate-y-1/2 text-xs font-medium ${
                    hasSuffix ? "right-16" : "right-3"
                  } ${
                    freshResult === "free"
                      ? "text-success"
                      : freshResult === "taken"
                        ? "text-danger"
                        : "text-muted-foreground"
                  }`}
                >
                  {freshResult === "free"
                    ? "✓ available"
                    : freshResult === "taken"
                      ? "✗ taken"
                      : "…"}
                </span>
              )}
            </div>
          </div>
          );
        })}

        {error && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
            Transaction confirmed — domain updated on-chain.
          </div>
        )}

        <button
          type="submit"
          disabled={loading || nameTaken}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed ${colorClasses[buttonColor]} disabled:opacity-50`}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              Processing...
            </span>
          ) : (
            buttonText
          )}
        </button>
      </form>
    </div>
  );
}
