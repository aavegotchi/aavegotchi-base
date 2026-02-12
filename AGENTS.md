# Agent Notes (Aavegotchi Contracts)

This repo contains Aavegotchi smart contracts built around the EIP-2535 Diamond pattern (diamond + facets + shared storage).

These notes are for automated agents and contributors working in this repo.

## Safety Defaults (Read First)

- Do not broadcast transactions by default.
- Prefer local forks/simulations (`hardhat` network) over live networks.
- Never print or commit secrets (for example `.env`, private keys, API keys).
- If a task requires a funded key, hardware wallet, multisig, Defender relayer, or mainnet/testnet interaction: stop and ask for explicit confirmation + parameters.

## Quick Local Validation

```bash
git submodule update --init --recursive
npm ci

forge build --sizes
npx hardhat compile
```

## Repo Map (Where Things Live)

- Main diamond:
  - `contracts/Aavegotchi/Diamond.sol`
  - `contracts/Aavegotchi/InitDiamond.sol`
  - Facets: `contracts/Aavegotchi/facets/`
  - Libraries: `contracts/Aavegotchi/libraries/`
- Diamond kernel + shared libs/interfaces:
  - `contracts/shared/`
- Addresses/constants by chain:
  - `helpers/constants.ts`
- Aggregated ABI for the Aavegotchi diamond:
  - `diamondABI/diamond.json` (generated)
  - Generate: `npx hardhat diamondABI` (after `npx hardhat compile`)
- Ops/tasks:
  - Hardhat tasks: `tasks/`
  - Scripts: `scripts/`

## Diamond Gotchas (Important)

### Shared Storage (AppStorage)

The diamond uses a single `AppStorage` struct stored at slot 0:
- `contracts/Aavegotchi/libraries/LibAppStorage.sol`

Rules:
- Treat it like a database schema.
- Append-only: do not reorder/remove existing fields or change field types.
- Add new fields at the end and consider any required initialization/migrations.

### Meta-Transactions

Some auth paths use `LibMeta.msgSender()` (meta-tx aware) rather than `msg.sender`:
- `contracts/shared/libraries/LibMeta.sol`
- `contracts/Aavegotchi/facets/MetaTransactionsFacet.sol`

When adding new permissioned functions in facets, be deliberate about which sender pattern is correct.

### Calling Facets

Externally, users typically call the diamond address with facet ABIs. Selector routing is implemented via `LibDiamond`:
- `contracts/shared/libraries/LibDiamond.sol`

## PR Workflow Expectations

- Use a branch name with `codex/` prefix.
- Keep changes scoped to one concern per PR when possible.
- Include a short test section in the PR description (what you ran locally).

