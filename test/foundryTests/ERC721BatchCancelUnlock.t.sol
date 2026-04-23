// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.1;

import {Constants} from "./constants.sol";

import {CollateralEscrow} from "../../contracts/Aavegotchi/CollateralEscrow.sol";
import {AavegotchiFacet} from "../../contracts/Aavegotchi/facets/AavegotchiFacet.sol";
import {AavegotchiGameFacet} from "../../contracts/Aavegotchi/facets/AavegotchiGameFacet.sol";
import {ERC721MarketplaceFacet} from "../../contracts/Aavegotchi/facets/ERC721MarketplaceFacet.sol";
import {EscrowFacet} from "../../contracts/Aavegotchi/facets/EscrowFacet.sol";
import {MarketplaceGetterFacet} from "../../contracts/Aavegotchi/facets/MarketplaceGetterFacet.sol";
import {Modifiers, ERC721Listing} from "../../contracts/Aavegotchi/libraries/LibAppStorage.sol";
import {DiamondLoupeFacet} from "../../contracts/shared/facets/DiamondLoupeFacet.sol";
import {OwnershipFacet} from "../../contracts/shared/facets/OwnershipFacet.sol";
import {IDiamondCut} from "../../contracts/shared/interfaces/IDiamondCut.sol";

/// @dev Test-only facet used to seed listing + gotchi locked state without calling addERC721Listing,
/// which is extremely slow on forks (LibAavegotchi.getAavegotchi causes many storage reads).
contract ERC721BatchCancelUnlockSeederFacet is Modifiers {
    function seedERC721AavegotchiListing(
        uint256 listingId,
        uint256 tokenId,
        address seller,
        uint256 priceInWei
    ) external onlyOwner returns (address escrow) {
        require(s.erc721Listings[listingId].timeCreated == 0, "seed: listing already exists");

        // Deploy a fresh escrow so we can deterministically verify the ownership transfer behavior.
        escrow = address(new CollateralEscrow(address(this), tokenId, seller));
        s.aavegotchis[tokenId].escrow = escrow;

        // Mimic the listing side effects for category 3 (claimed Aavegotchi).
        s.aavegotchis[tokenId].locked = true;
        CollateralEscrow(payable(escrow)).transferOwnership(address(0));

        s.erc721TokenToListingId[address(this)][tokenId][seller] = listingId;
        s.erc721Listings[listingId] = ERC721Listing({
            listingId: listingId,
            seller: seller,
            erc721TokenAddress: address(this),
            erc721TokenId: tokenId,
            category: 3,
            priceInWei: priceInWei,
            timeCreated: block.timestamp,
            timePurchased: 0,
            cancelled: false,
            principalSplit: [uint16(10000), uint16(0)],
            affiliate: address(0),
            whitelistId: 0
        });
    }
}

contract ERC721BatchCancelUnlockTest is Constants {
    Contracts c;

    uint256 constant TOKEN_ID = 3410;
    uint256 constant LISTING_ID = 999_999_999;
    uint256 constant PRICE_IN_WEI = 1e18;

    address owner;
    address seller;
    address escrow;

    function setUp() public {
        vm.createSelectFork(baseMainnetRpcUrl());
        c = contractByChainId(block.chainid);

        owner = OwnershipFacet(c.aavegotchiDiamond).owner();
        seller = AavegotchiFacet(c.aavegotchiDiamond).ownerOf(TOKEN_ID);

        vm.startPrank(owner);

        // Replace the selector with the patched facet (PR #41).
        ERC721MarketplaceFacet newMarketplaceFacet = new ERC721MarketplaceFacet();
        replaceFunctionInDiamond(
            c.aavegotchiDiamond,
            address(newMarketplaceFacet),
            ERC721MarketplaceFacet.cancelERC721Listings.selector,
            ERC721MarketplaceFacet.cancelERC721Listings.selector
        );

        // Add the test-only seeder facet.
        ERC721BatchCancelUnlockSeederFacet seederFacet = new ERC721BatchCancelUnlockSeederFacet();
        addFunctionToDiamond(
            c.aavegotchiDiamond,
            address(seederFacet),
            ERC721MarketplaceFacet.cancelERC721Listings.selector,
            ERC721BatchCancelUnlockSeederFacet.seedERC721AavegotchiListing.selector
        );

        escrow = ERC721BatchCancelUnlockSeederFacet(c.aavegotchiDiamond).seedERC721AavegotchiListing(
            LISTING_ID,
            TOKEN_ID,
            seller,
            PRICE_IN_WEI
        );

        vm.stopPrank();
    }

    function test_adminBatchCancel_unlocksGotchi_and_restoresEscrowOwner() public {
        assertTrue(AavegotchiGameFacet(c.aavegotchiDiamond).isAavegotchiLocked(TOKEN_ID));
        assertEq(EscrowFacet(c.aavegotchiDiamond).gotchiEscrow(TOKEN_ID), escrow);
        assertEq(CollateralEscrow(payable(escrow)).owner(), address(0));
        assertEq(MarketplaceGetterFacet(c.aavegotchiDiamond).getERC721Listing(LISTING_ID).seller, seller);

        uint256[] memory listingIds = new uint256[](1);
        listingIds[0] = LISTING_ID;

        vm.prank(owner);
        ERC721MarketplaceFacet(c.aavegotchiDiamond).cancelERC721Listings(listingIds);

        assertFalse(AavegotchiGameFacet(c.aavegotchiDiamond).isAavegotchiLocked(TOKEN_ID));
        assertEq(CollateralEscrow(payable(escrow)).owner(), seller);
        assertTrue(MarketplaceGetterFacet(c.aavegotchiDiamond).getERC721Listing(LISTING_ID).cancelled);
    }

    function addFunctionToDiamond(address diamond, address deployedFacet, bytes4 existingFnSelector, bytes4 newSelector) internal {
        address facetAddress = DiamondLoupeFacet(diamond).facetAddress(existingFnSelector);
        assert(facetAddress != address(0));

        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = newSelector;

        IDiamondCut.FacetCut memory facetCut = IDiamondCut.FacetCut({
            facetAddress: deployedFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = facetCut;

        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
    }

    function replaceFunctionInDiamond(address diamond, address deployedFacet, bytes4 existingFnSelector, bytes4 newSelector) internal {
        address facetAddress = DiamondLoupeFacet(diamond).facetAddress(existingFnSelector);
        assert(facetAddress != address(0));

        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = newSelector;

        IDiamondCut.FacetCut memory facetCut = IDiamondCut.FacetCut({
            facetAddress: deployedFacet,
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: functionSelectors
        });

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = facetCut;

        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
    }
}

