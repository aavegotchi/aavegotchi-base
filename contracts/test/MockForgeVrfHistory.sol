// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

contract MockForgeVrfHistory {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);

    struct RequestInfo {
        address user;
        uint256 requestId;
        uint8 status;
        uint256 randomNumber;
        uint256[] geodeTokenIds;
        uint256[] amountPerToken;
    }

    mapping(address => RequestInfo) internal s_requests;

    function emitSingleGeodeOpen(address user, uint256 id, uint256 value, uint8 status, uint256 requestId) external {
        emit TransferSingle(msg.sender, user, address(this), id, value);

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        uint256[] memory values = new uint256[](1);
        values[0] = value;

        s_requests[user] = RequestInfo({
            user: user,
            requestId: requestId,
            status: status,
            randomNumber: 0,
            geodeTokenIds: ids,
            amountPerToken: values
        });
    }

    function emitBatchGeodeOpen(address user, uint256[] calldata ids, uint256[] calldata values, uint8 status, uint256 requestId) external {
        emit TransferBatch(msg.sender, user, address(this), ids, values);

        s_requests[user] = RequestInfo({
            user: user,
            requestId: requestId,
            status: status,
            randomNumber: 0,
            geodeTokenIds: ids,
            amountPerToken: values
        });
    }

    function getRequestInfo(address user) external view returns (RequestInfo memory) {
        require(s_requests[user].user != address(0), "MockForgeVrfHistory: no request");
        return s_requests[user];
    }
}
