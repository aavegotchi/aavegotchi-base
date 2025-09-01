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

    // USDC address on Base mainnet
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    event TokenSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed recipient);

    /**
     * @notice Swap tokens for GHST using zRouter with fallback strategy
     * @dev Try Aerodrome first, fallback to V2 if needed
     * @param tokenIn Address of input token (address(0) for ETH, token address for ERC20)
     * @param swapAmount Amount of tokenIn to swap
     * @param minGhstOut Minimum GHST to receive (slippage protection)
     * @param deadline Deadline for the swap
     * @param recipient Address to receive the GHST
     * @param maxSlippageBps Maximum slippage in basis points (0 = use minGhstOut only)
     * @return amountOut Amount of GHST received
     */
    function swapForGHST(
        address tokenIn,
        uint256 swapAmount,
        uint256 minGhstOut,
        uint256 deadline,
        address recipient,
        uint256 maxSlippageBps
    ) internal returns (uint256 amountOut) {
        require(swapAmount > 0, "LibTokenSwap: swapAmount must be > 0");
        require(deadline >= block.timestamp, "LibTokenSwap: deadline expired");
        require(ROUTER != address(0), "LibTokenSwap: Router address is zero");

        AppStorage storage s = LibAppStorage.diamondStorage();

        // Handle token transfers in separate scope to reduce stack depth
        _handleTokenTransfer(tokenIn, swapAmount);

        // Calculate minimum output with slippage protection
        uint256 calculatedMinOut = _calculateMinOutput(tokenIn, swapAmount, minGhstOut, maxSlippageBps);

        // Execute swap with fallback
        amountOut = _executeSwap(tokenIn, swapAmount, calculatedMinOut, deadline, recipient, s.ghstContract);

        emit TokenSwapped(tokenIn, s.ghstContract, swapAmount, amountOut, recipient);
    }

    function _handleTokenTransfer(address tokenIn, uint256 swapAmount) private {
        if (tokenIn != address(0)) {
            // For ERC20, transfer tokens from sender to this contract first
            IERC20(tokenIn).transferFrom(msg.sender, address(this), swapAmount);
            // Verify we received the tokens
            require(IERC20(tokenIn).balanceOf(address(this)) >= swapAmount, "LibTokenSwap: Token transfer failed");
            // Approve zRouter to spend our tokens
            IERC20(tokenIn).approve(ROUTER, swapAmount);
        }
    }

    function _calculateMinOutput(
        address tokenIn,
        uint256 swapAmount,
        uint256 minGhstOut,
        uint256 maxSlippageBps
    ) private pure returns (uint256 calculatedMinOut) {
        calculatedMinOut = minGhstOut;
        if (maxSlippageBps > 0) {
            uint256 estimatedOut = getGHSTAmountOut(tokenIn, swapAmount);
            uint256 slippageMinOut = (estimatedOut * (10000 - maxSlippageBps)) / 10000;
            calculatedMinOut = minGhstOut > slippageMinOut ? minGhstOut : slippageMinOut;
        }
    }

    function _executeSwap(
        address tokenIn,
        uint256 swapAmount,
        uint256 calculatedMinOut,
        uint256 deadline,
        address recipient,
        address ghstContract
    ) private returns (uint256 amountOut) {
        IZRouter router = IZRouter(ROUTER);

        try
            router.swapAero{value: tokenIn == address(0) ? swapAmount : 0}(
                recipient,
                false, // volatile pair
                tokenIn,
                ghstContract,
                swapAmount,
                calculatedMinOut,
                deadline
            )
        returns (uint256, uint256 amountOut_) {
            require(amountOut_ >= calculatedMinOut, "LibTokenSwap: Insufficient output amount");
            return amountOut_;
        } catch {
            // Fallback to V2 if Aerodrome fails
            (, amountOut) = router.swapV2{value: tokenIn == address(0) ? swapAmount : 0}(
                recipient,
                false, // exactIn
                tokenIn,
                ghstContract,
                swapAmount,
                calculatedMinOut,
                deadline
            );
            require(amountOut >= calculatedMinOut, "LibTokenSwap: Insufficient output amount");
        }
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
            // ETH -> GHST: ~1 ETH = ~2000 GHST (approximate)
            // ETH has 18 decimals, GHST has 18 decimals
            amountOut = amountIn * 2000;
        } else if (tokenIn == USDC) {
            // USDC -> GHST: ~1 USDC = ~2.17 GHST (approximate)
            // USDC has 6 decimals, GHST has 18 decimals, so we need to scale up
            amountOut = (amountIn * 217 * 1e18) / (100 * 1e6); // 2.17 ratio with proper decimals
        } else {
            // For other ERC20 tokens, assume roughly 1:1 ratio as conservative estimate
            // Adjust decimals if needed (assume 18 decimals for unknown tokens)
            amountOut = amountIn;
        }

        // Return a conservative estimate (85% of rough calculation for better UX)
        amountOut = (amountOut * 85) / 100;
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
