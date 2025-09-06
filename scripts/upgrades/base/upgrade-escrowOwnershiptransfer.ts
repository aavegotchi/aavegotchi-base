import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import { PC_WALLET } from "../../geistBridge/paths";

export async function upgrade() {
  const c = await varsForNetwork(ethers);
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "AavegotchiFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "AavegotchiGameFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "ERC721BuyOrderFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "GotchiLendingFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "GotchiLendingFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "ERC721MarketplaceFacet",
      addSelectors: [],
      removeSelectors: [],
    },
  ];

  const joined1 = convertFacetAndSelectorsToString(facets);

  const args1: DeployUpgradeTaskArgs = {
    diamondOwner: PC_WALLET,
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined1,
    useLedger: true,
    useRelayer: false,
    useMultisig: false,
    initAddress: ethers.constants.AddressZero,
    initCalldata: "0x",
  };

  await run("deployUpgrade", args1);
}

if (require.main === module) {
  upgrade()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
