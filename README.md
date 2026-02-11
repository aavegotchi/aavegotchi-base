# Aavegotchi Geist Contracts

Canonical contracts and upgrade scripts for Aavegotchi on Base.

As of July 25, 2025, Aavegotchi's canonical home chain is Base (`8453`). This repository is the main source for active smart contract development, deployments, and upgrade tooling.

Legacy Polygon/Ethereum contracts are maintained in [`aavegotchi/aavegotchi-contracts`](https://github.com/aavegotchi/aavegotchi-contracts).

## Canonical Base Addresses

The addresses below are sourced from `helpers/constants.ts` (`networkAddresses[8453]`).

| Component | Address |
| --- | --- |
| GHST (Base) | [`0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb`](https://basescan.org/address/0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb) |
| AavegotchiDiamond | [`0xA99c4B08201F2913Db8D28e71d020c4298F29dBF`](https://basescan.org/address/0xA99c4B08201F2913Db8D28e71d020c4298F29dBF) |
| WearableDiamond | [`0x052e6c114a166B0e91C2340370d72D4C33752B4b`](https://basescan.org/address/0x052e6c114a166B0e91C2340370d72D4C33752B4b) |
| ForgeDiamond | [`0x50aF2d63b839aA32b4166FD1Cb247129b715186C`](https://basescan.org/address/0x50aF2d63b839aA32b4166FD1Cb247129b715186C) |
| RarityFarming | [`0x8c8E076Cd7D2A17Ba2a5e5AF7036c2b2B7F790f6`](https://basescan.org/address/0x8c8E076Cd7D2A17Ba2a5e5AF7036c2b2B7F790f6) |

For the full address map (including Base Sepolia and legacy networks), see [`helpers/constants.ts`](./helpers/constants.ts).

## Supported Networks

| Network | Chain ID | Status |
| --- | --- | --- |
| Base Mainnet | `8453` | Canonical production |
| Base Sepolia | `84532` | Testnet |
| Polygon | `137` | Legacy/reference scripts |

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure environment

Set required variables in `.env`:

- `BASE_RPC_URL`
- `BASE_SEPOLIA_RPC_URL`
- `SECRET`

Optional for legacy scripts:

- `MATIC_URL`
- `AMOY_URL`

### 3) Compile and test

```bash
npx hardhat compile
npx hardhat test
forge build
forge test
```

## Related Docs

- Swap + buy flow integration: [`SWAP_AND_BUY_INTEGRATION.md`](./SWAP_AND_BUY_INTEGRATION.md)
- Aavegotchi docs: [https://docs.aavegotchi.com](https://docs.aavegotchi.com)
- Wiki migration reference: [https://wiki.aavegotchi.com/base-migration](https://wiki.aavegotchi.com/base-migration)
- Migration announcement: [https://blog.aavegotchi.com/aavegotchi-has-migrated-to-base/](https://blog.aavegotchi.com/aavegotchi-has-migrated-to-base/)
