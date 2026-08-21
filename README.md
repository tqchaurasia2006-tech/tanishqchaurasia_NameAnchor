# NameAnchor ⚓

Decentralized domain names on Stellar. Register human-readable names (e.g. `alice.stellar`), point them at any Stellar address, create subdomains, transfer them, and renew them — all enforced by a Soroban smart contract, with a Next.js frontend for wallet interaction.

## Architecture

```
~/project/
├── contract/                      # Soroban workspace (Rust)
│   └── contracts/contract/
│       ├── src/lib.rs             # NameAnchor contract
│       └── src/test.rs            # Contract tests
└── client/                        # Next.js 16 frontend (App Router)
    └── src/
        ├── app/                   # page.tsx, layout.tsx, globals.css
        ├── components/            # Header, DomainForm, DomainCard, LookupSection
        └── hooks/
            ├── contract.ts        # Contract integration layer (ScVal wrappers)
            └── useWallet.tsx      # Freighter wallet context
```

## Contract — `NameAnchor`

Storage is persistent per-domain; registrations last ~1 year in ledgers (`525_600`) and can be renewed.

| Method | Auth | Description |
|---|---|---|
| `register(caller, name, target) → DomainRecord` | ✅ | Claim a new top-level name |
| `subdomain_register(caller, parent_name, full_name, target) → DomainRecord` | ✅ | Create a subdomain under a domain you own |
| `transfer(caller, name, new_owner)` | ✅ | Hand a domain to another address |
| `renew(caller, name)` | ✅ | Extend expiry by another year |
| `resolve(name) → Address` | — | Look up the target of an active (non-expired) domain |
| `is_available(name) → bool` | — | Check whether a name is unregistered |
| `get_domain(name) → DomainRecord` | — | Full record for a name |
| `list_domains(owner) → Vec<String>` | — | All names owned by an address |

```rust
pub struct DomainRecord {
    pub owner: Address,
    pub target: Address,
    pub expiry: u32,       // ledger sequence
    pub created_at: u64,   // unix seconds
    pub is_subdomain: bool,
    pub parent: String,
}
```

### Build & test

```bash
cd contract
cargo test              # run the test suite
stellar contract build  # produces target/wasm32v1-none/release/contract.wasm
```

### Deploy (testnet)

```bash
stellar keys generate dev --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/contract.wasm \
  --source-account dev \
  --network testnet
```

Copy the resulting `C...` contract ID — you'll paste it into the frontend next.

## Frontend

Next.js 16 + React 19 + Tailwind v4, talking to testnet via `@stellar/stellar-sdk` and signing with the [Freighter](https://www.freighter.app) browser wallet.

**Features**

- **Register** — claim a top-level name with live availability checking as you type
- **Subdomains** — create `sub.parent` entries under domains you own
- **Resolve** — look up any name; shows availability, target address, owner, and expiry
- **Manage** — transfer ownership or renew; your domains load automatically from `list_domains`
- **Demo mode** — until a contract ID is configured, the UI runs with sample data instead of breaking

### Setup

```bash
cd client
bun install
```

### Go live

Paste your deployed contract ID into [`client/src/hooks/contract.ts`](client/src/hooks/contract.ts):

```ts
export const CONTRACT_ADDRESS = "C..."; // ← your deployed contract ID
```

The stats bar flips from **Demo mode** to **Live**, and every form starts hitting the chain. Reads use RPC simulation (no wallet needed); writes build a transaction, request a Freighter signature, submit, and poll until confirmed.

### Run

```bash
bun run dev     # development
bun run build   # production build
bun run start   # serve production build
bun run lint    # eslint
```

Open http://localhost:3000, install Freighter, and switch it to **Testnet**.

## Notes

- Default network is **Stellar Testnet** (`Test SDF Network ; September 2015`). Do not point this at mainnet without reviewing fees and security.
- Wallets must be funded accounts to sign transactions (testnet friendbot handles this via `stellar keys generate --fund`).
- Expiry estimates in the UI assume ~5 s ledger close times on testnet.
