# aavegotchi-geist

## What this codebase does

Solidity/TypeScript contracts for Aavegotchi on Base, centered on EIP-2535 diamonds. The main Aavegotchi diamond delegates selector calls into facets under `contracts/Aavegotchi/facets/` and stores protocol state in a single slot-0 `AppStorage`; related contracts include GHST/WGHST, wearables/forge surfaces, escrow contracts, Chainlink/Proof-of-Play VRF adapters, Hardhat tasks, and deployment/migration scripts.

## Auth shape

- Diamond upgrade and ownership paths use `LibDiamond.enforceIsContractOwner()` and `LibDiamond.contractOwner()`.
- Most Aavegotchi facets inherit `Modifiers` from `LibAppStorage`; important guards include `onlyOwner`, `onlyDao`, `onlyDaoOrOwner`, `onlyOwnerOrDaoOrGameManager`, `onlyItemManager`, `onlyOwnerOrItemManager`, `onlyPeriphery`, `onlyBaseRelayer`, and `whenNotPaused`.
- Meta-transaction-aware user flows should usually use `LibMeta.msgSender()` rather than raw `msg.sender`; `MetaTransactionsFacet.executeMetaTransaction` appends the signed user address to calldata.
- Token ownership and operator checks are split across ERC721/ERC1155 helpers, marketplace libraries, `s.operators`, `s.petOperators`, escrow ownership, and whitelist/buy-order state.
- Operational scripts and Hardhat network config read secrets/RPC/private-key material from `.env`; they must not broadcast to live networks unless intentionally invoked with a network and funded credentials.

## Threat model

Highest-impact attacks are unauthorized diamond cuts, owner/DAO/item-manager/game-manager privilege escalation, or delegatecall/init abuse that changes shared diamond state. Next are theft or locking of GHST, collateral, ERC721 gotchis/portals, ERC1155 wearables, marketplace proceeds, escrow assets, or reward/XP allocations. Also important: replay or spoofing in meta-transactions/signatures, bypassing pause/relayer restrictions, stale/misrouted VRF fulfillment, and scripts/tasks accidentally sending privileged live-network transactions.

## Project-specific patterns to flag

- Facet write functions that mutate `AppStorage` without the expected `Modifiers` guard or without a local ownership/operator check.
- Any storage-layout changes to `AppStorage` that reorder, remove, or type-change existing fields rather than append new fields at the end.
- Permissioned paths that use raw `msg.sender` where meta-tx-compatible `LibMeta.msgSender()` is required, or `LibMeta.msgSender()` where the direct caller must be enforced.
- Diamond cut/init flows that allow untrusted `_init`, `_calldata`, facet addresses, selector replacement, or delegatecall side effects.
- Marketplace, lending, escrow, bridge, and VRF flows where token transfer order, escrow ownership transfer, whitelist checks, fee splits, or callback authorization can be bypassed or griefed.

## Known false-positives

- `contracts/Aavegotchi/Diamond.sol` fallback delegatecall is the intended EIP-2535 dispatch path; risk depends on selector/facet registration and upgrade authorization.
- `contracts/shared/libraries/LibDiamond.sol` uses inline assembly and delegatecall for standard diamond storage and initialization mechanics.
- `contracts/Aavegotchi/facets/MetaTransactionsFacet.sol` intentionally calls `address(this).call(abi.encodePacked(functionSignature, userAddress))` after signature and nonce validation.
- `contracts/WGHST/TestVault.sol`, test fixtures, mocks, and scripts may look custodial or privileged but are not production protocol entry points unless deployed intentionally.
- Hardhat tasks under `tasks/` and scripts under `scripts/` may reference live networks and private-key env vars; treat as operational risk, not on-chain vulnerability, unless a task can be triggered by untrusted users.
