import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../tasks/deployUpgrade";

export async function upgradeAddSwapAndBuyERC1155() {
  console.log("🚀 Deploying swapAndBuyERC1155 function to diamond...");

  const diamondAddress = "0xA99c4B08201F2913Db8D28e71d020c4298F29dBF";
  const diamondOwner = "0x01F010a5e001fe9d6940758EA5e8c777885E351e";

  // Deploy the facet first to get selectors automatically
  const SwapFacet = await ethers.getContractFactory(
    "ERC1155MarketplaceSwapFacet"
  );
  const swapFacet = await SwapFacet.deploy();
  await swapFacet.deployed();

  console.log(`📝 Deployed facet at: ${swapFacet.address}`);

  const facets: FacetsAndAddSelectors[] = [
    {
      facetName:
        "contracts/Aavegotchi/facets/ERC1155MarketplaceSwapFacet.sol:ERC1155MarketplaceSwapFacet",
      addSelectors: [
        "function swapAndBuyERC1155(address tokenIn,uint256 swapAmount,uint256 minGhstOut,uint256 swapDeadline,uint256 listingId,address contractAddress,uint256 itemId,uint256 quantity,uint256 priceInWei,address recipient) external",
      ],
      removeSelectors: [],
    },
  ];

  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: diamondOwner,
    diamondAddress: diamondAddress,
    facetsAndAddSelectors: joined,
    useMultisig: false,
    useLedger: false,
  };

  await ethers.provider.send("hardhat_impersonateAccount", [diamondOwner]);
  console.log("impersonated!");

  await run("deployUpgrade", args);

  console.log("✅ swapAndBuyERC1155 function added to diamond!");
  return true;
}

export default upgradeAddSwapAndBuyERC1155;

if (require.main === module) {
  upgradeAddSwapAndBuyERC1155()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
