import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import { CollateralFacet__factory } from "../../../typechain";
import { PC_WALLET } from "../../geistBridge/paths";

export async function upgrade() {
  console.log("Deploying forge pet fix");
  const c = await varsForNetwork(ethers);
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "EscrowFacet",
      addSelectors: [
        "function fixOldLendingsAndSettleAlchemica(uint256[] calldata _lendingIds,address[] calldata _oldEscrows,address[] calldata _alchemicaAddresses ) external",
      ], //no new selectors, just updating batchDepositGHST function
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
