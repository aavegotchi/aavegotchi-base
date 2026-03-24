// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import "../Aavegotchi/interfaces/IVRF.sol";

contract MockVRFSystemConsumer is IVRFSystemCallback {
    bool public shouldFail;
    uint256 public lastRequestId;
    uint256 public lastRandomNumber;
    uint256 public totalCallbacks;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function requestRandomNumber(address vrfSystem, uint256 traceId) external returns (uint256) {
        return IVRFSystem(vrfSystem).requestRandomNumberWithTraceId(traceId);
    }

    function randomNumberCallback(uint256 requestId, uint256 randomNumber) external override {
        require(!shouldFail, "MockVRFSystemConsumer: forced failure");

        lastRequestId = requestId;
        lastRandomNumber = randomNumber;
        totalCallbacks++;
    }
}
