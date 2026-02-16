#!/usr/bin/env bash
set -euo pipefail

forge build --sizes
npx hardhat compile

if [ "$#" -gt 0 ]; then
  npx hardhat test "$@"
else
  npm test
fi
