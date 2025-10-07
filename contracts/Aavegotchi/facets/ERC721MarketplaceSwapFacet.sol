// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibERC721Marketplace} from "../libraries/LibERC721Marketplace.sol";
import {LibTokenSwap} from "../libraries/LibTokenSwap.sol";
import {Modifiers} from "../libraries/LibAppStorage.sol";

contract ERC721MarketplaceSwapFacet is Modifiers {
    event SwapAndPurchase(
        address indexed recipient,
        address indexed tokenIn,
        uint256 swapAmount,
        uint256 ghstReceived,
        uint256 listingId,
        uint256 tokenId,
        address indexed nftContract
    );

    /**
     * @notice Swap tokens for GHST and immediately purchase an ERC721 NFT
     * @param tokenIn Address of input token (address(0) for ETH, USDC address for USDC)
     * @param swapAmount Amount of tokenIn to swap
     * @param minGhstOut Minimum GHST to receive (slippage protection)
     * @param swapDeadline Deadline for the swap
     * @param listingId The marketplace listing ID
     * @param contractAddress The NFT contract address
     * @param priceInWei Expected NFT price in GHST wei
     * @param tokenId The NFT token ID
     * @param recipient Address to receive the NFT
     */
    function swapAndBuyERC721(
        address tokenIn,
        uint256 swapAmount,
        uint256 minGhstOut,
        uint256 swapDeadline,
        uint256 listingId,
        address contractAddress,
        uint256 priceInWei,
        uint256 tokenId,
        address recipient
    ) external payable whenNotPaused {
        // Validate parameters
        LibTokenSwap.validateSwapParams(tokenIn, swapAmount, minGhstOut, swapDeadline);
        require(minGhstOut >= priceInWei, "ERC721MarketplaceSwap: minGhstOut must cover price");

        // Perform token swap to GHST
        uint256 ghstReceived = LibTokenSwap.swapForGHST(tokenIn, swapAmount, minGhstOut, swapDeadline, address(this));

        // Verify we have enough GHST for the purchase
        require(ghstReceived >= priceInWei, "ERC721MarketplaceSwap: Insufficient GHST for purchase");

        // Execute NFT purchase using shared library function
        // Note: buyer is address(this) since GHST is already in this contract
        LibERC721Marketplace.executeERC721Listing(listingId, contractAddress, priceInWei, tokenId, recipient, address(this));

        // Refund any excess GHST to the recipient using shared library
        LibTokenSwap.refundExcessGHST(recipient, ghstReceived, priceInWei);

        emit SwapAndPurchase(recipient, tokenIn, swapAmount, ghstReceived, listingId, tokenId, contractAddress);
    }
}
