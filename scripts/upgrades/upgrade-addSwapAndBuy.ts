import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../tasks/deployUpgrade";

export async function upgradeAddSwapAndBuyERC721(
  diamondAddress: string,
  diamondOwner: string
) {
  console.log("🚀 Deploying swapAndBuyERC721 function to diamond...");

  //Networks deployed
  //Base Sepolia (but router not deployed there...)
  //Base Mainnet

  const facets: FacetsAndAddSelectors[] = [
    {
      facetName:
        "contracts/Aavegotchi/facets/ERC721MarketplaceSwapFacet.sol:ERC721MarketplaceSwapFacet",
      addSelectors: [
        "function swapAndBuyERC721(address tokenIn,uint256 swapAmount,uint256 minGhstOut,uint256 swapDeadline,uint256 listingId,address contractAddress,uint256 priceInWei,uint256 tokenId,address recipient) external",
      ],
      removeSelectors: [],
    },
    {
      facetName:
        "contracts/Aavegotchi/facets/ERC1155MarketplaceSwapFacet.sol:ERC1155MarketplaceSwapFacet",
      addSelectors: [
        "function swapAndBuyERC1155(address tokenIn, uint256 swapAmount,uint256 minGhstOut,uint256 swapDeadline,uint256 listingId,address contractAddress,uint256 itemId,uint256 quantity,uint256 priceInWei,address recipient) external",
      ],
      removeSelectors: [],
    },
  ];

  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: diamondOwner,
    diamondAddress: diamondAddress,
    facetsAndAddSelectors: joined,
    useMultisig: true,
    useLedger: false,
    useRelayer: false,
    freshDeployment: false,
  };

  await run("deployUpgrade", args);
  console.log(
    "✅ swapAndBuyERC721 and swapAndBuyERC1155 functions added to diamond!"
  );
}

// For standalone execution
if (require.main === module) {
  upgradeAddSwapAndBuyERC721(
    "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF", // Base diamond address
    "0x01F010a5e001fe9d6940758EA5e8c777885E351e" // Test account owner
  ).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
