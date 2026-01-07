import { ethers, run } from "hardhat";
import {
  convertFacetAndSelectorsToString,
  DeployUpgradeTaskArgs,
  FacetsAndAddSelectors,
} from "../../../tasks/deployUpgrade";

import { varsForNetwork } from "../../../helpers/constants";
import { baseRelayerAddress } from "../../helperFunctions";
import { PC_WALLET } from "../../geistBridge/paths";

/**
 * This upgrade fixes a critical double-spend bug in LibGotchiLending.sol
 * where the initial rental cost was being transferred twice from the borrower.
 *
 * PR #38: https://github.com/aavegotchi/aavegotchi-base/pull/38
 *
 * The fix removes the duplicate transfer on line 217 (lines 216-218) since
 * the same transfer already occurs on line 245 (lines 244-246).
 *
 * All facets that import LibGotchiLending must be redeployed:
 * - GotchiLendingFacet
 * - LendingGetterAndSetterFacet
 * - AavegotchiFacet
 * - AavegotchiGameFacet
 * - ERC721BuyOrderFacet
 */
export async function upgradeLendingDoubleSpendFix() {
  console.log("🔧 Deploying lending double-spend fix...");
  console.log(
    "This fix removes duplicate initial cost transfer in _agreeGotchiLending"
  );

  const c = await varsForNetwork(ethers);

  // All facets that import LibGotchiLending need to be redeployed
  // so they link to the updated library code
  const facets: FacetsAndAddSelectors[] = [
    {
      facetName: "GotchiLendingFacet",
      addSelectors: [],
      removeSelectors: [],
    },
    {
      facetName: "LendingGetterAndSetterFacet",
      addSelectors: [],
      removeSelectors: [],
    },
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
  ];

  const joined = convertFacetAndSelectorsToString(facets);

  const args: DeployUpgradeTaskArgs = {
    diamondOwner: PC_WALLET,
    diamondAddress: c.aavegotchiDiamond!,
    facetsAndAddSelectors: joined,
    useLedger: true,
    useRelayer: false,
    useMultisig: false,
  };

  console.log("\n📋 Facets to redeploy:");
  facets.forEach((f) => console.log(`   - ${f.facetName}`));
  console.log(`\n💎 Diamond: ${c.aavegotchiDiamond}`);
  console.log(`👤 Owner: ${baseRelayerAddress}\n`);

  await run("deployUpgrade", args);

  console.log("✅ Lending double-spend fix deployed successfully!");
  console.log(
    "   Borrowers will now only be charged once for initial rental costs."
  );
}

if (require.main === module) {
  upgradeLendingDoubleSpendFix()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
