// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {LibAppStorage, AppStorage, ListingListItem, ERC721Listing} from "./LibAppStorage.sol";
import {LibAavegotchi} from "./LibAavegotchi.sol";
import {LibBuyOrder} from "./LibBuyOrder.sol";
import {LibMeta} from "../../shared/libraries/LibMeta.sol";
import {BaazaarSplit, LibSharedMarketplace, SplitAddresses} from "./LibSharedMarketplace.sol";
import {IERC721} from "../../shared/interfaces/IERC721.sol";
import {IERC20} from "../../shared/interfaces/IERC20.sol";
import {IERC165} from "../../shared/interfaces/IERC165.sol";
import {IERC2981} from "../../shared/interfaces/IERC2981.sol";

// Multi Royalty interface
interface IMultiRoyalty {
    function multiRoyaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address[] memory, uint256[] memory);
}

library LibERC721Marketplace {
    event ERC721ListingCancelled(uint256 indexed listingId, uint256 category, uint256 time);
    event ERC721ListingRemoved(uint256 indexed listingId, uint256 category, uint256 time);
    event ERC721ListingPriceUpdate(uint256 indexed listingId, uint256 priceInWei, uint256 time);

    event ERC721ExecutedListing(
        uint256 indexed listingId,
        address indexed seller,
        address buyer,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 indexed category,
        uint256 priceInWei,
        uint256 time
    );

    event ERC721ExecutedToRecipient(uint256 indexed listingId, address indexed buyer, address indexed recipient);

    function cancelERC721Listing(uint256 _listingId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        // ListingListItem storage listingItem = s.erc721ListingListItem[_listingId];
        // if (listingItem.listingId == 0) {
        // return;
        // }
        ERC721Listing storage listing = s.erc721Listings[_listingId];
        if (listing.cancelled == true || listing.timePurchased != 0 || listing.timeCreated == 0) {
            return;
        }
        require(listing.seller == _owner, "Marketplace: owner not seller");
        listing.cancelled = true;

        //Unlock Aavegotchis when listing is created
        if (listing.erc721TokenAddress == address(this)) {
            s.aavegotchis[listing.erc721TokenId].locked = false;
        }

        emit ERC721ListingCancelled(_listingId, listing.category, block.number);
        removeERC721ListingItem(_listingId, _owner);
    }

    function cancelERC721Listing(address _erc721TokenAddress, uint256 _erc721TokenId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 listingId = s.erc721TokenToListingId[_erc721TokenAddress][_erc721TokenId][_owner];
        if (listingId == 0) {
            return;
        }
        cancelERC721Listing(listingId, _owner);
    }

    function removeERC721ListingItem(uint256 _listingId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC721Listing storage listing = s.erc721Listings[_listingId];
        if (listing.timeCreated != 0) {
            emit ERC721ListingRemoved(_listingId, listing.category, block.timestamp);
        }
    }

    function updateERC721Listing(address _erc721TokenAddress, uint256 _erc721TokenId, address _owner) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        uint256 listingId = s.erc721TokenToListingId[_erc721TokenAddress][_erc721TokenId][_owner];
        if (listingId == 0) {
            return;
        }
        ERC721Listing storage listing = s.erc721Listings[listingId];
        if (listing.timePurchased != 0 || listing.cancelled == true) {
            return;
        }
        address owner = IERC721(listing.erc721TokenAddress).ownerOf(listing.erc721TokenId);
        if (owner != listing.seller) {
            LibERC721Marketplace.cancelERC721Listing(listingId, listing.seller);
        }
    }

    function updateERC721ListingPrice(uint256 _listingId, uint256 _priceInWei) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC721Listing storage listing = s.erc721Listings[_listingId];
        require(listing.timeCreated != 0, "ERC721Marketplace: listing not found");
        require(listing.timePurchased == 0, "ERC721Marketplace: listing already sold");
        require(listing.cancelled == false, "ERC721Marketplace: listing already cancelled");
        require(listing.seller == LibMeta.msgSender(), "ERC721Marketplace: Not seller of ERC721 listing");

        //comment out until graph event is added
        // s.erc721Listings[_listingId].priceInWei = _priceInWei;

        emit ERC721ListingPriceUpdate(_listingId, _priceInWei, block.timestamp);
    }

    /// @notice Execute an ERC721 listing purchase
    /// @dev Can be called from regular marketplace or swap facet
    /// @param _listingId The identifier of the listing to execute
    /// @param _contractAddress The token contract address
    /// @param _priceInWei The expected price of the item in GHST
    /// @param _tokenId The tokenID of the item
    /// @param _recipient The address to receive the NFT
    /// @param _buyer The address paying for the NFT (can be different from recipient)
    function executeERC721Listing(
        uint256 _listingId,
        address _contractAddress,
        uint256 _priceInWei,
        uint256 _tokenId,
        address _recipient,
        address _buyer
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();
        ERC721Listing storage listing = s.erc721Listings[_listingId];

        require(listing.timePurchased == 0, "ERC721Marketplace: listing already sold");
        require(listing.cancelled == false, "ERC721Marketplace: listing cancelled");
        require(listing.timeCreated != 0, "ERC721Marketplace: listing not found");
        require(listing.erc721TokenId == _tokenId, "ERC721Marketplace: Incorrect tokenID");
        require(listing.erc721TokenAddress == _contractAddress, "ERC721Marketplace: Incorrect token address");
        require(listing.priceInWei == _priceInWei, "ERC721Marketplace: Incorrect price");

        address seller = listing.seller;
        require(seller != _buyer, "ERC721Marketplace: Buyer can't be seller");

        // Check GHST balance for regular purchases (swap facet handles this differently)
        if (_buyer != address(this)) {
            require(IERC20(s.ghstContract).balanceOf(_buyer) >= _priceInWei, "ERC721Marketplace: Not enough GHST");
        }

        if (listing.whitelistId > 0) {
            require(s.isWhitelisted[listing.whitelistId][_buyer] > 0, "ERC721Marketplace: Not whitelisted address");
        }

        listing.timePurchased = block.timestamp;
        removeERC721ListingItem(_listingId, seller);

        // Handle royalties
        address[] memory royalties;
        uint256[] memory royaltyShares;
        if (IERC165(_contractAddress).supportsInterface(0x2a55205a)) {
            // EIP-2981 supported
            royalties = new address[](1);
            royaltyShares = new uint256[](1);
            (royalties[0], royaltyShares[0]) = IERC2981(_contractAddress).royaltyInfo(_tokenId, _priceInWei);
        } else if (IERC165(_contractAddress).supportsInterface(0x24d34933)) {
            // Multi Royalty Standard supported
            (royalties, royaltyShares) = IMultiRoyalty(_contractAddress).multiRoyaltyInfo(_tokenId, _priceInWei);
        }

        // Handle legacy listings -- if affiliate is not set, use 100-0 split
        BaazaarSplit memory split = LibSharedMarketplace.getBaazaarSplit(
            _priceInWei,
            royaltyShares,
            listing.affiliate == address(0) ? [10000, 0] : listing.principalSplit
        );

        LibSharedMarketplace.transferSales(
            SplitAddresses({
                ghstContract: s.ghstContract,
                buyer: _buyer,
                seller: seller,
                affiliate: listing.affiliate,
                royalties: royalties,
                daoTreasury: s.daoTreasury,
                pixelCraft: s.pixelCraft,
                rarityFarming: s.rarityFarming
            }),
            split
        );

        // Transfer NFT
        if (listing.erc721TokenAddress == address(this)) {
            s.aavegotchis[listing.erc721TokenId].locked = false;
            LibAavegotchi.transfer(seller, _recipient, listing.erc721TokenId);
        } else {
            // External contracts
            IERC721(listing.erc721TokenAddress).safeTransferFrom(seller, _recipient, listing.erc721TokenId);
        }

        // Cancel existing buy order if it exists for the buyer
        uint256 buyerBuyOrderId = s.buyerToBuyOrderId[listing.erc721TokenAddress][listing.erc721TokenId][_buyer];
        if (buyerBuyOrderId != 0) {
            LibBuyOrder.cancelERC721BuyOrder(buyerBuyOrderId);
        }

        emit ERC721ExecutedListing(
            _listingId,
            seller,
            _recipient,
            listing.erc721TokenAddress,
            listing.erc721TokenId,
            listing.category,
            listing.priceInWei,
            block.timestamp
        );

        // Don't emit the event if the buyer is the same as recipient
        if (_buyer != _recipient) {
            emit ERC721ExecutedToRecipient(_listingId, _buyer, _recipient);
        }
    }
}
