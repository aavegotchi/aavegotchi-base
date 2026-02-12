# Toolchain

This repo uses both Foundry (forge) and Hardhat (Node.js) to compile/test/deploy Aavegotchi contracts.

## Node.js

Recommended:
- `22.18.0` (see `.nvmrc` / `.tool-versions`)

## Foundry

Recommended:
- Foundry stable (tested with `forge 1.3.5-stable`)

Install:
- https://book.getfoundry.sh/getting-started/installation

Verify:
```bash
forge --version
```

Notes:
- `foundry.toml` enables FFI.

## Submodules

This repo uses git submodules (for example `lib/forge-std`). If builds fail due to missing deps:

```bash
git submodule update --init --recursive
```

