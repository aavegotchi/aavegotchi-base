// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";

// zRouter interface for multi-AMM routing on Base
interface IZRouter {
    function swapAero(
        address to,
        bool stable,
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 amountLimit,
        uint256 deadline
    ) external payable returns (uint256 amountIn, uint256 amountOut);

    function swapV2(
        address to,
        bool exactOut,
        address tokenIn,
        address tokenOut,
        uint256 swapAmount,
        uint256 amountLimit,
        uint256 deadline
    ) external payable returns (uint256 amountIn, uint256 amountOut);
}

library LibTokenSwap {
    // zRouter multi-AMM aggregator on Base network
    address constant ROUTER = address(0x0000000000404FECAf36E6184245475eE1254835);

    // WETH address on Base (from zRouter contract)
    address constant WETH = address(0x4200000000000000000000000000000000000006);

    event TokenSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed recipient);

    /**
     * @notice Swap tokens for GHST using zRouter with fallback strategy
     * @dev Try Aerodrome first, fallback to V2 if needed
     * @param tokenIn Address of input token (address(0) for ETH, token address for ERC20)
     * @param swapAmount Amount of tokenIn to swap
     * @param minGhstOut Minimum GHST to receive (slippage protection)
     * @param deadline Deadline for the swap
     * @param recipient Address to receive the GHST
     * @return amountOut Amount of GHST received
     */
    function swapForGHST(
        address tokenIn,
        uint256 swapAmount,
        uint256 minGhstOut,
        uint256 deadline,
        address recipient
    ) internal returns (uint256 amountOut) {
        require(swapAmount > 0, "LibTokenSwap: swapAmount must be > 0");
        require(deadline >= block.timestamp, "LibTokenSwap: deadline expired");

        AppStorage storage s = LibAppStorage.diamondStorage();
        IZRouter router = IZRouter(ROUTER);

        // DEBUG: Add require to check router exists
        require(ROUTER != address(0), "LibTokenSwap: Router address is zero");

        // DEBUG: Handle token transfer for ERC20
        if (tokenIn != address(0)) {
            // For ERC20, transfer tokens from sender to this contract first
            IERC20(tokenIn).transferFrom(msg.sender, address(this), swapAmount);

            // Verify we received the tokens
            uint256 balance = IERC20(tokenIn).balanceOf(address(this));
            require(balance >= swapAmount, "LibTokenSwap: Token transfer failed");

            // Approve zRouter to spend our tokens
            IERC20(tokenIn).approve(ROUTER, swapAmount);
        }

        // Try Aerodrome first for best GHST liquidity
        // Set amountLimit to 0 initially to bypass zRouter's slippage check
        // We handle slippage protection ourselves with minGhstOut

        // Handle token address for zRouter (ETH needs to be passed as address(0), not WETH)
        address tokenForRouter = tokenIn; // Keep as-is for zRouter

        try
            router.swapAero{value: tokenIn == address(0) ? swapAmount : 0}(
                recipient,
                false, // volatile pair
                tokenForRouter,
                s.ghstContract,
                swapAmount,
                0, // amountLimit = 0 (let zRouter handle best execution)
                deadline
            )
        returns (uint256, uint256 amountOut_) {
            // Apply our own slippage check after successful swap
            require(amountOut_ >= minGhstOut, "LibTokenSwap: Insufficient output amount");
            amountOut = amountOut_;
            emit TokenSwapped(tokenIn, s.ghstContract, swapAmount, amountOut, recipient);
            return amountOut;
        } catch {
            // Fallback to V2 if Aerodrome fails
            // Tokens are already transferred and approved above

            (, amountOut) = router.swapV2{value: tokenIn == address(0) ? swapAmount : 0}(
                recipient,
                false, // exactIn
                tokenForRouter,
                s.ghstContract,
                swapAmount,
                0, // amountLimit = 0 (let zRouter handle best execution)
                deadline
            );

            // Apply our own slippage check after successful swap
            require(amountOut >= minGhstOut, "LibTokenSwap: Insufficient output amount");
        }

        emit TokenSwapped(tokenIn, s.ghstContract, swapAmount, amountOut, recipient);
    }

    /**
     * @notice Get expected GHST output for a given input amount
     * @dev zRouter doesn't have a direct quote function, so this provides a conservative estimate
     * @param tokenIn Address of input token (address(0) for ETH, token address for ERC20)
     * @param amountIn Amount of input token
     * @return amountOut Conservative estimated GHST output (use zRouter directly for exact quotes)
     */
    function getGHSTAmountOut(address tokenIn, uint256 amountIn) internal pure returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        // Since zRouter is a multi-AMM aggregator without a simple quote function,
        // we provide a conservative estimate. Frontends should call zRouter directly
        // for exact quotes using the multicall functionality.

        // Conservative estimates based on approximate market rates:
        if (tokenIn == address(0)) {
            // ETH -> GHST: ~1 ETH = ~2000 GHST (very rough estimate)
            amountOut = amountIn * 2000; // This is a placeholder - adjust based on market
        } else {
            // For ERC20 tokens, assume roughly 1:1 ratio as conservative estimate
            // This is very rough and should be replaced with actual pricing logic
            amountOut = amountIn;
        }

        // Return a conservative estimate (80% of rough calculation)
        amountOut = (amountOut * 80) / 100;
    }

    /**
     * @notice Validate swap parameters
     * @param tokenIn Address of input token
     * @param swapAmount Amount to swap
     * @param minGhstOut Minimum GHST expected
     * @param deadline Swap deadline
     */
    function validateSwapParams(address tokenIn, uint256 swapAmount, uint256 minGhstOut, uint256 deadline) internal view {
        require(swapAmount > 0, "LibTokenSwap: swapAmount must be > 0");
        require(minGhstOut > 0, "LibTokenSwap: minGhstOut must be > 0");
        require(deadline >= block.timestamp, "LibTokenSwap: deadline expired");

        // Enhanced deadline validation - prevent indefinite orders (max 24 hours)
        require(deadline <= block.timestamp + 86400, "LibTokenSwap: deadline too far in future");

        // Validate ETH amount matches if ETH swap
        if (tokenIn == address(0)) {
            require(msg.value == swapAmount, "LibTokenSwap: ETH amount mismatch");
        } else {
            require(msg.value == 0, "LibTokenSwap: unexpected ETH sent");
        }
    }

    /**
     * @notice Validate slippage protection parameters
     * @param maxSlippageBps Maximum slippage in basis points (user-provided)
     */
    function validateSlippageProtection(uint256 maxSlippageBps) internal pure {
        // Ensure slippage doesn't exceed reasonable maximum (20% = 2000 basis points)
        require(maxSlippageBps <= 2000, "LibTokenSwap: Slippage too high");
    }

    /**
     * @notice Refund excess GHST to recipient
     * @param recipient Address to receive excess GHST
     * @param initialBalance GHST balance before operations
     */
    function refundExcessGHST(address recipient, uint256 initialBalance) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 currentBalance = IERC20(s.ghstContract).balanceOf(address(this));

        if (currentBalance > initialBalance) {
            uint256 excess = currentBalance - initialBalance;
            IERC20(s.ghstContract).transfer(recipient, excess);
        }
    }
}
