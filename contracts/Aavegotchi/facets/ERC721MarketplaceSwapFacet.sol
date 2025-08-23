// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage} from "../libraries/LibAppStorage.sol";
import {LibERC721Marketplace} from "../libraries/LibERC721Marketplace.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {Modifiers} from "../libraries/LibAppStorage.sol";

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

contract ERC721MarketplaceSwapFacet is Modifiers {
    event SwapAndPurchase(
        address indexed buyer,
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
        require(swapAmount > 0, "ERC721MarketplaceSwap: swapAmount must be > 0");
        require(minGhstOut >= priceInWei, "ERC721MarketplaceSwap: minGhstOut must cover price");

        if (tokenIn == address(0)) {
            require(msg.value == swapAmount, "ERC721MarketplaceSwap: ETH amount mismatch");
        }

        uint256 initialBalance = IERC20(s.ghstContract).balanceOf(address(this));
        _performTokenSwap(tokenIn, swapAmount, minGhstOut, swapDeadline);

        uint256 currentBalance = IERC20(s.ghstContract).balanceOf(address(this));
        require(currentBalance >= initialBalance + priceInWei, "ERC721MarketplaceSwap: Insufficient GHST for purchase");

        _executeNftPurchase(listingId, contractAddress, priceInWei, tokenId, recipient, initialBalance);

        emit SwapAndPurchase(msg.sender, tokenIn, swapAmount, currentBalance - initialBalance, listingId, tokenId, contractAddress);
    }

    /**
     * @dev Performs the token swap using zRouter
     */
    function _performTokenSwap(address tokenIn, uint256 swapAmount, uint256 minGhstOut, uint256 deadline) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // zRouter address on Base network
        IZRouter zRouter = IZRouter(address(0x0000000000404FECAf36E6184475eE1254835));

        address[] memory path = new address[](2);

        if (tokenIn == address(0)) {
            // ETH -> GHST swap
            path[0] = zRouter.WETH();
            path[1] = s.ghstContract;

            zRouter.swapExactETHForTokens{value: swapAmount}(minGhstOut, path, address(this), deadline);
        } else {
            // ERC20 -> GHST swap
            path[0] = tokenIn;
            path[1] = s.ghstContract;

            // Transfer tokens from user to this contract
            IERC20(tokenIn).transferFrom(msg.sender, address(this), swapAmount);

            // Approve zRouter to spend tokens
            IERC20(tokenIn).approve(address(zRouter), swapAmount);

            zRouter.swapExactTokensForTokens(swapAmount, minGhstOut, path, address(this), deadline);
        }
    }

    /**
     * @dev Executes the NFT purchase using existing marketplace logic
     */
    function _executeNftPurchase(
        uint256 listingId,
        address contractAddress,
        uint256 priceInWei,
        uint256 tokenId,
        address recipient,
        uint256 initialBalance
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // Execute the purchase using the shared library function
        // Note: buyer is address(this) since GHST is already in this contract
        LibERC721Marketplace.executeERC721Listing(listingId, contractAddress, priceInWei, tokenId, recipient, address(this));

        // Refund any excess GHST to the recipient
        uint256 finalBalance = IERC20(s.ghstContract).balanceOf(address(this));
        uint256 excess = finalBalance - initialBalance;
        if (excess > 0) {
            IERC20(s.ghstContract).transfer(recipient, excess);
        }
    }
}
