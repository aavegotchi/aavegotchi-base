// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.1;

import {Constants} from "./constants.sol";
import {OwnershipFacet} from "../../contracts/shared/facets/OwnershipFacet.sol";
import {DiamondLoupeFacet} from "../../contracts/shared/facets/DiamondLoupeFacet.sol";
import {IDiamondCut} from "../../contracts/shared/interfaces/IDiamondCut.sol";
import {ERC1155MarketplaceFacet} from "../../contracts/Aavegotchi/facets/ERC1155MarketplaceFacet.sol";
import {ERC721MarketplaceFacet} from "../../contracts/Aavegotchi/facets/ERC721MarketplaceFacet.sol";
import {MarketplaceGetterFacet} from "../../contracts/Aavegotchi/facets/MarketplaceGetterFacet.sol";
import {ERC721Listing} from "../../contracts/Aavegotchi/libraries/LibERC721Marketplace.sol";
import {ERC721WithRoyalties} from "../../contracts/test/ERC721WithRoyalties.sol";

contract ERC721ListingPriceUpdateTest is Constants {
    event ERC721ListingPriceUpdate(uint256 indexed listingId, uint256 priceInWei, uint256 time);

    Contracts c;
    address diamondOwner;

    address seller;
    ERC721WithRoyalties mockErc721;
    uint256 tokenId;
    uint256 listingId;

    function setUp() public {
        vm.createSelectFork(baseMainnetRpcUrl());
        c = contractByChainId(block.chainid);

        diamondOwner = OwnershipFacet(c.aavegotchiDiamond).owner();

        // Remove listing fee requirements for the test to stay self-contained.
        vm.startPrank(diamondOwner);
        ERC1155MarketplaceFacet(c.aavegotchiDiamond).setListingFee(0);

        // Upgrade only the selector under test to use the fixed LibERC721Marketplace implementation.
        ERC721MarketplaceFacet patchedFacet = new ERC721MarketplaceFacet();
        _replaceSelector(c.aavegotchiDiamond, address(patchedFacet), ERC721MarketplaceFacet.updateERC721ListingPrice.selector);
        vm.stopPrank();

        seller = makeAddr("seller");

        // Deploy a simple ERC721 on the fork and list it on the Baazaar.
        mockErc721 = new ERC721WithRoyalties("Mock ERC721", "MOCK");
        tokenId = 0;
        mockErc721.mint(seller, address(0), 0);

        vm.startPrank(seller);
        mockErc721.approve(c.aavegotchiDiamond, tokenId);
        ERC721MarketplaceFacet(c.aavegotchiDiamond).addERC721Listing(address(mockErc721), tokenId, 0, 1e18);
        vm.stopPrank();

        ERC721Listing memory listing = MarketplaceGetterFacet(c.aavegotchiDiamond).getERC721ListingFromToken(
            address(mockErc721),
            tokenId,
            seller
        );
        listingId = listing.listingId;
    }

    function test_updateERC721ListingPrice_persistsNewPrice() public {
        uint256 newPrice = 2e18;

        vm.startPrank(seller);

        uint256 nowTs = block.timestamp;
        vm.expectEmit(true, false, false, true, c.aavegotchiDiamond);
        emit ERC721ListingPriceUpdate(listingId, newPrice, nowTs);

        ERC721MarketplaceFacet(c.aavegotchiDiamond).updateERC721ListingPrice(listingId, newPrice);

        vm.stopPrank();

        ERC721Listing memory listing = MarketplaceGetterFacet(c.aavegotchiDiamond).getERC721Listing(listingId);
        assertEq(listing.priceInWei, newPrice);
    }

    function _replaceSelector(address diamond, address deployedFacet, bytes4 selector) internal {
        address existingFacet = DiamondLoupeFacet(diamond).facetAddress(selector);
        require(existingFacet != address(0), "selector missing on diamond");

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = selector;

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: deployedFacet,
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
    }
}

