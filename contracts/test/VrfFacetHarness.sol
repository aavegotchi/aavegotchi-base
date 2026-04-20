// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import "../Aavegotchi/facets/VRFFacet.sol";
import "../shared/libraries/LibDiamond.sol";
import "../Aavegotchi/libraries/LibAavegotchi.sol";

contract VrfFacetHarness is VrfFacet {
    constructor() {
        LibDiamond.setContractOwner(msg.sender);
    }

    function setVRFSystemHarness(address vrfSystem_) external {
        s.VRFSystem = vrfSystem_;
    }

    function setPortalPending(uint256 tokenId, uint256 requestId) external {
        s.aavegotchis[tokenId].status = LibAavegotchi.STATUS_VRF_PENDING;
        s.vrfRequestIdToTokenId[requestId] = tokenId;
    }

    function portalStatus(uint256 tokenId) external view returns (uint8) {
        return s.aavegotchis[tokenId].status;
    }

    function tokenIdForRequest(uint256 requestId) external view returns (uint256) {
        return s.vrfRequestIdToTokenId[requestId];
    }
}
