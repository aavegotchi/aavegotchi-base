import { ethers, network, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import { PC_WALLET } from "../../geistBridge/paths";
import {
  baseRelayerAddress,
  getRelayerSigner,
  impersonate,
} from "../../helperFunctions";

export async function upgrade() {
  console.log("Deploying fix all old escrows");
  const c = await varsForNetwork(ethers);
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "EscrowFacet",
      addSelectors: [
        "function fixOldLendingsAndSettleAlchemica(uint256[] calldata _lendingIds,address[] calldata _alchemicaAddresses) external",
      ],
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

  //@ts-ignore
  //fix and settle all lendings without revenue tokens
  const signer = await getRelayerSigner(hre);
  let escrowFacet = await ethers.getContractAt(
    "EscrowFacet",
    c.aavegotchiDiamond!,
    signer
  );

  const testing = ["hardhat", "localhost"].includes(network.name);
  if (testing) {
    escrowFacet = await impersonate(
      baseRelayerAddress,
      escrowFacet,
      ethers,
      network
    );
  }

  //from id 1 to 418
  const allIds = Array.from({ length: 418 }, (_, i) => i + 1);
  const revenueTokens = [c.fud!, c.fomo!, c.alpha!, c.kek!];

  //batches of 50
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const tx = await escrowFacet.fixOldLendingsAndSettleAlchemica(
      batch,
      revenueTokens
    );

    const tx2 = await tx.wait();

    console.log(
      `Fixed batch ${i / 50 + 1} of ${Math.ceil(
        allIds.length / 50
      )} gas used ${tx2.gasUsed.toString()}`
    );
  }
}

if (require.main === module) {
  upgrade()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
