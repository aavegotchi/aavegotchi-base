# SwapAndBuyERC721 Test Suite

This test suite demonstrates and validates the `swapAndBuyERC721` function that allows users to swap USDC/ETH for GHST and purchase Aavegotchi NFTs in a single transaction.

## Features Tested

- ✅ USDC to GHST swap and NFT purchase
- ✅ ETH to GHST swap and NFT purchase
- ✅ Slippage protection
- ✅ Deadline validation
- ✅ Excess GHST refund
- ✅ Error handling (sold listings, expired deadlines)
- ✅ Real marketplace data via subgraph

## Prerequisites

1. **Base RPC URL**: Set up your Base mainnet RPC URL in `.env`
2. **Dependencies**: Run `npm install` to install required packages
3. **Network**: Tests run on Base mainnet fork

## Environment Setup

Create a `.env` file with:

```bash
# Base mainnet RPC (required for testing)
BASE_RPC_URL=https://mainnet.base.org

# Optional: Use your own RPC for better performance
BASE_RPC_URL=https://base.llamarpc.com
# or
BASE_RPC_URL=https://your-alchemy-base-url
```

## Running Tests

### Run the full swap test suite (SAFE - uses local fork):

```bash
npm run test:swap
```

### Or run with hardhat directly (SAFE - uses local fork):

```bash
npx hardhat test test/swapAndBuyERC721.test.ts --network hardhat
```

> ⚠️ **CRITICAL SAFETY NOTE**: These tests use a local Base mainnet fork for safety. Never run tests directly against mainnet networks as this can cause irreversible financial loss.

### Run specific test cases:

```bash
# Test only USDC swaps
npx hardhat test test/swapAndBuyERC721.test.ts --grep "USDC"

# Test only ETH swaps
npx hardhat test test/swapAndBuyERC721.test.ts --grep "ETH"

# Test only error cases
npx hardhat test test/swapAndBuyERC721.test.ts --grep "Error Cases"
```

## How It Works

### 1. **Fetches Real Listings**

The test queries the Aavegotchi subgraph on Base to find active, affordable listings:

```typescript
const query = `
  query GetActiveListings {
    erc721Listings(
      where: {
        cancelled: false
        timePurchased: null
        priceInWei_gte: "1000000000000000000"    # >= 1 GHST
        priceInWei_lte: "50000000000000000000"   # <= 50 GHST
      }
      orderBy: priceInWei
    ) { ... }
  }
`;
```

### 2. **Tests USDC Swap Purchase**

- Impersonates a USDC whale account
- Transfers USDC to test buyer
- Executes `swapAndBuyERC721` with USDC
- Verifies NFT ownership and token balances

### 3. **Tests ETH Swap Purchase**

- Funds test account with ETH
- Executes `swapAndBuyERC721` with ETH
- Verifies successful purchase and refunds

### 4. **Validates Edge Cases**

- Insufficient slippage protection
- Already sold listings
- Expired deadlines
- Excess token refunds

## Key Addresses (Base Mainnet)

| Contract           | Address                                      |
| ------------------ | -------------------------------------------- |
| Aavegotchi Diamond | `0xA99c4B08201F2913Db8D28e71d020c4298F29dBF` |
| GHST Token         | `0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb` |
| USDC Token         | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| zRouter            | `0x0000000000404FECAf36E6184475eE1254835`    |

## Test Output Example

```
🔍 Fetching active listings from subgraph...
📋 Found active listing: 12345
💰 Price: 5.5 GHST
🎭 Token ID: 67890

SwapAndBuyERC721 Integration Test
  USDC to GHST Swap and Purchase
    💵 USDC amount needed: 6.05 USDC
    🏦 Initial GHST balance: 0.0
    💵 Initial USDC balance: 6.05
    ⛽ Gas used: 287,432
    🏦 Final GHST balance: 0.0
    💵 Final USDC balance: 0.0
    ✅ USDC swap and purchase successful!
    ✓ Should swap USDC for GHST and purchase NFT (2.8s)

  ETH to GHST Swap and Purchase
    🔍 Fetching another active listing...
    🔷 ETH amount needed: 0.002 ETH
    ⛽ Gas used: 285,621
    ✅ ETH swap and purchase successful!
    ✓ Should swap ETH for GHST and purchase NFT (1.9s)
```

## Troubleshooting

### Common Issues:

1. **"No active listings found"**

   - The marketplace might not have affordable listings at the moment
   - Try adjusting the price range in the subgraph query

2. **RPC Rate Limiting**

   - Use a private RPC endpoint instead of public ones
   - Add delays between test runs

3. **Insufficient Liquidity**

   - The zRouter requires GHST/USDC and GHST/ETH pools on Base DEXes
   - Check that these pools exist and have sufficient liquidity

4. **Gas Estimation Failures**
   - Make sure you're using a Base mainnet fork
   - Verify all contract addresses are correct for Base

### Debug Mode:

Add more detailed logging:

```bash
DEBUG=true npx hardhat test test/swapAndBuyERC721.test.ts --network base
```

## Integration Notes

This test suite validates the complete swap-and-buy flow:

1. **Swap Execution**: zRouter swaps input tokens for GHST
2. **Purchase Logic**: Marketplace validates listing and executes purchase
3. **Payment Distribution**: Fees are split between seller, DAO, PixelCraft, etc.
4. **NFT Transfer**: Token is transferred to buyer
5. **Refund Handling**: Excess GHST is returned to buyer

The tests use real marketplace data to ensure the integration works with actual listings and current market conditions.
