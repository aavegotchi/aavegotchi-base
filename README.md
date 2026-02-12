# Aavegotchi Base Contracts

Smart contracts for Aavegotchi on Base (and related deployments), built around the EIP-2535 Diamond pattern.

This repo includes:
- The Aavegotchi Diamond (facets + libraries)
- Related diamonds (Wearables, Forge)
- GHST/WGHST + periphery contracts
- Hardhat tasks + scripts used for upgrades and operations

## Repo Map

- `contracts/Aavegotchi/`: main Aavegotchi diamond (facets, libraries, init, `Diamond.sol`)
- `contracts/shared/`: diamond kernel (`LibDiamond`, cut/loupe/ownership facets, shared interfaces/libs)
- `contracts/GHST/`: GHST diamond
- `contracts/WGHST/`: wrapped GHST
- `tasks/`: Hardhat tasks (diamond cuts, ABI generation, upgrades, verification)
- `scripts/`: operational scripts (deploys, migrations, airdrops, data utilities)
- `helpers/constants.ts`: chain IDs + deployed addresses (Base/Polygon/etc)
- `diamondABI/diamond.json`: aggregated ABI for the Aavegotchi diamond (generated via Hardhat task)

## Quickstart

### Prereqs

- Node.js (Hardhat)
- Foundry (forge/anvil/cast)
- Git submodules (forge-std)

### Install

```bash
git submodule update --init --recursive
npm ci
```

If you don't have a lockfile-friendly setup, use `npm install` instead of `npm ci`.

### Build

```bash
forge build --sizes
npx hardhat compile
```

Notes:
- This repo compiles with multiple Solidity compiler versions (see `hardhat.config.ts`).
- `foundry.toml` enables FFI; be aware when running tests locally/CI.

## Testing

### Foundry

```bash
forge test
```

### Hardhat

```bash
npm test
```

Fork / integration tests:
- Some tests run against a local fork (Hardhat `hardhat` network is configured with Base forking at a fixed block).
- Set `BASE_RPC_URL` in `.env` to run fork-based tests safely on a local node.
- Never point tests at a live network with funded keys.

See also:
- `test/README.md`
- `SWAP_AND_BUY_INTEGRATION.md`

## Working With Diamonds

- You call the diamond address with facet ABIs; function selectors are routed to facets via `LibDiamond`.
- Protocol state is a single `AppStorage` struct in storage slot 0. Treat changes as schema migrations (append-only).

Useful references:
- `contracts/Aavegotchi/libraries/LibAppStorage.sol`
- `contracts/shared/libraries/LibDiamond.sol`

## ABI + Addresses

- Deployed addresses by chain: `helpers/constants.ts`
- Aggregated Aavegotchi diamond ABI: `diamondABI/diamond.json`
  - Generate (after `npx hardhat compile`): `npx hardhat diamondABI`

## License

MIT (see `LICENSE`)
