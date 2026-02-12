# Contributing

This repo contains the Aavegotchi contracts (Diamonds/facets/libraries) and supporting Hardhat tasks/scripts used for upgrades and operations.

## Local Setup

1. Initialize submodules (forge-std):

```bash
git submodule update --init --recursive
```

2. Install JS dependencies:

```bash
npm ci
```

3. Install Foundry (forge/anvil/cast):

- https://book.getfoundry.sh/getting-started/installation

## Common Commands

### Format

```bash
forge fmt
npm run prettier
```

### Build / Compile

This repo compiles with multiple Solidity compiler versions (see `hardhat.config.ts`).

```bash
forge build --sizes
npx hardhat compile
```

### Tests

```bash
forge test
npm test
```

Some tests use a local fork (Hardhat `hardhat` network). For fork-based tests you will need an RPC URL in `.env` (for example `BASE_RPC_URL`).

## Diamond-Specific Guidelines

### Storage Safety (Critical)

The diamond’s state is a single `AppStorage` struct stored at slot 0:
- `contracts/Aavegotchi/libraries/LibAppStorage.sol`

Rules of thumb:
- Treat `AppStorage` as a database schema migration.
- Append-only: do not reorder/remove existing fields or change field types.
- If you need new state, add it at the end and consider backfills/init if required.

### msg.sender vs Meta-Transactions

Many auth checks use `LibMeta.msgSender()` (meta-tx aware). If you add new permissioned functions in facets, be deliberate about whether you should use:
- `msg.sender` (direct call only)
- `LibMeta.msgSender()` (supports meta-tx flows)

References:
- `contracts/shared/libraries/LibMeta.sol`
- `contracts/Aavegotchi/facets/MetaTransactionsFacet.sol`

## PR Expectations

- Keep PRs focused and small when possible.
- Include tests (or explain why tests aren’t feasible).
- Don’t commit secrets (`.env`, private keys, API keys).
- Prefer changes that keep local dev flows safe by default (forks/simulations; no accidental broadcasts).

