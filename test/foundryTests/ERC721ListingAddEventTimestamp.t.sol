// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {Test} from "forge-std/Test.sol";
import {ERC721MarketplaceFacet} from "../../contracts/Aavegotchi/facets/ERC721MarketplaceFacet.sol";

contract MockERC721ListingToken {
    mapping(uint256 => address) internal owners;
    mapping(address => mapping(address => bool)) internal operatorApprovals;
    mapping(uint256 => address) internal tokenApprovals;

    function mint(address _to, uint256 _tokenId) external {
        owners[_tokenId] = _to;
    }

    function ownerOf(uint256 _tokenId) external view returns (address) {
        return owners[_tokenId];
    }

    function setApprovalForAll(address _operator, bool _approved) external {
        operatorApprovals[msg.sender][_operator] = _approved;
    }

    function isApprovedForAll(address _owner, address _operator) external view returns (bool) {
        return operatorApprovals[_owner][_operator];
    }

    function approve(address _to, uint256 _tokenId) external {
        require(msg.sender == owners[_tokenId], "MockERC721ListingToken: not owner");
        tokenApprovals[_tokenId] = _to;
    }

    function getApproved(uint256 _tokenId) external view returns (address) {
        return tokenApprovals[_tokenId];
    }
}

contract ERC721ListingAddEventTimestampTest is Test {
    event ERC721ListingAdd(
        uint256 indexed listingId,
        address indexed seller,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 indexed category,
        uint256 time
    );

    ERC721MarketplaceFacet internal marketplaceFacet;
    MockERC721ListingToken internal mockToken;

    address internal constant SELLER = address(0xBEEF);
    uint256 internal constant TOKEN_ID = 11;
    uint256 internal constant CATEGORY = 0;
    uint256 internal constant PRICE = 1 ether;

    function setUp() public {
        marketplaceFacet = new ERC721MarketplaceFacet();
        mockToken = new MockERC721ListingToken();

        mockToken.mint(SELLER, TOKEN_ID);

        vm.prank(SELLER);
        mockToken.setApprovalForAll(address(marketplaceFacet), true);
    }

    function testListingAddEventUsesTimestampFieldForTime() public {
        uint256 expectedTime = block.timestamp;

        vm.startPrank(SELLER);
        vm.expectEmit(true, true, false, true, address(marketplaceFacet));
        emit ERC721ListingAdd(1, SELLER, address(mockToken), TOKEN_ID, CATEGORY, expectedTime);

        marketplaceFacet.addERC721Listing(address(mockToken), TOKEN_ID, CATEGORY, PRICE);
        vm.stopPrank();
    }
}
