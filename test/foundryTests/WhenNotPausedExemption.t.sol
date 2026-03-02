// SPDX-License-Identifier: MIT
pragma solidity 0.8.1;

import {Test} from "forge-std/Test.sol";
import {Modifiers} from "../../contracts/Aavegotchi/libraries/LibAppStorage.sol";
import {LibDiamond} from "../../contracts/shared/libraries/LibDiamond.sol";

contract WhenNotPausedHarness is Modifiers {
    function setContractOwner(address _owner) external {
        LibDiamond.setContractOwner(_owner);
    }

    function setRelayerPetter(address _relayerPetter) external {
        s.relayerPetter = _relayerPetter;
    }

    function setDiamondPaused(bool _paused) external {
        s.diamondPaused = _paused;
    }

    function gatedAction() external whenNotPaused returns (uint256) {
        return 1;
    }
}

contract WhenNotPausedExemptionTest is Test {
    WhenNotPausedHarness internal harness;

    address internal constant OWNER = address(0xBEEF);
    address internal constant RELAYER_PETTER = address(0xCAFE);
    address internal constant RANDOM_USER = address(0x1234);

    function setUp() public {
        harness = new WhenNotPausedHarness();
        harness.setContractOwner(OWNER);
        harness.setRelayerPetter(RELAYER_PETTER);
        harness.setDiamondPaused(true);
    }

    function testOwnerIsExemptFromPause() public {
        vm.prank(OWNER);
        uint256 result = harness.gatedAction();
        assertEq(result, 1);
    }

    function testNonExemptUserStillBlockedWhenPaused() public {
        vm.prank(RANDOM_USER);
        vm.expectRevert("AppStorage: Diamond paused");
        harness.gatedAction();
    }
}
