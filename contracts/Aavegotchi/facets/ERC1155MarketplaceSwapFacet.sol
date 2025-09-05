// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage} from "../libraries/LibAppStorage.sol";
import {LibERC1155Marketplace} from "../libraries/LibERC1155Marketplace.sol";
import {LibTokenSwap} from "../libraries/LibTokenSwap.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {Modifiers} from "../libraries/LibAppStorage.sol";

contract ERC1155MarketplaceSwapFacet is Modifiers {
    event SwapAndPurchaseERC1155(address indexed buyer, address indexed tokenIn, uint256 ghstReceived, uint256 indexed listingId);

    /**
     * @notice Swap tokens for GHST and immediately purchase ERC1155 items
     * @param tokenIn Address of input token (address(0) for ETH, USDC address for USDC)
     * @param swapAmount Amount of tokenIn to swap
     * @param minGhstOut Minimum GHST to receive (slippage protection)
     * @param swapDeadline Deadline for the swap
     * @param listingId The marketplace listing ID
     * @param contractAddress The ERC1155 contract address
     * @param itemId The ERC1155 token ID
     * @param quantity The amount of items to purchase
     * @param priceInWei Expected item price in GHST wei (per item)
     * @param recipient Address to receive the items
    
     */
    function swapAndBuyERC1155(
        address tokenIn,
        uint256 swapAmount,
        uint256 minGhstOut,
        uint256 swapDeadline,
        uint256 listingId,
        address contractAddress,
        uint256 itemId,
        uint256 quantity,
        uint256 priceInWei,
        address recipient
    ) external payable whenNotPaused {
        // Validate parameters
        LibTokenSwap.validateSwapParams(tokenIn, swapAmount, minGhstOut, swapDeadline);
        require(quantity > 0, "ERC1155MarketplaceSwap: quantity must be > 0");

        uint256 totalCost = quantity * priceInWei;
        require(minGhstOut >= totalCost, "ERC1155MarketplaceSwap: minGhstOut must cover total cost");

        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 initialBalance = IERC20(s.ghstContract).balanceOf(address(this));

        // Perform token swap to GHST
        uint256 ghstReceived = LibTokenSwap.swapForGHST(tokenIn, swapAmount, minGhstOut, swapDeadline, address(this));

        // Verify we have enough GHST for the purchase
        require(ghstReceived >= totalCost, "ERC1155MarketplaceSwap: Insufficient GHST for purchase");

        // Execute item purchase using shared library function
        // Note: buyer is address(this) since GHST is already in this contract
        LibERC1155Marketplace.executeERC1155Listing(listingId, contractAddress, itemId, quantity, priceInWei, recipient, address(this));

        // Refund any excess GHST to the recipient using shared library
        LibTokenSwap.refundExcessGHST(recipient, initialBalance);

        {
            // Emit event in separate scope to avoid stack too deep
            emit SwapAndPurchaseERC1155(msg.sender, tokenIn, ghstReceived, listingId);
        }
    }
}
