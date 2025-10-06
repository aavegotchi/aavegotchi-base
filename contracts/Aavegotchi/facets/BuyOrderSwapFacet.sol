// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibTokenSwap} from "../libraries/LibTokenSwap.sol";
import {LibBuyOrder} from "../libraries/LibBuyOrder.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {Modifiers} from "../libraries/LibAppStorage.sol";

contract BuyOrderSwapFacet is Modifiers {
    struct ERC1155SwapParams {
        address tokenIn;
        uint256 swapAmount;
        uint256 minGhstOut;
        uint256 swapDeadline;
        address erc1155TokenAddress;
        uint256 erc1155TokenId;
        uint256 category;
        uint256 priceInWei;
        uint256 quantity;
        uint256 duration;
        address recipient;
    }

    struct ERC721SwapParams {
        address tokenIn;
        uint256 swapAmount;
        uint256 minGhstOut;
        uint256 swapDeadline;
        address erc721TokenAddress;
        uint256 erc721TokenId;
        uint256 category;
        uint256 priceInWei;
        uint256 duration;
        address recipient;
    }

    event SwapAndPlaceERC1155BuyOrder(address indexed buyer, uint256 indexed buyOrderId, address indexed tokenIn, uint256 ghstReceived);
    event SwapAndPlaceERC721BuyOrder(address indexed buyer, uint256 indexed buyOrderId, address indexed tokenIn, uint256 ghstReceived);

    /**
     * @notice Swap tokens for GHST and immediately place a new ERC1155 buy order
     * @param params Packed swap and order parameters
     */
    function swapAndPlaceERC1155BuyOrder(ERC1155SwapParams calldata params) external payable whenNotPaused {
        LibTokenSwap.validateSwapParams(params.tokenIn, params.swapAmount, params.minGhstOut, params.swapDeadline);

        require(params.recipient == msg.sender, "ERC1155BuyOrderSwap: recipient must be msg.sender");

        uint256 totalCost = LibBuyOrder.validateERC1155Params(params.erc1155TokenAddress, params.erc1155TokenId, params.priceInWei, params.quantity);

        //assert ghst to be swapped to is enough
        require(params.minGhstOut >= totalCost, "ERC1155BuyOrderSwap: minGhstOut must cover total cost");

        //perform swap
        uint256 ghstReceived = LibTokenSwap.swapForGHST(params.tokenIn, params.swapAmount, params.minGhstOut, params.swapDeadline, address(this));

        require(ghstReceived >= totalCost, "ERC1155BuyOrderSwap: Insufficient GHST for purchase");

        //place buy order
        uint256 buyOrderId = LibBuyOrder._placeERC1155BuyOrder(
            params.erc1155TokenAddress,
            params.erc1155TokenId,
            params.category,
            params.priceInWei,
            params.quantity,
            params.duration
        );

        // Refund any excess GHST to the recipient using shared library, leave totalCost in the diamond
        LibTokenSwap.refundExcessGHST(params.recipient, ghstReceived, totalCost);

        emit SwapAndPlaceERC1155BuyOrder(msg.sender, buyOrderId, params.tokenIn, ghstReceived);
    }

    /**
     * @notice Swap tokens for GHST and immediately place a new ERC721 buy order
     * @param params Packed swap and order parameters
     * @param validationOptions Flags that determine additional validation logic
     */
    function swapAndPlaceERC721BuyOrder(ERC721SwapParams calldata params, bool[] calldata validationOptions) external payable whenNotPaused {
        LibTokenSwap.validateSwapParams(params.tokenIn, params.swapAmount, params.minGhstOut, params.swapDeadline);

        require(params.recipient == msg.sender, "ERC721BuyOrderSwap: recipient must be msg.sender");

        uint256 totalCost = LibBuyOrder.validateERC721Params(
            params.erc721TokenAddress,
            params.erc721TokenId,
            params.category,
            params.priceInWei,
            validationOptions
        );

        require(params.minGhstOut >= totalCost, "ERC721BuyOrderSwap: minGhstOut must cover total cost");

        //perform swap and validate
        uint256 ghstReceived = LibTokenSwap.swapForGHST(params.tokenIn, params.swapAmount, params.minGhstOut, params.swapDeadline, address(this));

        require(ghstReceived >= totalCost, "ERC721BuyOrderSwap: Insufficient GHST for purchase");

        //place buy order
        uint256 buyOrderId = LibBuyOrder._placeERC721BuyOrder(
            params.erc721TokenAddress,
            params.erc721TokenId,
            params.category,
            params.priceInWei,
            params.duration,
            validationOptions
        );

        // Refund any excess GHST to the recipient using shared library, leave totalCost in the diamond
        LibTokenSwap.refundExcessGHST(params.recipient, ghstReceived, totalCost);

        emit SwapAndPlaceERC721BuyOrder(msg.sender, buyOrderId, params.tokenIn, ghstReceived);
    }
}
