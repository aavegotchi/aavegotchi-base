// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {IERC20} from "../shared/interfaces/IERC20.sol";
import {LibMeta} from "../shared/libraries/LibMeta.sol";

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

//Minimal version of ERC6551 without the Registry
contract CollateralEscrow {
    struct AppStorage {
        address owner;
        uint256 state;
        address token;
        uint256 tokenId;
        address diamond;
    }
    AppStorage internal s;

    constructor(address _token, uint256 _tokenId, address _owner) {
        s.token = _token;
        s.tokenId = _tokenId;
        s.owner = _owner;
        s.diamond = _token;
    }

    function approveAavegotchiDiamond(address _tokenContract) public {
        require(isOwnerOrDiamond(), "CollateralEscrow: Not owner or diamond");
        require(IERC20(_tokenContract).approve(s.diamond, type(uint256).max), "CollateralEscrow: token not approved for transfer");
    }

    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable virtual returns (bytes memory result) {
        require(_isValidSigner(msg.sender), "Invalid signer");
        ++s.state;

        bool success;
        if (operation == 0) {
            (success, result) = to.call{value: value}(data);

            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        }
        //delegate call
        else if (operation == 1) {
            require(msg.sender == s.diamond, "Only Diamond can execute delegatecall");
            (success, result) = to.delegatecall(data);
            if (!success) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            }
        } else {
            revert("Operation not supported");
        }
    }

    function isValidSigner(address signer, bytes calldata) external view virtual returns (bytes4) {
        if (_isValidSigner(signer)) {
            return IERC6551Account.isValidSigner.selector;
        }

        return bytes4(0);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view virtual returns (bytes4 magicValue) {
        bool isValid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);

        if (isValid) {
            return IERC1271.isValidSignature.selector;
        }

        return bytes4(0);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId;
    }

    function token() public view returns (uint256, address, uint256) {
        return (block.chainid, s.token, s.tokenId);
    }

    function _isValidSigner(address signer) internal view virtual returns (bool) {
        return signer == owner();
    }

    //use stored var
    function owner() public view returns (address) {
        return s.owner;
    }

    //must be either owner or diamond
    function isOwnerOrDiamond() public view returns (bool) {
        return LibMeta.msgSender() == s.owner || LibMeta.msgSender() == s.diamond;
    }

    function transferOwnership(address _newOwner) public {
        require(LibMeta.msgSender() == s.diamond, "CollateralEscrow: Not diamond");
        s.owner = _newOwner;
    }

    receive() external payable {}
}

interface IERC6551Account {
    receive() external payable;

    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);

    function state() external view returns (uint256);

    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4 magicValue);
}

interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory);
}
