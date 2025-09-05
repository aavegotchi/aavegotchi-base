// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.1;

//import {Counter} from "../../src/Counter.sol";
import {Constants} from "./constants.sol";
import {CollateralEscrow} from "../../contracts/Aavegotchi/CollateralEscrow.sol";
import {CollateralFacet} from "../../contracts/Aavegotchi/facets/CollateralFacet.sol";
import {AavegotchiFacet} from "../../contracts/Aavegotchi/facets/AavegotchiFacet.sol";
import {OwnershipFacet} from "../../contracts/shared/facets/OwnershipFacet.sol";
import {EscrowFacet} from "../../contracts/Aavegotchi/facets/EscrowFacet.sol";
import {DiamondLoupeFacet} from "../../contracts/shared/facets/DiamondLoupeFacet.sol";
import {IDiamondCut} from "../../contracts/shared/interfaces/IDiamondCut.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Escrowtests is Constants {
    Contracts c;
    uint256 tokenId = 3410;
    address escrowBefore;
    address finalEscrow;

    function setUp() public {
        string memory baseRpcUrl = baseMainnetRpcUrl();

        vm.createSelectFork(baseRpcUrl);
        c = contractByChainId(block.chainid);

        //prank owner
        address owner = OwnershipFacet(c.aavegotchiDiamond).owner();
        vm.startPrank(owner);

        //deploy
        CollateralFacet newCollateralFacet = new CollateralFacet();
        AavegotchiFacet newAavegotchiFacet = new AavegotchiFacet();

        //upgrade diamond
        addFunctionToDiamond(
            c.aavegotchiDiamond,
            address(newCollateralFacet),
            (CollateralFacet).collaterals.selector,
            CollateralFacet.redeployTokenEscrows.selector
        );

        addFunctionToDiamond(
            c.aavegotchiDiamond,
            address(newCollateralFacet),
            (CollateralFacet).collaterals.selector,
            CollateralFacet.setBaseRelayer.selector
        );
        replaceFunctionInDiamond(
            c.aavegotchiDiamond,
            address(newAavegotchiFacet),
            (AavegotchiFacet).transferFrom.selector,
            (AavegotchiFacet).transferFrom.selector
        );

        //set base relayer

        CollateralFacet(c.aavegotchiDiamond).setBaseRelayer(BASE_RELAYER);

        vm.startPrank(BASE_RELAYER);
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = tokenId;
        escrowBefore = EscrowFacet(c.aavegotchiDiamond).gotchiEscrow(tokenId);

        CollateralFacet(c.aavegotchiDiamond).redeployTokenEscrows(tokenIds);
        finalEscrow = EscrowFacet(c.aavegotchiDiamond).gotchiEscrow(tokenId);
        vm.stopPrank();
    }

    function test_escrowAssertion() public view {
        assertNotEq(escrowBefore, finalEscrow);
    }

    function test_diamond_approve() public {
        address fudOwner = 0x5BE66FE7E6bfFFa5AF7d9F9a3B49aE7c50CA54dF;
        vm.prank(fudOwner);
        IERC20(c.fud).transfer(finalEscrow, 10000000000000000000);
        uint fudBalanceBefore = IERC20(c.fud).balanceOf(address(this));
        //get token owner
        address owner = AavegotchiFacet(c.aavegotchiDiamond).ownerOf(tokenId);
        //we test approve fud for the diamond
        vm.prank(owner);
        EscrowFacet(c.aavegotchiDiamond).transferEscrow(tokenId, c.fud, address(this), 1);
        uint fudBalanceAfter = IERC20(c.fud).balanceOf(address(this));
        assertEq(fudBalanceAfter, fudBalanceBefore + 1);
        assertEq(IERC20(c.fud).allowance(finalEscrow, c.aavegotchiDiamond), type(uint256).max);
    }

    function test_owner_approve() public {
        address fudOwner = 0x5BE66FE7E6bfFFa5AF7d9F9a3B49aE7c50CA54dF;
        vm.prank(fudOwner);
        IERC20(c.fud).transfer(finalEscrow, 10000000000000000000);

        //get token owner
        address owner = AavegotchiFacet(c.aavegotchiDiamond).ownerOf(tokenId);
        //we test approve ffud or the diamond
        vm.prank(owner);

        CollateralEscrow(payable(finalEscrow)).approveAavegotchiDiamond(c.fud);

        assertEq(IERC20(c.fud).allowance(finalEscrow, c.aavegotchiDiamond), type(uint256).max);
    }

    function test_owner_transfer() public {
        address owner = AavegotchiFacet(c.aavegotchiDiamond).ownerOf(tokenId);
        vm.prank(owner);
        //only diamond can transfer ownership
        vm.expectRevert("CollateralEscrow: Not diamond");
        CollateralEscrow(payable(finalEscrow)).transferOwnership(address(this));

        assertEq(CollateralEscrow(payable(finalEscrow)).owner(), owner);
    }

    function test_owner_transfer_diamond() public {
        address owner = AavegotchiFacet(c.aavegotchiDiamond).ownerOf(tokenId);
        vm.prank(owner);
        AavegotchiFacet(c.aavegotchiDiamond).transferFrom(owner, address(0xdead), tokenId);
        assertEq(CollateralEscrow(payable(finalEscrow)).owner(), address(0xdead));
    }

    function addFunctionToDiamond(address diamond, address _deployedFacet, bytes4 existingFnSelector, bytes4 newSelector) internal {
        //get facet address
        address facetAddress = DiamondLoupeFacet(diamond).facetAddress(existingFnSelector);
        assert(facetAddress != address(0));
        //build cut object
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = newSelector;

        IDiamondCut.FacetCut memory facetCut = IDiamondCut.FacetCut({
            facetAddress: _deployedFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = facetCut;
        //cut diamond
        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
    }

    function replaceFunctionInDiamond(address diamond, address _deployedFacet, bytes4 existingFnSelector, bytes4 newSelector) internal {
        //get facet address
        address facetAddress = DiamondLoupeFacet(diamond).facetAddress(existingFnSelector);
        assert(facetAddress != address(0));
        //build cut object
        bytes4[] memory functionSelectors = new bytes4[](1);
        functionSelectors[0] = newSelector;
        IDiamondCut.FacetCut memory facetCut = IDiamondCut.FacetCut({
            facetAddress: _deployedFacet,
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: functionSelectors
        });

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = facetCut;
        //cut diamond
        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
    }
}
