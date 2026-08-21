# Project Lessons — NameAnchor (Stellar Domain Service)

## Status
- Contract (`contract/contracts/contract/src/lib.rs`): NameAnchor domain registry — register, subdomain_register, transfer, renew, resolve, is_available, get_domain, list_domains. Tests pass. NOT yet deployed.
- Frontend (`client/`): fully wired to contract ABI via manual ScVal wrappers in `src/hooks/contract.ts`. Runs in demo mode until `CONTRACT_ADDRESS` is set in that file.
- Lint + build + prod smoke test all pass.

## Key Discoveries
- **@stellar/stellar-sdk v17 API differences** (differs from older docs):
  - `ScVal` type lives at `xdr.ScVal`, NOT a top-level export
  - Simulation returns discriminated union → use `rpc.Api.isSimulationError(sim)` (note: `rpc.Api.`, not `rpc.api.`)
  - Read result: `sim.result?.retval` (single object, not `sim.results[0].xdr`)
  - Methods are camelCase: `tx.toXdr()`, `TransactionBuilder.fromXdr(...)` (not toXDR/fromXDR)
  - `SendTransactionResponse.status`: "PENDING" | "DUPLICATE" | "TRY_AGAIN_LATER" | "ERROR" (no NOT_FOUND); poll via `server.getTransaction(hash)` whose status IS SUCCESS/FAILED/NOT_FOUND
  - `server.getLatestLedger()` → `{ sequence, closeTime, ... }` (closeTime is a string)
  - `scValToNative`: u64→bigint (coerce with Number()), u32→number, Address→string
- **freighter-api v6**: `requestAccess()/getAddress() → { address, error? }`; `signTransaction(xdr, {networkPassphrase}) → { signedTxXdr, error? }`
- **Next.js 16.2.6 strict lint rules**:
  - `react-hooks/set-state-in-effect`: NO synchronous setState in effect bodies — put updates after awaits or derive them
  - `react-hooks/purity`: no `Date.now()` during render — pass timestamps as props
  - Must use `next/link` for internal nav
- Scaffold's `favicon.ico` was truncated/corrupt → regenerated valid 16x16 ICO programmatically.

## Next Steps
1. User deploys: `cd ~/project/contract && stellar contract build && stellar keys generate dev --network testnet --fund && stellar contract deploy --wasm target/wasm32v1-none/release/contract.wasm --source-account dev --network testnet`
2. Paste the C... address into `client/src/hooks/contract.ts` CONTRACT_ADDRESS → app goes live automatically (stats bar flips from "Demo mode" to "Live").
3. Optionally replace manual ScVal wrappers with generated bindings (`stellar contract bindings typescript`) once deployed.
