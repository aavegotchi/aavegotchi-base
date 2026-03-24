// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {VRFV2PlusWrapperConsumerBase} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

import "../interfaces/IVRF.sol";

contract ChainlinkVrfDirectFundingAdapter is IVRFSystem, VRFV2PlusWrapperConsumerBase, ConfirmedOwner {
    struct RequestStatus {
        address callbackContract;
        uint256 traceId;
        uint256 paid;
        uint256 randomNumber;
        bool fulfilled;
        bool delivered;
    }

    uint32 public callbackGasLimit;
    uint16 public requestConfirmations;

    mapping(address => bool) public approvedConsumers;
    mapping(uint256 => RequestStatus) private s_requests;

    event RandomNumberRequested(address indexed callbackContract, uint256 indexed requestId, uint256 indexed traceId, uint256 paid);
    event RandomNumberFulfilled(address indexed callbackContract, uint256 indexed requestId, uint256 randomNumber);
    event RandomNumberDelivered(address indexed callbackContract, uint256 indexed requestId, uint256 randomNumber);
    event RandomNumberDeliveryFailed(address indexed callbackContract, uint256 indexed requestId, uint256 traceId);
    event ConsumerApprovalSet(address indexed consumer, bool approved);
    event RequestConfigUpdated(uint32 callbackGasLimit, uint16 requestConfirmations);
    event NativeWithdrawn(address indexed recipient, uint256 amount);
    event NativeReceived(address indexed sender, uint256 amount);

    constructor(
        address _vrfWrapper,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        address[] memory _approvedConsumers
    ) ConfirmedOwner(msg.sender) VRFV2PlusWrapperConsumerBase(_vrfWrapper) {
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;

        for (uint256 i; i < _approvedConsumers.length; i++) {
            _setConsumerApproval(_approvedConsumers[i], true);
        }
    }

    function requestRandomNumberWithTraceId(uint256 traceId) external override returns (uint256 requestId) {
        require(approvedConsumers[msg.sender], "ChainlinkVrfAdapter: consumer not approved");

        bytes memory extraArgs = VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: true}));
        uint256 paid;
        (requestId, paid) = requestRandomnessPayInNative(callbackGasLimit, requestConfirmations, 1, extraArgs);

        s_requests[requestId] = RequestStatus({
            callbackContract: msg.sender,
            traceId: traceId,
            paid: paid,
            randomNumber: 0,
            fulfilled: false,
            delivered: false
        });

        emit RandomNumberRequested(msg.sender, requestId, traceId, paid);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        RequestStatus storage request = s_requests[requestId];
        require(request.callbackContract != address(0), "ChainlinkVrfAdapter: request not found");
        require(randomWords.length > 0, "ChainlinkVrfAdapter: missing random word");

        request.fulfilled = true;
        request.randomNumber = randomWords[0];

        emit RandomNumberFulfilled(request.callbackContract, requestId, request.randomNumber);

        _deliverRandomNumber(requestId, request);
    }

    function retryCallback(uint256 requestId) external {
        RequestStatus storage request = s_requests[requestId];
        require(request.callbackContract != address(0), "ChainlinkVrfAdapter: request not found");
        require(request.fulfilled, "ChainlinkVrfAdapter: request not fulfilled");
        require(!request.delivered, "ChainlinkVrfAdapter: already delivered");

        _deliverRandomNumber(requestId, request);
    }

    function getRequestStatus(uint256 requestId) external view returns (RequestStatus memory) {
        return s_requests[requestId];
    }

    function estimateRequestPriceNative() external view returns (uint256) {
        return i_vrfV2PlusWrapper.calculateRequestPriceNative(callbackGasLimit, 1);
    }

    function setConsumerApproval(address consumer, bool approved) external onlyOwner {
        _setConsumerApproval(consumer, approved);
    }

    function setRequestConfig(uint32 _callbackGasLimit, uint16 _requestConfirmations) external onlyOwner {
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;

        emit RequestConfigUpdated(_callbackGasLimit, _requestConfirmations);
    }

    function withdrawNative(address payable recipient, uint256 amount) external onlyOwner {
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ChainlinkVrfAdapter: native withdraw failed");

        emit NativeWithdrawn(recipient, amount);
    }

    function _setConsumerApproval(address consumer, bool approved) internal {
        require(consumer != address(0), "ChainlinkVrfAdapter: invalid consumer");

        approvedConsumers[consumer] = approved;
        emit ConsumerApprovalSet(consumer, approved);
    }

    function _deliverRandomNumber(uint256 requestId, RequestStatus storage request) internal {
        (bool success, ) = request.callbackContract.call(
            abi.encodeWithSelector(IVRFSystemCallback.randomNumberCallback.selector, requestId, request.randomNumber)
        );

        if (!success) {
            emit RandomNumberDeliveryFailed(request.callbackContract, requestId, request.traceId);
            return;
        }

        emit RandomNumberDelivered(request.callbackContract, requestId, request.randomNumber);
        delete s_requests[requestId];
    }

    receive() external payable {
        emit NativeReceived(msg.sender, msg.value);
    }
}
