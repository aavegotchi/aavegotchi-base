// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import "../Aavegotchi/interfaces/IVRF.sol";

contract MockVrfSystem is IVRFSystem {
    uint256 public nextRequestId = 1;
    uint256 public lastTraceId;

    function requestRandomNumberWithTraceId(uint256 traceId) external override returns (uint256 requestId) {
        lastTraceId = traceId;
        requestId = nextRequestId;
        nextRequestId++;
    }
}
