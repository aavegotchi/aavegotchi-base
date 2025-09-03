import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { getLedgerSigner } from "../../helperFunctions";

import { varsForNetwork } from "../../../helpers/constants";

export async function upgradeForgeWriteFacet() {
  const c = await varsForNetwork(ethers);

  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "ForgeFacet",
      addSelectors: ["function gltrContract() public"],
      removeSelectors: [],
    },
  ];
  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: "0x01F010a5e001fe9d6940758EA5e8c777885E351e",
    diamondAddress: c.forgeDiamond!,
    facetsAndAddSelectors: joined,
    useLedger: true,
    useMultisig: false,
    useRelayer: false,
  };

  await run("deployUpgrade", args);

  //also set the vrf system that was not set in the constructor

  const forgeVrfFacet = await ethers.getContractAt(
    "ForgeFacet",
    c.forgeDiamond!
  );
  const gltrAddress = await forgeVrfFacet.gltrContract();
  console.log("gltr:", gltrAddress);
}

if (require.main === module) {
  upgradeForgeWriteFacet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
