import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../tasks/deployUpgrade";
import { PC_WALLET } from "../geistBridge/paths";
import { varsForNetwork } from "../../helpers/constants";

export async function upgradeAddSwapAndBuyOrders() {
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "BuyOrderSwapFacet",
      addSelectors: [
        "function swapAndPlaceERC721BuyOrder((address tokenIn,uint256 swapAmount,uint256 minGhstOut,uint256 swapDeadline,address erc721TokenAddress,uint256 erc721TokenId,uint256 category,uint256 priceInWei,uint256 duration,address recipient) calldata params,bool[] calldata validationOptions) external",
        "function swapAndPlaceERC1155BuyOrder((address tokenIn,uint256 swapAmount,uint256 minGhstOut,uint256 swapDeadline,address erc1155TokenAddress,uint256 erc1155TokenId,uint256 category,uint256 priceInWei,uint256 quantity,uint256 duration,address recipient) calldata params) external",
      ],
      removeSelectors: [],
    },
    {
      facetName: "ERC721BuyOrderFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "ERC1155BuyOrderFacet",
      addSelectors: [],
      removeSelectors: [],
    },

    //Marketplace Swaps
    {
      facetName: "ERC721MarketplaceSwapFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "ERC1155MarketplaceSwapFacet",
      addSelectors: [],
      removeSelectors: [],
    },
  ];

  const joined = convertFacetAndSelectorsToString(facets);
  const c = await varsForNetwork(ethers);
  const args: DeployUpgradeTaskArgs = {
    diamondOwner: PC_WALLET,
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined,
    useMultisig: false,
    useLedger: true,
    useRelayer: false,
    freshDeployment: false,
  };

  await run("deployUpgrade", args);
}

if (require.main === module) {
  upgradeAddSwapAndBuyOrders()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
