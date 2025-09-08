import { ethers, network, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import {
  buildBatchSafeTransferFromArgsFromJson,
  TokenCommitmentData,
} from "../../getTokenCommitmentData";
import { ItemsTransferFacet__factory } from "../../../typechain";
import { ItemsTransferFacetInterface } from "../../../typechain/ItemsTransferFacet";

export async function upgradeAddBatchTransferItems() {
  const c = await varsForNetwork(ethers);

  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "ItemsTransferFacet",
      addSelectors: [],
      removeSelectors: [
        "function tempCorrectItemBalances(address[] calldata _tos, uint256[][] calldata _ids, uint256[][] calldata _values) external",
      ],
    },
  ];
  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: "0x01F010a5e001fe9d6940758EA5e8c777885E351e",
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined,
    useLedger: true,
    useMultisig: false,
    useRelayer: false,
  };

  await run("deployUpgrade", args);
}

if (require.main === module) {
  upgradeAddBatchTransferItems()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
