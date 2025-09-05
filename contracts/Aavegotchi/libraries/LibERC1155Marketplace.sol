// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage, ListingListItem, ERC1155Listing} from "./LibAppStorage.sol";
import {BaazaarSplit, LibSharedMarketplace, SplitAddresses} from "./LibSharedMarketplace.sol";
import {LibItems} from "./LibItems.sol";
import {LibERC1155} from "../../shared/libraries/LibERC1155.sol";
import {LibMeta} from "../../shared/libraries/LibMeta.sol";
import {IERC1155} from "../../shared/interfaces/IERC1155.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import "../WearableDiamond/interfaces/IEventHandlerFacet.sol";

library LibERC1155Marketplace {
    event ERC1155ListingCancelled(uint256 indexed listingId, uint256 category, uint256 time);
    event ERC1155ListingRemoved(uint256 indexed listingId, uint256 category, uint256 time);
    event UpdateERC1155Listing(uint256 indexed listingId, uint256 quantity, uint256 priceInWei, uint256 time);

    event ERC1155ExecutedListing(
        uint256 indexed listingId,
        address indexed seller,
        address buyer,
        address erc1155TokenAddress,
        uint256 erc1155TypeId,
        uint256 indexed category,
        uint256 quantity,
        uint256 priceInWei,
        uint256 time
    );

    event ERC1155ExecutedToRecipient(uint256 indexed listingId, address indexed buyer, address indexed recipient);

    function cancelERC1155Listing(uint256 _listingId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC1155Listing storage listing = s.erc1155Listings[_listingId];
        if (listing.timeCreated == 0) {
            return;
        }
        if (listing.cancelled == true || listing.sold == true) {
            return;
        }
        require(listing.seller == _owner, "Marketplace: owner not seller");
        listing.cancelled = true;
        emit ERC1155ListingCancelled(_listingId, listing.category, block.number);
        removeERC1155ListingItem(_listingId, _owner);
    }

    function addERC1155ListingItem(
        address _erc1155TokenAddress,
        address _owner,
        uint256 _category,
        string memory _sort,
        uint256 _listingId
    ) internal {
        // Deprecated: On-chain views are replaced by subgraphs
    }

    function removeERC1155ListingItem(uint256 _listingId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC1155Listing storage listing = s.erc1155Listings[_listingId];
        if (listing.timeCreated != 0) {
            s.erc1155TokenToListingId[listing.erc1155TokenAddress][listing.erc1155TypeId][_owner] = 0;
            emit ERC1155ListingRemoved(_listingId, listing.category, block.timestamp);
        }
    }

    function updateERC1155Listing(address _erc1155TokenAddress, uint256 _erc1155TypeId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 listingId = s.erc1155TokenToListingId[_erc1155TokenAddress][_erc1155TypeId][_owner];
        if (listingId == 0) {
            return;
        }
        ERC1155Listing storage listing = s.erc1155Listings[listingId];
        if (listing.timeCreated == 0 || listing.cancelled == true || listing.sold == true) {
            return;
        }
        uint256 quantity = listing.quantity;
        if (quantity > 0) {
            quantity = IERC1155(listing.erc1155TokenAddress).balanceOf(listing.seller, listing.erc1155TypeId);
            if (quantity < listing.quantity) {
                listing.quantity = quantity;
                emit UpdateERC1155Listing(listingId, quantity, listing.priceInWei, block.timestamp);
            }
        }
        if (quantity == 0) {
            cancelERC1155Listing(listingId, listing.seller);
        }
    }

    function updateERC1155ListingPriceAndQuantity(uint256 _listingId, uint256 _quantity, uint256 _priceInWei) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC1155Listing storage listing = s.erc1155Listings[_listingId];
        require(listing.timeCreated != 0, "ERC1155Marketplace: listing not found");
        require(listing.sold == false, "ERC1155Marketplace: listing is sold out");
        require(listing.cancelled == false, "ERC1155Marketplace: listing already cancelled");
        require(_quantity * _priceInWei >= 1e15, "ERC1155Marketplace: cost should be 0.001 GHST or larger");
        require(listing.seller == msg.sender, "ERC1155Marketplace: Not seller of ERC1155 listing");
        require(
            IERC1155(listing.erc1155TokenAddress).balanceOf(listing.seller, listing.erc1155TypeId) >= _quantity,
            "ERC1155Marketplace: Not enough ERC1155 token"
        );

        listing.priceInWei = _priceInWei;
        listing.quantity = _quantity;

        emit UpdateERC1155Listing(_listingId, _quantity, _priceInWei, block.timestamp);
    }

    /// @notice Execute an ERC1155 listing purchase
    /// @dev Can be called from regular marketplace or swap facet
    /// @param _listingId The identifier of the listing to execute
    /// @param _contractAddress The ERC1155 contract address
    /// @param _itemId The ERC1155 token ID
    /// @param _quantity The amount of items to purchase
    /// @param _priceInWei The expected price per item in GHST
    /// @param _recipient The address to receive the items
    /// @param _buyer The address paying for the items (can be different from recipient)
    function executeERC1155Listing(
        uint256 _listingId,
        address _contractAddress,
        uint256 _itemId,
        uint256 _quantity,
        uint256 _priceInWei,
        address _recipient,
        address _buyer
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC1155Listing storage listing = s.erc1155Listings[_listingId];

        require(listing.timeCreated != 0, "ERC1155Marketplace: listing not found");
        require(listing.sold == false, "ERC1155Marketplace: listing is sold out");
        require(listing.cancelled == false, "ERC1155Marketplace: listing is cancelled");
        require(_priceInWei == listing.priceInWei, "ERC1155Marketplace: wrong price or price changed");
        require(listing.erc1155TokenAddress == _contractAddress, "ERC1155Marketplace: Incorrect token address");
        require(listing.erc1155TypeId == _itemId, "ERC1155Marketplace: Incorrect token id");

        address seller = listing.seller;
        require(seller != _buyer, "ERC1155Marketplace: buyer can't be seller");

        if (listing.whitelistId > 0) {
            require(s.isWhitelisted[listing.whitelistId][_buyer] > 0, "ERC1155Marketplace: Not whitelisted address");
        }

        require(_quantity > 0, "ERC1155Marketplace: _quantity can't be zero");
        require(_quantity <= listing.quantity, "ERC1155Marketplace: quantity is greater than listing");

        listing.quantity -= _quantity;

        {
            // Payment handling in separate scope to reduce stack depth
            uint256 cost = _quantity * _priceInWei;

            // Check GHST balance and allowance for regular purchases (swap facet handles this differently)
            if (_buyer != address(this)) {
                require(IERC20(s.ghstContract).balanceOf(_buyer) >= cost, "ERC1155Marketplace: not enough GHST");
                require(IERC20(s.ghstContract).allowance(_buyer, address(this)) >= cost, "ERC1155Marketplace: not enough GHST allowance");
            }

            // Handle payment distribution
            BaazaarSplit memory split = LibSharedMarketplace.getBaazaarSplit(
                cost,
                new uint256[](0),
                listing.affiliate == address(0) ? [10000, 0] : listing.principalSplit
            );

            LibSharedMarketplace.transferSales(
                SplitAddresses({
                    ghstContract: s.ghstContract,
                    buyer: _buyer,
                    seller: seller,
                    affiliate: listing.affiliate,
                    royalties: new address[](0),
                    daoTreasury: s.daoTreasury,
                    pixelCraft: s.pixelCraft,
                    rarityFarming: s.rarityFarming
                }),
                split
            );
        }

        {
            // Update listing timestamp and create purchase record in separate scope
            listing.timeLastPurchased = block.timestamp;
            s.nextERC1155ListingId++;
            uint256 purchaseListingId = s.nextERC1155ListingId;
            s.erc1155Listings[purchaseListingId] = ERC1155Listing({
                listingId: purchaseListingId,
                seller: seller,
                erc1155TokenAddress: listing.erc1155TokenAddress,
                erc1155TypeId: listing.erc1155TypeId,
                category: listing.category,
                quantity: _quantity,
                priceInWei: _priceInWei,
                timeCreated: block.timestamp,
                timeLastPurchased: block.timestamp,
                sourceListingId: _listingId,
                sold: true,
                cancelled: false,
                principalSplit: listing.principalSplit,
                affiliate: listing.affiliate,
                whitelistId: listing.whitelistId
            });

            // Mark listing as sold if all quantity is purchased
            if (listing.quantity == 0) {
                listing.sold = true;
                removeERC1155ListingItem(_listingId, seller);
            }
        }

        // Transfer items
        if (listing.erc1155TokenAddress == address(this)) {
            LibItems.removeFromOwner(seller, listing.erc1155TypeId, _quantity);
            LibItems.addToOwner(_recipient, listing.erc1155TypeId, _quantity);
            IEventHandlerFacet(s.wearableDiamond).emitTransferSingleEvent(address(this), seller, _recipient, listing.erc1155TypeId, _quantity);
            LibERC1155.onERC1155Received(address(this), seller, _recipient, listing.erc1155TypeId, _quantity, "");
        } else {
            // External contracts
            IERC1155(listing.erc1155TokenAddress).safeTransferFrom(seller, _recipient, listing.erc1155TypeId, _quantity, new bytes(0));
        }

        {
            // Emit events in a new scope to avoid stack too deep
            emit ERC1155ExecutedListing(
                _listingId,
                seller,
                _recipient,
                listing.erc1155TokenAddress,
                listing.erc1155TypeId,
                listing.category,
                _quantity,
                listing.priceInWei,
                block.timestamp
            );

            // Don't emit the event if the buyer is the same as recipient
            if (_buyer != _recipient) {
                emit ERC1155ExecutedToRecipient(_listingId, _buyer, _recipient);
            }
        }
    }
}
