// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import "../Aavegotchi/ForgeDiamond/facets/ForgeVRFFacet.sol";
import "../Aavegotchi/ForgeDiamond/libraries/ForgeLibDiamond.sol";

contract ForgeVRFFacetHarness is ForgeVRFFacet {
    constructor() {
        ForgeLibDiamond.setContractOwner(msg.sender);
    }

    function setVRFSystemHarness(address vrfSystem_) external {
        s.VRFSystem = vrfSystem_;
    }

    function setPendingRequest(address user, uint256 requestId, uint256[] calldata geodeTokenIds, uint256[] calldata amountPerToken) external {
        s.userVrfPending[user] = true;
        s.vrfUserToRequestIds[user].push(requestId);
        s.vrfRequestIdToVrfRequestInfo[requestId] = VrfRequestInfo({
            user: user,
            requestId: requestId,
            status: VrfStatus.PENDING,
            randomNumber: 0,
            geodeTokenIds: geodeTokenIds,
            amountPerToken: amountPerToken
        });
    }

    function getRequestIds(address user) external view returns (uint256[] memory) {
        return s.vrfUserToRequestIds[user];
    }

    function isUserVrfPending(address user) external view returns (bool) {
        return s.userVrfPending[user];
    }
}
