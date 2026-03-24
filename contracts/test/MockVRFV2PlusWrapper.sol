// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

interface IRawFulfillRandomWords {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

contract MockVRFV2PlusWrapper {
    struct Request {
        address caller;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
        bytes extraArgs;
        uint256 paid;
    }

    uint256 public lastRequestId;
    uint256 public requestPriceNative = 0.01 ether;
    mapping(uint256 => Request) public requests;

    function setRequestPriceNative(uint256 _requestPriceNative) external {
        requestPriceNative = _requestPriceNative;
    }

    function calculateRequestPrice(uint32, uint32) external pure returns (uint256) {
        return 0;
    }

    function calculateRequestPriceNative(uint32, uint32) external view returns (uint256) {
        return requestPriceNative;
    }

    function estimateRequestPrice(uint32, uint32, uint256) external pure returns (uint256) {
        return 0;
    }

    function estimateRequestPriceNative(uint32, uint32, uint256) external view returns (uint256) {
        return requestPriceNative;
    }

    function requestRandomWordsInNative(
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        uint32 _numWords,
        bytes calldata extraArgs
    ) external payable returns (uint256 requestId) {
        require(msg.value == requestPriceNative, "MockVRFV2PlusWrapper: wrong native price");

        requestId = ++lastRequestId;
        requests[requestId] = Request({
            caller: msg.sender,
            callbackGasLimit: _callbackGasLimit,
            requestConfirmations: _requestConfirmations,
            numWords: _numWords,
            extraArgs: extraArgs,
            paid: msg.value
        });
    }

    function fulfillRequest(uint256 requestId, uint256[] calldata randomWords) external {
        Request storage request = requests[requestId];
        require(request.caller != address(0), "MockVRFV2PlusWrapper: request not found");

        IRawFulfillRandomWords(request.caller).rawFulfillRandomWords(requestId, randomWords);
    }

    function link() external pure returns (address) {
        return address(0);
    }

    function linkNativeFeed() external pure returns (address) {
        return address(0);
    }
}
