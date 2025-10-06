// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAavegotchi, AavegotchiInfo} from "../libraries/LibAavegotchi.sol";
import {LibBuyOrder} from "../libraries/LibBuyOrder.sol";
import {LibERC721Marketplace} from "../libraries/LibERC721Marketplace.sol";
import {LibERC20} from "../../shared/libraries/LibERC20.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {IERC721} from "../../shared/interfaces/IERC721.sol";
import {LibMeta} from "../../shared/libraries/LibMeta.sol";
import {LibGotchiLending} from "../libraries/LibGotchiLending.sol";
import {Modifiers, ERC721BuyOrder} from "../libraries/LibAppStorage.sol";
import {BaazaarSplit, LibSharedMarketplace, SplitAddresses} from "../libraries/LibSharedMarketplace.sol";

import {CollateralEscrow} from "../CollateralEscrow.sol";

contract ERC721BuyOrderFacet is Modifiers {
    struct StatusesReturn {
        string status;
        uint256 buyOrderId;
    }

    event ERC721BuyOrderExecuted(
        uint256 indexed buyOrderId,
        address indexed buyer,
        address seller,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 priceInWei,
        uint256 time
    );

    function getERC721BuyOrder(uint256 _buyOrderId) external view returns (ERC721BuyOrder memory buyOrder_) {
        buyOrder_ = s.erc721BuyOrders[_buyOrderId];
        require(buyOrder_.timeCreated != 0, "ERC721BuyOrder: ERC721 buyOrder does not exist");
    }

    function getERC721BuyOrderStatuses(uint256[] calldata _buyOrderIds) external view returns (StatusesReturn[] memory statuses_) {
        uint256 length = _buyOrderIds.length;
        statuses_ = new StatusesReturn[](length);
        for (uint256 i; i < length; i++) {
            ERC721BuyOrder memory buyOrder = s.erc721BuyOrders[_buyOrderIds[i]];
            if (buyOrder.timeCreated == 0) {
                statuses_[i].status = "nonexistent";
                statuses_[i].buyOrderId = _buyOrderIds[i];
            } else if (buyOrder.cancelled == true) {
                statuses_[i].status = "cancelled";
                statuses_[i].buyOrderId = _buyOrderIds[i];
            } else if (buyOrder.timePurchased != 0) {
                statuses_[i].status = "executed";
                statuses_[i].buyOrderId = _buyOrderIds[i];
            } else {
                bytes32 validationHash = LibBuyOrder.generateValidationHash(
                    buyOrder.erc721TokenAddress,
                    buyOrder.erc721TokenId,
                    buyOrder.validationOptions
                );

                //Handle active states
                if (validationHash != buyOrder.validationHash) {
                    statuses_[i].status = "invalid";
                } else if (buyOrder.duration != 0 && buyOrder.timeCreated + buyOrder.duration < block.timestamp) {
                    statuses_[i].status = "expired";
                } else {
                    statuses_[i].status = "pending";
                }

                // hash validation

                statuses_[i].buyOrderId = _buyOrderIds[i];
            }
        }
    }

    function placeERC721BuyOrder(
        address _erc721TokenAddress,
        uint256 _erc721TokenId,
        uint256 _category,
        uint256 _priceInWei,
        uint256 _duration,
        bool[] calldata _validationOptions // 0: BRS, 1: GHST, 2: skill points
    ) external whenNotPaused {
        address sender = LibMeta.msgSender();
        uint256 ghstBalance = IERC20(s.ghstContract).balanceOf(sender);
        require(ghstBalance >= _priceInWei, "ERC721BuyOrder: Not enough GHST!");

        uint256 totalCost = LibBuyOrder.validateERC721Params(_erc721TokenAddress, _erc721TokenId, _category, _priceInWei, _validationOptions);

        // Transfer GHST
        LibERC20.transferFrom(s.ghstContract, sender, address(this), totalCost);

        // Place new buy order
        LibBuyOrder._placeERC721BuyOrder(_erc721TokenAddress, _erc721TokenId, _category, _priceInWei, _duration, _validationOptions);
    }

    function cancelERC721BuyOrder(uint256 _buyOrderId) external whenNotPaused {
        address sender = LibMeta.msgSender();
        ERC721BuyOrder memory erc721BuyOrder = s.erc721BuyOrders[_buyOrderId];

        require(erc721BuyOrder.timeCreated != 0, "ERC721BuyOrder: ERC721 buyOrder does not exist");
        require(
            sender == erc721BuyOrder.buyer || sender == IERC721(erc721BuyOrder.erc721TokenAddress).ownerOf(erc721BuyOrder.erc721TokenId),
            "ERC721BuyOrder: Only ERC721 token owner or buyer can call this function"
        );
        require(erc721BuyOrder.cancelled == false && erc721BuyOrder.timePurchased == 0, "ERC721BuyOrder: Already processed");
        if (erc721BuyOrder.duration > 0) {
            require(erc721BuyOrder.timeCreated + erc721BuyOrder.duration >= block.timestamp, "ERC721BuyOrder: Already expired");
        }

        LibBuyOrder.cancelERC721BuyOrder(_buyOrderId);
        emit LibBuyOrder.ERC721BuyOrderCanceled(_buyOrderId, block.timestamp);
    }

    function executeERC721BuyOrder(
        uint256 _buyOrderId,
        address _erc721TokenAddress,
        uint256 _erc721TokenId,
        uint256 _priceInWei
    ) external whenNotPaused {
        address sender = LibMeta.msgSender();
        ERC721BuyOrder storage erc721BuyOrder = s.erc721BuyOrders[_buyOrderId];

        require(erc721BuyOrder.timeCreated != 0, "ERC721BuyOrder: ERC721 buyOrder does not exist");
        require(erc721BuyOrder.erc721TokenAddress == _erc721TokenAddress, "ERC721BuyOrder: ERC721 token address not matched");
        require(erc721BuyOrder.erc721TokenId == _erc721TokenId, "ERC721BuyOrder: ERC721 token id not matched");
        require(erc721BuyOrder.priceInWei == _priceInWei, "ERC721BuyOrder: Price not matched");
        require(sender == IERC721(_erc721TokenAddress).ownerOf(_erc721TokenId), "ERC721BuyOrder: Only ERC721 token owner can call this function");
        require(erc721BuyOrder.cancelled == false && erc721BuyOrder.timePurchased == 0, "ERC721BuyOrder: Already processed");
        if (erc721BuyOrder.duration > 0) {
            require(erc721BuyOrder.timeCreated + erc721BuyOrder.duration >= block.timestamp, "ERC721BuyOrder: Already expired");
        }

        if (erc721BuyOrder.erc721TokenAddress == address(this)) {
            // disable for gotchi in lending
            AavegotchiInfo memory aavegotchiInfo = LibAavegotchi.getAavegotchi(_erc721TokenId);
            uint256 category = aavegotchiInfo.status;
            if (category == LibAavegotchi.STATUS_AAVEGOTCHI) {
                require(!LibGotchiLending.isAavegotchiLent(uint32(_erc721TokenId)), "ERC721BuyOrder: Not supported for aavegotchi in lending");
            }
        }

        // hash validation
        require(
            erc721BuyOrder.validationHash ==
                LibBuyOrder.generateValidationHash(_erc721TokenAddress, _erc721TokenId, erc721BuyOrder.validationOptions),
            "ERC721BuyOrder: Invalid buy order"
        );

        //Execute order
        erc721BuyOrder.timePurchased = block.timestamp;

        BaazaarSplit memory split = LibSharedMarketplace.getBaazaarSplit(erc721BuyOrder.priceInWei, new uint256[](0), [10000, 0]);

        LibSharedMarketplace.transferSales(
            SplitAddresses({
                ghstContract: s.ghstContract,
                buyer: address(this),
                seller: sender,
                affiliate: address(0),
                royalties: new address[](0),
                daoTreasury: s.daoTreasury,
                pixelCraft: s.pixelCraft,
                rarityFarming: s.rarityFarming
            }),
            split
        );

        if (_erc721TokenAddress == address(this)) {
            s.aavegotchis[_erc721TokenId].locked = false;
            LibAavegotchi.transfer(sender, erc721BuyOrder.buyer, _erc721TokenId);

            //transfer escrow ownership
            if (LibAavegotchi.getAavegotchi(_erc721TokenId).status == LibAavegotchi.STATUS_AAVEGOTCHI) {
                CollateralEscrow(payable(s.aavegotchis[erc721BuyOrder.erc721TokenId].escrow)).transferOwnership(erc721BuyOrder.buyer);
            }
            LibERC721Marketplace.updateERC721Listing(address(this), _erc721TokenId, sender);
        } else {
            IERC721(_erc721TokenAddress).safeTransferFrom(sender, erc721BuyOrder.buyer, _erc721TokenId);
        }

        LibBuyOrder.removeERC721BuyOrder(_buyOrderId);

        emit ERC721BuyOrderExecuted(
            _buyOrderId,
            erc721BuyOrder.buyer,
            sender,
            _erc721TokenAddress,
            _erc721TokenId,
            erc721BuyOrder.priceInWei,
            block.timestamp
        );
    }
}
