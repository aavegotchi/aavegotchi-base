// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage, ERC721BuyOrder, ERC1155BuyOrder} from "./LibAppStorage.sol";
import {LibAavegotchi, AavegotchiInfo} from "./LibAavegotchi.sol";
import {LibSharedMarketplace} from "./LibSharedMarketplace.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {IERC721} from "../../shared/interfaces/IERC721.sol";
import {LibERC20} from "../../shared/libraries/LibERC20.sol";
import {LibMeta} from "../../shared/libraries/LibMeta.sol";

library LibBuyOrder {
    event ERC1155BuyOrderAdd(
        uint256 indexed buyOrderId,
        address indexed buyer,
        address erc1155TokenAddress,
        uint256 erc1155TokenId,
        uint256 indexed category,
        uint256 priceInWei,
        uint256 quantity,
        uint256 duration,
        uint256 time
    );

    event ERC721BuyOrderCanceled(uint256 indexed buyOrderId, uint256 time);
    event ERC721BuyOrderAdded(
        uint256 indexed buyOrderId,
        address indexed buyer,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 indexed category,
        uint256 priceInWei,
        uint256 duration,
        bytes32 validationHash,
        uint256 time
    );

    function cancelERC721BuyOrder(uint256 _buyOrderId) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        ERC721BuyOrder memory erc721BuyOrder = s.erc721BuyOrders[_buyOrderId];
        if (erc721BuyOrder.timeCreated == 0) {
            return;
        }
        if ((erc721BuyOrder.cancelled == true) || (erc721BuyOrder.timePurchased != 0)) {
            return;
        }

        removeERC721BuyOrder(_buyOrderId);
        s.erc721BuyOrders[_buyOrderId].cancelled = true;

        // refund GHST to buyer
        LibERC20.transfer(s.ghstContract, erc721BuyOrder.buyer, erc721BuyOrder.priceInWei);
    }

    function removeERC721BuyOrder(uint256 _buyOrderId) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        ERC721BuyOrder memory erc721BuyOrder = s.erc721BuyOrders[_buyOrderId];
        uint256 _tokenId = erc721BuyOrder.erc721TokenId;
        address _tokenAddress = erc721BuyOrder.erc721TokenAddress;

        delete s.buyerToBuyOrderId[_tokenAddress][_tokenId][erc721BuyOrder.buyer];
    }

    function generateValidationHash(
        address _erc721TokenAddress,
        uint256 _erc721TokenId,
        bool[] memory _validationOptions
    ) internal view returns (bytes32) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        //Category is always validated
        uint256 category = LibSharedMarketplace.getERC721Category(_erc721TokenAddress, _erc721TokenId);
        bytes memory _params = abi.encode(_erc721TokenId, category);
        if (category == LibAavegotchi.STATUS_AAVEGOTCHI) {
            // Aavegotchi
            _params = abi.encode(_params, s.aavegotchis[_erc721TokenId].equippedWearables);
            if (_validationOptions[0]) {
                // BRS
                _params = abi.encode(_params, LibAavegotchi.baseRarityScore(s.aavegotchis[_erc721TokenId].numericTraits));
            }
            if (_validationOptions[1]) {
                // GHST
                _params = abi.encode(_params, IERC20(s.ghstContract).balanceOf(s.aavegotchis[_erc721TokenId].escrow));
            }
            if (_validationOptions[2]) {
                // skill points
                _params = abi.encode(_params, s.aavegotchis[_erc721TokenId].usedSkillPoints);
            }
        }
        return keccak256(_params);
    }

    function cancelERC1155BuyOrder(uint256 _buyOrderId) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        ERC1155BuyOrder memory erc1155BuyOrder = s.erc1155BuyOrders[_buyOrderId];
        if (erc1155BuyOrder.timeCreated == 0) {
            return;
        }
        if ((erc1155BuyOrder.cancelled == true) || (erc1155BuyOrder.completed == true)) {
            return;
        }

        s.erc1155BuyOrders[_buyOrderId].cancelled = true;

        // refund GHST to buyer
        LibERC20.transfer(s.ghstContract, erc1155BuyOrder.buyer, erc1155BuyOrder.priceInWei * erc1155BuyOrder.quantity);
    }

    function validateERC1155Params(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId,
        uint256 _priceInWei,
        uint256 _quantity
    ) internal view returns (uint256 cost) {
        require(_quantity > 0, "ERC1155BuyOrder: quantity must be > 0");
        cost = _quantity * _priceInWei;
        require(cost >= 1e15, "ERC1155BuyOrder: cost should be 0.001 GHST or larger");

        require(LibSharedMarketplace.isContractWhitelisted(_erc1155TokenAddress), "ERC1155BuyOrder: contract not whitelisted");

        require(!LibSharedMarketplace.isERC1155ListingExcluded(_erc1155TokenAddress, _erc1155TokenId), "ERC1155BuyOrder: token excluded");
    }

    function validateERC721Params(
        address _erc721TokenAddress,
        uint256 _erc721TokenId,
        uint256 _category,
        uint256 _priceInWei,
        bool[] calldata _validationOptions // 0: BRS, 1: GHST, 2: skill points
    ) internal returns (uint256 cost) {
        require(_priceInWei >= 1e18, "ERC721BuyOrder: price should be 1 GHST or larger");

        // Aavegotchi-specific validation
        if (_erc721TokenAddress == address(this)) {
            AavegotchiInfo memory aavegotchiInfo = LibAavegotchi.getAavegotchi(_erc721TokenId);
            uint256 category = aavegotchiInfo.status;
            require(category == _category, "ERC721BuyOrder: Category mismatch");
            require(category != LibAavegotchi.STATUS_VRF_PENDING, "ERC721BuyOrder: Cannot buy a portal that is pending VRF");

            if (category == LibAavegotchi.STATUS_AAVEGOTCHI) {
                require(_validationOptions.length == 3, "ERC721BuyOrder: Not enough validation options for aavegotchi");
            }
        }
        address sender = LibMeta.msgSender();
        require(sender != IERC721(_erc721TokenAddress).ownerOf(_erc721TokenId), "ERC721BuyOrder: Owner can't be buyer");
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 oldBuyOrderId = s.buyerToBuyOrderId[_erc721TokenAddress][_erc721TokenId][sender];
        if (oldBuyOrderId != 0) {
            ERC721BuyOrder memory erc721BuyOrder = s.erc721BuyOrders[oldBuyOrderId];
            require(erc721BuyOrder.timeCreated != 0, "ERC721BuyOrder: ERC721 buyOrder does not exist");
            require(erc721BuyOrder.cancelled == false && erc721BuyOrder.timePurchased == 0, "ERC721BuyOrder: Already processed");
            if ((erc721BuyOrder.duration == 0) || (erc721BuyOrder.timeCreated + erc721BuyOrder.duration >= block.timestamp)) {
                LibBuyOrder.cancelERC721BuyOrder(oldBuyOrderId);
                emit ERC721BuyOrderCanceled(oldBuyOrderId, block.timestamp);
            }
        }
        return _priceInWei;
    }

    function _placeERC721BuyOrder(
        address _erc721TokenAddress,
        uint256 _erc721TokenId,
        uint256 _category,
        uint256 _priceInWei,
        uint256 _duration,
        bool[] calldata _validationOptions
    ) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        address sender = LibMeta.msgSender();
        // Place new buy order
        s.nextERC721BuyOrderId++;
        uint256 buyOrderId = s.nextERC721BuyOrderId;

        s.buyerToBuyOrderId[_erc721TokenAddress][_erc721TokenId][sender] = buyOrderId;

        bytes32 _validationHash = LibBuyOrder.generateValidationHash(_erc721TokenAddress, _erc721TokenId, _validationOptions);
        s.erc721BuyOrders[buyOrderId] = ERC721BuyOrder({
            buyOrderId: buyOrderId,
            buyer: sender,
            erc721TokenAddress: _erc721TokenAddress,
            erc721TokenId: _erc721TokenId,
            priceInWei: _priceInWei,
            validationHash: _validationHash,
            timeCreated: block.timestamp,
            timePurchased: 0,
            duration: _duration,
            cancelled: false,
            validationOptions: _validationOptions
        });
        emit ERC721BuyOrderAdded(
            buyOrderId,
            sender,
            _erc721TokenAddress,
            _erc721TokenId,
            _category,
            _priceInWei,
            _duration,
            _validationHash,
            block.timestamp
        );
        return buyOrderId;
    }

    function _placeERC1155BuyOrder(
        address _erc1155TokenAddress,
        uint256 _erc1155TokenId,
        uint256 _category,
        uint256 _priceInWei,
        uint256 _quantity,
        uint256 _duration
    ) internal returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        s.nextERC1155BuyOrderId++;
        uint256 buyOrderId = s.nextERC1155BuyOrderId;
        address sender = LibMeta.msgSender();
        s.erc1155BuyOrders[buyOrderId] = ERC1155BuyOrder({
            buyOrderId: buyOrderId,
            buyer: sender,
            erc1155TokenAddress: _erc1155TokenAddress,
            erc1155TokenId: _erc1155TokenId,
            category: _category,
            priceInWei: _priceInWei,
            quantity: _quantity,
            timeCreated: block.timestamp,
            lastTimePurchased: 0,
            duration: _duration,
            completed: false,
            cancelled: false
        });
        emit ERC1155BuyOrderAdd(
            buyOrderId,
            sender,
            _erc1155TokenAddress,
            _erc1155TokenId,
            _category,
            _priceInWei,
            _quantity,
            _duration,
            block.timestamp
        );
        return buyOrderId;
    }
}
