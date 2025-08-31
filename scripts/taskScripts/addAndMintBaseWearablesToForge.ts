import { run } from "hardhat";
import { AddAndMintWearablesToForgeTaskArgs } from "../../tasks/addAndMintWearablesToForge";
import { varsForNetwork } from "../../helpers/constants";
import { ethers } from "hardhat";

async function addAndMintBaseWearablesToForge() {
  const itemIdsArray = [418, 419, 420];
  const itemIds = itemIdsArray.join(",");

  console.log(`\n📋 Item IDs to process: ${itemIds}`);

  const c = await varsForNetwork(ethers);

  const args: AddAndMintWearablesToForgeTaskArgs = {
    itemIds: itemIds,
    recipient: c.forgeDiamond!,
  };

  console.log(`\n🚀 Running deployment task with item IDs: ${itemIds}`);

  // Run the main deployment task (which includes validation)
  await run("addAndMintBaseWearables", args);
}

addAndMintBaseWearablesToForge()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

exports.addAndMintBaseWearablesToForge = addAndMintBaseWearablesToForge;
