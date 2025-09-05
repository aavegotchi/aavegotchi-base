import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import { CollateralFacet__factory } from "../../../typechain";

export async function upgradeForgeDiamondForPet() {
  console.log("Deploying forge pet fix");
  const c = await varsForNetwork(ethers);
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "CollateralFacet",
      addSelectors: [
        "function redeployTokenEscrows(uint256[] calldata _tokenIds) external",
        "function setBaseRelayer(address _baseRelayer) external",
      ],
      removeSelectors: [],
    },
    {
      facetName: "AavegotchiGameFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "AavegotchiFacet",
      addSelectors: [],
      removeSelectors: [],
    },
  ];

  const joined1 = convertFacetAndSelectorsToString(facets);

  //set the base Relayer onchain
  const iface = new ethers.utils.Interface(CollateralFacet__factory.abi);
  const calldata = iface.encodeFunctionData("setBaseRelayer", [
    "0xf52398257A254D541F392667600901f710a006eD",
  ]);

  const args1: DeployUpgradeTaskArgs = {
    diamondOwner: "0x01F010a5e001fe9d6940758EA5e8c777885E351e",
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined1,
    useLedger: true,
    useRelayer: false,
    useMultisig: false,
    initAddress: c.aavegotchiDiamond!,
    initCalldata: calldata,
  };

  await run("deployUpgrade", args1);
}

if (require.main === module) {
  upgradeForgeDiamondForPet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
