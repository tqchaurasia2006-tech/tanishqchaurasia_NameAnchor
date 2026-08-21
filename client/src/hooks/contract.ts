"use client";

/**
 * NameAnchor contract integration layer.
 *
 * All contract reads/writes go through here. When CONTRACT_ADDRESS is empty
 * the app runs in demo mode: reads throw and callers fall back to demo data.
 * After deploying, paste the contract ID below — everything goes live.
 */

import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  getAddress as freighterGetAddress,
  isConnected as freighterIsConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

// ── Config ────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS = ""; // ← paste deployed contract ID (C...) here
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** Testnet ledger close time, used to estimate expiry dates from ledgers. */
export const LEDGER_SECONDS = 5;

export const isConfigured =
  CONTRACT_ADDRESS.startsWith("C") && CONTRACT_ADDRESS.length === 56;

const server = new rpc.Server(RPC_URL);
const DUMMY_ACCOUNT_ID =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ── Types ─────────────────────────────────────────────────────────────────

/** Mirrors the Rust DomainRecord struct (snake_case fields from scValToNative). */
export interface DomainRecord {
  owner: string;
  target: string;
  expiry: number; // ledger sequence
  created_at: number; // unix seconds
  is_subdomain: boolean;
  parent: string;
}

// ── ScVal converters ──────────────────────────────────────────────────────

const toScValString = (v: string) => nativeToScVal(v, { type: "string" });
const toScValAddress = (v: string) => new Address(v).toScVal();

function parseRecord(raw: Record<string, unknown>): DomainRecord {
  return {
    owner: String(raw.owner),
    target: String(raw.target),
    expiry: Number(raw.expiry),
    created_at: Number(raw.created_at),
    is_subdomain: Boolean(raw.is_subdomain),
    parent: String(raw.parent),
  };
}

// ── Core read/write plumbing ──────────────────────────────────────────────

async function readContract(method: string, args: xdr.ScVal[]): Promise<unknown> {
  if (!isConfigured) {
    throw new Error("Contract not deployed yet — running in demo mode");
  }
  const account = new Account(DUMMY_ACCOUNT_ID, "0");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(CONTRACT_ADDRESS).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(cleanContractError(sim.error));
  }
  const retval = sim.result?.retval;
  if (!retval) throw new Error(`No result returned for ${method}()`);
  return scValToNative(retval);
}

async function writeContract(
  caller: string,
  method: string,
  args: xdr.ScVal[],
): Promise<void> {
  if (!isConfigured) {
    throw new Error(
      "Contract not deployed yet — deploy it and set CONTRACT_ADDRESS in hooks/contract.ts",
    );
  }
  const source = await server.getAccount(caller);
  const tx = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(CONTRACT_ADDRESS).call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    // Contract asserts (e.g. "domain not found") surface here, pre-signature.
    throw new Error(cleanContractError(sim.error));
  }
  const assembled = await rpc.assembleTransaction(tx, sim).build();

  const { signedTxXdr, error } = await signTransaction(assembled.toXdr(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  if (error || !signedTxXdr) {
    throw new Error(error?.message ?? "Wallet rejected the transaction");
  }

  const signed = TransactionBuilder.fromXdr(signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error("Transaction was rejected by the network — try again");
  }

  // Poll until the transaction is included in a ledger.
  let status: string = sent.status;
  for (let i = 0; i < 30 && status !== "SUCCESS" && status !== "FAILED"; i++) {
    await sleep(2000);
    const detail = await server.getTransaction(sent.hash);
    status = detail.status;
  }
  if (status !== "SUCCESS") {
    throw new Error(
      `Transaction ${status.toLowerCase()} — network state may have changed, try again`,
    );
  }
}

/** Strips Soroban host error noise down to the contract's assert message. */
function cleanContractError(raw: string): string {
  const match = raw.match(/contract command failed[^"]*"([^"]+)"/i) ??
    raw.match(/Error\(Contract, #\d+\)[^"]*"([^"]+)"/i) ?? raw.match(/"([^"]{3,})"/);
  return match ? match[1] : raw.slice(0, 160);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Wallet helpers ────────────────────────────────────────────────────────

export async function walletIsConnected(): Promise<boolean> {
  try {
    const { isConnected } = await freighterIsConnected();
    return Boolean(isConnected);
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const { address, error } = await requestAccess();
  if (error || !address) {
    throw new Error(error?.message ?? "Freighter access denied");
  }
  return address;
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    const { address } = await freighterGetAddress();
    return address || null;
  } catch {
    return null;
  }
}

// ── Read methods ──────────────────────────────────────────────────────────

export async function resolveDomain(name: string): Promise<string> {
  const result = await readContract("resolve", [toScValString(name)]);
  return String(result);
}

export async function isAvailable(name: string): Promise<boolean> {
  const result = await readContract("is_available", [toScValString(name)]);
  return Boolean(result);
}

export async function getDomain(name: string): Promise<DomainRecord> {
  const result = (await readContract("get_domain", [
    toScValString(name),
  ])) as Record<string, unknown>;
  return parseRecord(result);
}

export async function listDomains(owner: string): Promise<string[]> {
  const result = (await readContract("list_domains", [
    toScValAddress(owner),
  ])) as unknown[];
  return (result ?? []).map(String);
}

/** Latest testnet ledger info — used to estimate time-to-expiry. */
export interface LedgerInfo {
  sequence: number;
  closeTime: number; // unix seconds
}

export async function getLatestLedger(): Promise<LedgerInfo> {
  const latest = await server.getLatestLedger();
  return {
    sequence: Number(latest.sequence),
    closeTime: Number(latest.closeTime ?? 0),
  };
}

// ── Write methods (require Freighter signature) ───────────────────────────

export async function registerDomain(
  caller: string,
  name: string,
  target: string,
): Promise<void> {
  await writeContract(caller, "register", [
    toScValAddress(caller),
    toScValString(name),
    toScValAddress(target),
  ]);
}

export async function subdomainRegister(
  caller: string,
  parentName: string,
  fullName: string,
  target: string,
): Promise<void> {
  await writeContract(caller, "subdomain_register", [
    toScValAddress(caller),
    toScValString(parentName),
    toScValString(fullName),
    toScValAddress(target),
  ]);
}

export async function transferDomain(
  caller: string,
  name: string,
  newOwner: string,
): Promise<void> {
  await writeContract(caller, "transfer", [
    toScValAddress(caller),
    toScValString(name),
    toScValAddress(newOwner),
  ]);
}

export async function renewDomain(
  caller: string,
  name: string,
): Promise<void> {
  await writeContract(caller, "renew", [
    toScValAddress(caller),
    toScValString(name),
  ]);
}
