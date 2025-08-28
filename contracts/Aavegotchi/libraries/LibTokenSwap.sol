// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";

// zRouter interface for Base network swaps
interface IZRouter {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);

    function WETH() external pure returns (address);
}

library LibTokenSwap {
    // zRouter address on Base network
    address constant Z_ROUTER = address(0x0000000000404FECAf36E6184475eE1254835);

    event TokenSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address indexed recipient);

    /**
     * @notice Swap tokens for GHST using zRouter
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
        IZRouter zRouter = IZRouter(Z_ROUTER);

        address[] memory path = new address[](2);
        uint256[] memory amounts;

        if (tokenIn == address(0)) {
            // ETH -> GHST swap
            path[0] = zRouter.WETH();
            path[1] = s.ghstContract;

            amounts = zRouter.swapExactETHForTokens{value: swapAmount}(minGhstOut, path, recipient, deadline);

            amountOut = amounts[1];
        } else {
            // ERC20 -> GHST swap
            path[0] = tokenIn;
            path[1] = s.ghstContract;

            // Transfer tokens from sender to this contract
            IERC20(tokenIn).transferFrom(msg.sender, address(this), swapAmount);

            // Approve zRouter to spend tokens
            IERC20(tokenIn).approve(address(zRouter), swapAmount);

            amounts = zRouter.swapExactTokensForTokens(swapAmount, minGhstOut, path, recipient, deadline);

            amountOut = amounts[1];
        }

        emit TokenSwapped(tokenIn, s.ghstContract, swapAmount, amountOut, recipient);
    }

    /**
     * @notice Get expected GHST output for a given input amount
     * @param tokenIn Address of input token (address(0) for ETH, token address for ERC20)
     * @param amountIn Amount of input token
     * @return amountOut Expected GHST output
     */
    function getGHSTAmountOut(address tokenIn, uint256 amountIn) internal view returns (uint256 amountOut) {
        if (amountIn == 0) return 0;

        AppStorage storage s = LibAppStorage.diamondStorage();
        IZRouter zRouter = IZRouter(Z_ROUTER);

        address[] memory path = new address[](2);

        if (tokenIn == address(0)) {
            path[0] = zRouter.WETH();
        } else {
            path[0] = tokenIn;
        }
        path[1] = s.ghstContract;

        try zRouter.getAmountsOut(amountIn, path) returns (uint256[] memory amounts) {
            amountOut = amounts[1];
        } catch {
            // Return 0 if swap path doesn't exist or other error
            amountOut = 0;
        }
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
