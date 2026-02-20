// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {Test} from "forge-std/Test.sol";
import {Modifiers} from "../../contracts/Aavegotchi/libraries/LibAppStorage.sol";
import {LibERC1155Marketplace} from "../../contracts/Aavegotchi/libraries/LibERC1155Marketplace.sol";

contract MockERC1155Balance {
    mapping(address => mapping(uint256 => uint256)) internal balances;

    function setBalance(
        address _owner,
        uint256 _id,
        uint256 _value
    ) external {
        balances[_owner][_id] = _value;
    }

    function balanceOf(address _owner, uint256 _id) external view returns (uint256) {
        return balances[_owner][_id];
    }
}

contract ERC1155MetaTxHarness is Modifiers {
    function seedListing(
        uint256 _listingId,
        address _seller,
        address _erc1155TokenAddress,
        uint256 _erc1155TypeId,
        uint256 _quantity,
        uint256 _priceInWei
    ) external {
        s.erc1155Listings[_listingId].listingId = _listingId;
        s.erc1155Listings[_listingId].seller = _seller;
        s.erc1155Listings[_listingId].erc1155TokenAddress = _erc1155TokenAddress;
        s.erc1155Listings[_listingId].erc1155TypeId = _erc1155TypeId;
        s.erc1155Listings[_listingId].quantity = _quantity;
        s.erc1155Listings[_listingId].priceInWei = _priceInWei;
        s.erc1155Listings[_listingId].timeCreated = block.timestamp;
        s.erc1155Listings[_listingId].sold = false;
        s.erc1155Listings[_listingId].cancelled = false;
    }

    function updateListing(
        uint256 _listingId,
        uint256 _quantity,
        uint256 _priceInWei
    ) external {
        LibERC1155Marketplace.updateERC1155ListingPriceAndQuantity(_listingId, _quantity, _priceInWei);
    }

    function executeAsMetaTx(
        address _user,
        uint256 _listingId,
        uint256 _quantity,
        uint256 _priceInWei
    ) external {
        bytes memory callData = abi.encodeWithSelector(this.updateListing.selector, _listingId, _quantity, _priceInWei);
        (bool success, bytes memory result) = address(this).call(abi.encodePacked(callData, _user));
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function listingPriceAndQuantity(uint256 _listingId) external view returns (uint256, uint256) {
        return (s.erc1155Listings[_listingId].priceInWei, s.erc1155Listings[_listingId].quantity);
    }
}

contract ERC1155MetaTxSellerCheckTest is Test {
    ERC1155MetaTxHarness internal harness;
    MockERC1155Balance internal token;

    address internal constant SELLER = address(0xBEEF);
    uint256 internal constant LISTING_ID = 1;
    uint256 internal constant TOKEN_ID = 7;

    function setUp() public {
        harness = new ERC1155MetaTxHarness();
        token = new MockERC1155Balance();

        token.setBalance(SELLER, TOKEN_ID, 100);
        harness.seedListing(LISTING_ID, SELLER, address(token), TOKEN_ID, 10, 1e15);
    }

    function testMetaTxSellerCanUpdateListing() public {
        harness.executeAsMetaTx(SELLER, LISTING_ID, 8, 2e15);

        (uint256 priceInWei, uint256 quantity) = harness.listingPriceAndQuantity(LISTING_ID);
        assertEq(priceInWei, 2e15);
        assertEq(quantity, 8);
    }
}
