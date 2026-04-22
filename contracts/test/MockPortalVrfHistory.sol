// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

contract MockPortalVrfHistory {
    event OpenPortals(uint256[] _tokenIds);
    event PortalOpened(uint256 indexed tokenId);

    function emitOpenPortals(uint256[] calldata tokenIds) external {
        emit OpenPortals(tokenIds);
    }

    function emitPortalOpened(uint256 tokenId) external {
        emit PortalOpened(tokenId);
    }
}
